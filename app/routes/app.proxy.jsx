import { json, unstable_composeUploadHandlers, unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { uploadFileToGridFS } from "../services/gridfs.server";
import { generateThumbnail } from "../services/thumbnail.server";
import Video from "../models/video.server";
import connection from "../db.server";
import { title } from "process";

export const loader = async ({ request }) => {
    await authenticate.public.appProxy(request);
    await connection;

    const videos = await Video.find({ status: 'approved' })
        .sort({ createdAt: -1 })
        .select('fileId thumbnailLink webContentLink webViewLink uploaderName');

    // Format videos for storefront consumption
    const formattedVideos = videos.map(v => ({
        fileId: v.fileId,
        // Convert /api/videos to /apps/videos for storefront (proxy)
        // Or if null, generate the link
        thumbnailLink: v.thumbnailLink ? v.thumbnailLink.replace('/api/videos/', '/apps/videos/') : `/apps/videos/thumb_${v.id}.jpg`,

        // Video link conversion
        webContentLink: (v.webContentLink || v.webViewLink || '').replace('/api/videos/', '/apps/videos/'),
        webViewLink: (v.webViewLink || v.webContentLink || '').replace('/api/videos/', '/apps/videos/'),
        uploaderName: (v.uploaderName || 'Untitled Video')
    }));

    return json({ videos: formattedVideos });
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

                // Upload video to GridFS
                const gridFSFile = await uploadFileToGridFS(buffer, filename, contentType);

                // Generate thumbnail
                const thumbnail = await generateThumbnail(buffer, filename);

                // Combine video and thumbnail data
                const fileData = {
                    ...gridFSFile,
                    thumbnailLink: thumbnail.thumbnailLink
                };

                // Return JSON string
                return JSON.stringify(fileData);
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

        const uploaderName = formData.get("name");
        const uploaderEmail = formData.get("email");

        if (!uploaderName || !uploaderEmail) {
            return json({ error: "Name and email are required" }, { status: 400 });
        }

        await Video.create({
            shop,
            fileId: fileData.id,
            webContentLink: fileData.webContentLink,
            webViewLink: fileData.webViewLink,
            thumbnailLink: fileData.thumbnailLink,
            uploaderName,
            uploaderEmail,
            status: 'pending'
        });

        return json({ success: true, message: "Video uploaded successfully!" });
    } catch (error) {
        console.error("Upload error:", error);
        return json({ error: "Upload failed: " + error.message }, { status: 500 });
    }
};
