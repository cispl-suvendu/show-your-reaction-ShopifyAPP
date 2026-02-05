import { google } from "googleapis";
import { Readable } from "stream";

// Helper to get authenticated drive client
const getDriveClient = () => {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
        return google.drive({ version: 'v3', auth });
    } catch (error) {
        console.error("Google Drive Auth Error:", error);
        return null;
    }
};

export const uploadFileToDrive = async (buffer, filename, mimeType) => {
    const drive = getDriveClient();
    if (!drive) throw new Error("Google Drive not configured");

    const fileMetadata = {
        name: filename,
        // Service accounts have no quota, so we must upload to a folder shared by a real user
        parents: ['1iN4ttPmpyCzalL7gNHtR2nen3EwHPWMD'] // REPLACE THIS WITH YOUR ACTUAL FOLDER ID
    };

    const media = {
        mimeType: mimeType,
        body: Readable.from(buffer),
    };

    const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webContentLink, webViewLink, thumbnailLink',
        supportsAllDrives: true,
    });

    // Make the file public so it can be viewed? 
    // Or just shared? For now, we assume we need a link.
    // If we want it public on storefront, we might need to set permissions.
    await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    return response.data;
};

export const deleteFileFromDrive = async (fileId) => {
    const drive = getDriveClient();
    if (!drive) throw new Error("Google Drive not configured");

    await drive.files.delete({
        fileId: fileId,
    });
};
