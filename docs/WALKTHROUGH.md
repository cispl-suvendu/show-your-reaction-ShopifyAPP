# Verification Walkthrough - Show Your Reaction

Follow these steps to verify the app functionality.

## 1. Environment Setup
> [!IMPORTANT]
> Ensure you have populated `.env` with valid credentials:
> - `MONGODB_URI`: Connection string to your MongoDB cluster.
>
> No additional cloud storage credentials are needed - videos are stored in MongoDB GridFS.

## 2. Start the App
Run the development server:
```bash
npm run dev
```
- Press `p` to open the App in your Partner Dashboard if needed.
- Open the provided **App URL** to install it on your development store.

## 3. Configure Storefront (Theme Editor)
1. Go to **Online Store > Themes > Customize**.
2. Navigate to a page (e.g., Default Page or create a new "Reactions" page).
3. **Add Block**: Search for "Upload Form" (under Apps > Show Your Reaction).
   - Add it to a section.
   - Save.
4. **Add Block**: Search for "Video Gallery".
   - Add it below the form.
   - Save.

## 4. Test Upload (User Flow)
1. Open the preview of the page you customized.
2. Select a small video file.
3. Click "Upload Reaction".
4. **Verify**:
   - Success message appears: "Success! Your video is submitted..."
   - Check MongoDB: A new document with `status: "pending"` should exist.
   - Video file is stored in GridFS (check `videos.files` and `videos.chunks` collections).

## 5. Test Admin (Management Flow)
1. Go to **Shopify Admin > Apps > Show Your Reaction**.
2. **Verify**:
   - The new video appears in the list.
   - Status shows "PENDING".
3. **Action**: Click **Approve**.
   - Status should change to "APPROVED".
4. **Action**: Click **Delete** (on a test video).
   - Verify video is removed from list and MongoDB GridFS.

## 6. Verify Gallery
1. Refresh the Storefront page.
2. **Verify**:
   - The approved video now appears in the Gallery grid.
   - Click "Watch" to open the video (served from `/api/videos/:fileId`).
