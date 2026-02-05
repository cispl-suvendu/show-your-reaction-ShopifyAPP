import { getFileFromGridFS } from "../services/gridfs.server";

export const loader = async ({ params }) => {
    const { fileId } = params;

    try {
        const downloadStream = await getFileFromGridFS(fileId);

        // Return the video stream as response
        return new Response(downloadStream, {
            headers: {
                "Content-Type": "video/mp4", // Adjust based on actual file type if needed
                "Cache-Control": "public, max-age=31536000",
            },
        });
    } catch (error) {
        console.error("Error serving video:", error);
        return new Response("Video not found", { status: 404 });
    }
};
