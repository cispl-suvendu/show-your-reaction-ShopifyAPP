import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { Readable } from "stream";
import { uploadFileToGridFS } from "./gridfs.server";
import fs from "fs";
import path from "path";
import os from "os";

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Generate a thumbnail from a video buffer
 * @param {Buffer} videoBuffer - The video file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{thumbnailBuffer: Buffer, thumbnailId: string, thumbnailLink: string}>}
 */
export const generateThumbnail = async (videoBuffer, filename) => {
    return new Promise(async (resolve, reject) => {
        // Create temp files
        const tempDir = os.tmpdir();
        const tempVideoPath = path.join(tempDir, `video_${Date.now()}_${filename}`);
        const tempThumbPath = path.join(tempDir, `thumb_${Date.now()}.jpg`);

        try {
            // Write video buffer to temp file
            fs.writeFileSync(tempVideoPath, videoBuffer);

            // Generate thumbnail
            ffmpeg(tempVideoPath)
                .screenshots({
                    timestamps: ['00:00:01.000'],
                    filename: path.basename(tempThumbPath),
                    folder: path.dirname(tempThumbPath),
                    size: '320x240'
                })
                .on('end', async () => {
                    try {
                        // Read the generated thumbnail
                        const thumbnailBuffer = fs.readFileSync(tempThumbPath);

                        // Upload thumbnail to GridFS
                        const thumbnailFilename = `thumb_${filename.replace(/\.[^/.]+$/, "")}.jpg`;
                        const thumbnailFile = await uploadFileToGridFS(
                            thumbnailBuffer,
                            thumbnailFilename,
                            'image/jpeg'
                        );

                        // Clean up temp files
                        fs.unlinkSync(tempVideoPath);
                        fs.unlinkSync(tempThumbPath);

                        resolve({
                            thumbnailBuffer,
                            thumbnailId: thumbnailFile.id,
                            thumbnailLink: thumbnailFile.webContentLink
                        });
                    } catch (error) {
                        console.error('Thumbnail upload error:', error);
                        // Clean up temp files on error
                        try { fs.unlinkSync(tempVideoPath); } catch (e) { }
                        try { fs.unlinkSync(tempThumbPath); } catch (e) { }

                        resolve({
                            thumbnailBuffer: null,
                            thumbnailId: null,
                            thumbnailLink: null
                        });
                    }
                })
                .on('error', (err) => {
                    console.error('Thumbnail generation error:', err);
                    // Clean up temp files on error
                    try { fs.unlinkSync(tempVideoPath); } catch (e) { }
                    try { fs.unlinkSync(tempThumbPath); } catch (e) { }

                    // Return null thumbnail instead of failing the upload
                    resolve({
                        thumbnailBuffer: null,
                        thumbnailId: null,
                        thumbnailLink: null
                    });
                });
        } catch (error) {
            console.error('Thumbnail process error:', error);
            // Clean up temp files on error
            try { fs.unlinkSync(tempVideoPath); } catch (e) { }
            try { fs.unlinkSync(tempThumbPath); } catch (e) { }

            resolve({
                thumbnailBuffer: null,
                thumbnailId: null,
                thumbnailLink: null
            });
        }
    });
};
