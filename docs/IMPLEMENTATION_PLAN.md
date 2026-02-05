# Implementation Plan - Show Your Reaction

This app allows storefront users to upload videos which are stored in **MongoDB GridFS** and managed via a Shopify Admin interface. Approved videos are displayed on the storefront.

## User Review Required

> [!IMPORTANT]
> **Credentials Required**: You will need to provide:
> 1. **MongoDB Connection String** (`MONGODB_URI`)
>
> No additional cloud storage services are needed - videos are stored directly in MongoDB.

## Proposed Changes

### 1. Initialization
- Initialize new Shopify App with Remix template in the current directory.
- Name: "Show Your Reaction"

### 2. Dependencies & Configuration
- **Install**: `mongoose` (for MongoDB and GridFS).
- **Env**: Configure `MONGODB_URI`.

### 3. Backend (app/server)
- **Database**:
    - [NEW] `app/db.server.js`: Connect to MongoDB.
    - [NEW] `app/models/video.server.js`: Schema (`shop`, `fileId`, `webContentLink`, `thumbnailLink`, `status`, `createdAt`).
- **Storage**:
    - [NEW] `app/services/gridfs.server.js`: Handle MongoDB GridFS uploads, downloads, and deletions.

### 4. Admin UI (app/routes)
- **Dashboard**:
    - [MODIFY] `app/routes/app._index.jsx`:
        - Loader: Fetch videos from MongoDB.
        - Action: Handle `APPROVE` and `DELETE` intents.
        - UI: `Polaris` Layout, Card, ResourceList to show videos with actions.

### 5. Storefront Integration (App Proxy & Extensions)
- **App Proxy** (Secure backend communication):
    - [NEW] `app/routes/app.proxy.jsx`:
        - Handle `POST /upload`: Receive file, upload to GridFS, save to DB (pending).
        - Handle `GET /videos`: Return list of `approved` videos.
    - [NEW] `app/routes/api.videos.$fileId.jsx`: Serve video files from GridFS.
- **Theme App Extension**:
    - [NEW] Create extension `video-gallery`.
    - **Blocks**:
        1. `upload-form.liquid`: Form to submit video to App Proxy.
        2. `gallery.liquid`: Grid to fetch and display videos from App Proxy.

## Verification Plan

### Automated Tests
- None initially (Project setup phase).

### Manual Verification
1. **Setup**:
    - Run `npm run dev`.
    - Verify app installs on development store.
2. **Upload Flow**:
    - Add "Upload Form" block to a page in Theme Editor.
    - Upload a video as a customer.
    - Verify file is stored in MongoDB GridFS.
    - Verify document appears in MongoDB with status `pending`.
3. **Admin Flow**:
    - Open App in Shopify Admin.
    - Verify new video is listed.
    - Click "Approve". Verify status updates.
    - Click "Delete". Verify file is removed from GridFS and MongoDB.
4. **Display Flow**:
    - Add "Gallery" block to a page.
    - Verify approved video appears.
    - Verify pending video does not appear.
