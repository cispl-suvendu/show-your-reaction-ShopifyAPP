import { json, unstable_composeUploadHandlers, unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { uploadFileToGridFS } from "../services/gridfs.server";
import Video from "../models/video.server";
import connection from "../db.server";

export const loader = async ({ request }) => {
    await authenticate.public.appProxy(request);
    await connection;

    const videos = await Video.find({ status: 'approved' })
        .sort({ createdAt: -1 })
        .select('fileId shop thumbnailLink webContentLink');

    return json({ videos });
};

export const action = async ({ request }) => {
    await authenticate.public.appProxy(request);
    await connection;

    try {
        const uploadHandler = unstable_composeUploadHandlers(
            async ({ name, data, filename, contentType }) => {
                if (name !== "video") return undefined;

                const chunks = [];
                for await (const chunk of data) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);

                const gridFSFile = await uploadFileToGridFS(buffer, filename, contentType);
                // Return JSON string
                return JSON.stringify(gridFSFile);
            },
            unstable_createMemoryUploadHandler()
        );

        const formData = await unstable_parseMultipartFormData(request, uploadHandler);
        const fileDataString = formData.get("video");

        const url = new URL(request.url);
        const shop = url.searchParams.get("shop");

        if (!fileDataString || !shop) {
            return json({ error: "Missing file or shop info" }, { status: 400 });
        }

        // Parse the JSON string
        let fileData;
        try {
            fileData = JSON.parse(fileDataString);
        } catch (e) {
            fileData = { id: fileDataString };
        }

        await Video.create({
            shop,
            fileId: fileData.id,
            webContentLink: fileData.webContentLink,
            webViewLink: fileData.webViewLink,
            thumbnailLink: fileData.thumbnailLink,
            status: 'pending'
        });

        return json({ success: true, message: "Video uploaded successfully!" });
    } catch (error) {
        console.error("Upload error:", error);
        return json({ error: "Upload failed: " + error.message }, { status: 500 });
    }
};
