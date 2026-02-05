import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";

// Helper to get authenticated storage client
const getStorageClient = () => {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
        return new Storage({
            projectId: credentials.project_id,
            credentials,
        });
    } catch (error) {
        console.error("Google Storage Auth Error:", error);
        return null;
    }
};

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

export const uploadFileToStorage = async (buffer, filename, mimeType) => {
    const storage = getStorageClient();
    if (!storage) throw new Error("Google Storage not configured");
    if (!BUCKET_NAME) throw new Error("GCS_BUCKET_NAME not configured");

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(`videos/${Date.now()}-${filename}`);

    await file.save(buffer, {
        contentType: mimeType,
        resumable: false // suitable for smaller files, consider resumable for large
    });

    // Make file public
    // await file.makePublic(); 
    // OR just use signed URLs or assume public bucket.
    // Let's assume public bucket or signed URLs. 
    // For simplicity of this demo, we can generate a signed URL valid for long time
    // OR better, user makes bucket public and we return public URL.

    // For now, let's return the public URI assuming bucket is public
    // https://storage.googleapis.com/BUCKET_NAME/FILE_PATH

    return {
        id: file.name,
        webContentLink: `https://storage.googleapis.com/${BUCKET_NAME}/${file.name}`,
        webViewLink: `https://storage.googleapis.com/${BUCKET_NAME}/${file.name}`,
        thumbnailLink: null // GCS doesn't auto-generate thumbs like Drive
    };
};

export const deleteFileFromStorage = async (fileId) => {
    const storage = getStorageClient();
    if (!storage) throw new Error("Google Storage not configured");
    if (!BUCKET_NAME) throw new Error("GCS_BUCKET_NAME not configured");

    await storage.bucket(BUCKET_NAME).file(fileId).delete();
};
