import mongoose from "mongoose";
import connection from "../db.server";

const VideoSchema = new mongoose.Schema({
    shop: { type: String, required: true },
    fileId: { type: String, required: true }, // Google Drive File ID
    webContentLink: { type: String }, // Download link
    webViewLink: { type: String }, // View link
    thumbnailLink: { type: String },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
});

// Use existing model if defined (hmr safe)
const Video = mongoose.models.Video || mongoose.model("Video", VideoSchema);

export default Video;
