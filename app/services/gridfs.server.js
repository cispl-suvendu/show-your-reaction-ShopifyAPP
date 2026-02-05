import mongoose from "mongoose";
import { Readable } from "stream";
import connection from "../db.server";

// GridFS bucket for file storage
let bucket;

const getBucket = async () => {
    if (bucket) return bucket;

    await connection;
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'videos'
    });

    return bucket;
};

export const uploadFileToGridFS = async (buffer, filename, mimeType) => {
    const gridFSBucket = await getBucket();

    const uploadStream = gridFSBucket.openUploadStream(filename, {
        contentType: mimeType,
        metadata: {
            uploadedAt: new Date()
        }
    });

    const readableStream = Readable.from(buffer);

    return new Promise((resolve, reject) => {
        readableStream.pipe(uploadStream)
            .on('error', reject)
            .on('finish', () => {
                // GridFS doesn't auto-generate thumbnails or public links
                // We'll create our own endpoint to serve these files
                resolve({
                    id: uploadStream.id.toString(),
                    webContentLink: `/api/videos/${uploadStream.id.toString()}`,
                    webViewLink: `/api/videos/${uploadStream.id.toString()}`,
                    thumbnailLink: null // No auto thumbnails in GridFS
                });
            });
    });
};

export const deleteFileFromGridFS = async (fileId) => {
    const gridFSBucket = await getBucket();
    await gridFSBucket.delete(new mongoose.Types.ObjectId(fileId));
};

export const getFileFromGridFS = async (fileId) => {
    const gridFSBucket = await getBucket();
    return gridFSBucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
};
