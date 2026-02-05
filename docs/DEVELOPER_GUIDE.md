# Developer Guide - Show Your Reaction

This guide will help developers understand, modify, and extend the "Show Your Reaction" Shopify app.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Common Development Tasks](#common-development-tasks)
5. [Adding New Features](#adding-new-features)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

**Tech Stack:**
- **Framework**: Remix (Shopify App Template)
- **UI Library**: Shopify Polaris
- **Database**: MongoDB (with Mongoose ODM)
- **Storage**: MongoDB GridFS
- **Authentication**: Shopify OAuth (via `@shopify/shopify-app-remix`)

**Data Flow:**
1. **Upload**: Storefront → App Proxy → GridFS + MongoDB
2. **Admin**: Admin Dashboard → MongoDB (approve/delete)
3. **Display**: Storefront → App Proxy → MongoDB (approved videos only)

---

## Project Structure

```
show-your-reaction/
├── app/
│   ├── db.server.js                    # MongoDB connection
│   ├── models/
│   │   └── video.server.js             # Video schema
│   ├── services/
│   │   └── gridfs.server.js            # GridFS storage service
│   ├── routes/
│   │   ├── app._index.jsx              # Admin dashboard
│   │   ├── app.proxy.jsx               # Upload & list videos (storefront)
│   │   └── api.videos.$fileId.jsx      # Serve videos from GridFS
│   └── shopify.server.js               # Shopify app config
├── extensions/
│   └── video-gallery/
│       ├── blocks/
│       │   ├── upload-form.liquid      # Upload form block
│       │   └── gallery.liquid          # Video gallery block
│       └── assets/
│           ├── upload-form.js          # Upload logic
│           ├── upload-form.css         # Upload styles
│           ├── gallery.js              # Gallery logic
│           └── gallery.css             # Gallery styles
├── docs/                               # Documentation
├── .env                                # Environment variables
└── shopify.app.toml                    # App configuration
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Shopify Partner account
- Development store

### Setup
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Edit `.env` and add your MongoDB connection string:
   ```bash
   MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/dbname"
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Select your development store** when prompted.

---

## Common Development Tasks

### 1. Modify Video Schema

**File:** `app/models/video.server.js`

**Example: Add a "likes" field**
```javascript
const videoSchema = new mongoose.Schema({
  shop: { type: String, required: true },
  fileId: { type: String, required: true },
  webContentLink: String,
  webViewLink: String,
  thumbnailLink: String,
  status: { type: String, default: 'pending' },
  likes: { type: Number, default: 0 }, // NEW FIELD
  createdAt: { type: Date, default: Date.now }
});
```

### 2. Add New Admin Actions

**File:** `app/routes/app._index.jsx`

**Example: Add a "Feature" action**

1. **Update the action handler:**
```javascript
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await connection;
  const formData = await request.formData();
  
  const intent = formData.get("intent");
  const videoId = formData.get("id");

  if (intent === "feature") {
    await Video.updateOne(
      { _id: videoId, shop: session.shop },
      { featured: true }
    );
    return json({ success: true });
  }
  // ... existing approve/delete logic
};
```

2. **Add UI button:**
```javascript
<Button onClick={() => handleAction(id, 'feature')} tone="success">
  Feature
</Button>
```

### 3. Customize Upload Form

**Files:** 
- `extensions/video-gallery/blocks/upload-form.liquid`
- `extensions/video-gallery/assets/upload-form.js`

**Example: Add file size validation**

In `upload-form.js`:
```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fileInput = form.querySelector('input[type="file"]');
  const file = fileInput.files[0];
  
  // NEW: File size validation (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    statusEl.textContent = 'File too large! Maximum 50MB.';
    statusEl.className = 'syr-status error';
    return;
  }
  
  // ... rest of upload logic
});
```

### 4. Modify Gallery Display

**Files:**
- `extensions/video-gallery/blocks/gallery.liquid`
- `extensions/video-gallery/assets/gallery.js`

**Example: Add sorting options**

In `gallery.js`:
```javascript
const response = await fetch('/apps/videos?sort=newest'); // Add query param
```

In `app.proxy.jsx` loader:
```javascript
export const loader = async ({ request }) => {
  await authenticate.public.appProxy(request);
  await connection;
  
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') || 'newest';
  
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    // Add more sort options
  };
  
  const videos = await Video.find({ status: 'approved' })
    .sort(sortOptions[sort])
    .select('fileId shop thumbnailLink webContentLink');
    
  return json({ videos });
};
```

### 5. Change Storage Limits

**File:** `app/services/gridfs.server.js`

GridFS has no built-in size limits, but you can add validation in the upload handler:

**File:** `app/routes/app.proxy.jsx`
```javascript
const uploadHandler = unstable_composeUploadHandlers(
  async ({ name, data, filename, contentType }) => {
    if (name !== "video") return undefined;
    
    const chunks = [];
    let totalSize = 0;
    const maxSize = 100 * 1024 * 1024; // 100MB limit
    
    for await (const chunk of data) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        throw new Error("File too large");
      }
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    const gridFSFile = await uploadFileToGridFS(buffer, filename, contentType);
    return JSON.stringify(gridFSFile);
  },
  unstable_createMemoryUploadHandler()
);
```

---

## Adding New Features

### Example: Add Video Comments

#### 1. Create Comment Model
**File:** `app/models/comment.server.js`
```javascript
import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  videoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  shop: { type: String, required: true },
  customerName: String,
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Comment || mongoose.model("Comment", commentSchema);
```

#### 2. Create API Route
**File:** `app/routes/api.comments.jsx`
```javascript
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import Comment from "../models/comment.server";
import connection from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.public.appProxy(request);
  await connection;
  
  const url = new URL(request.url);
  const videoId = url.searchParams.get("videoId");
  
  const comments = await Comment.find({ videoId }).sort({ createdAt: -1 });
  return json({ comments });
};

export const action = async ({ request }) => {
  await authenticate.public.appProxy(request);
  await connection;
  
  const formData = await request.formData();
  const videoId = formData.get("videoId");
  const text = formData.get("text");
  const customerName = formData.get("name");
  
  await Comment.create({ videoId, text, customerName, shop: "default" });
  return json({ success: true });
};
```

#### 3. Update Frontend
Add comment form and display in `gallery.liquid` and `gallery.js`.

---

## Troubleshooting

### Issue: Videos not uploading
**Check:**
1. MongoDB connection string is correct in `.env`
2. MongoDB cluster allows connections from your IP
3. Check browser console for errors
4. Check terminal logs for server errors

### Issue: Videos not displaying in gallery
**Check:**
1. Video status is `approved` in MongoDB
2. App Proxy is configured correctly in `shopify.app.toml`
3. Theme blocks are added to the page
4. Check `/apps/videos` endpoint directly

### Issue: Admin dashboard not loading
**Check:**
1. App is installed on the development store
2. Shopify API credentials are correct
3. Session storage is working (check MongoDB `sessions` collection)

### Issue: GridFS files not accessible
**Check:**
1. File ID is correct in MongoDB
2. `/api/videos/:fileId` route is working
3. GridFS bucket name matches (`videos`)

---

## Deployment

### Production Checklist
- [ ] Update `MONGODB_URI` with production database
- [ ] Set up MongoDB Atlas IP whitelist for production
- [ ] Configure production Shopify app credentials
- [ ] Test all features on production store
- [ ] Set up monitoring and error tracking
- [ ] Configure backup strategy for MongoDB

### Deploy to Shopify
```bash
npm run deploy
```

Follow the prompts to deploy your app to Shopify's infrastructure.

---

## Additional Resources

- [Shopify App Development Docs](https://shopify.dev/docs/apps)
- [Remix Documentation](https://remix.run/docs)
- [MongoDB GridFS Guide](https://www.mongodb.com/docs/manual/core/gridfs/)
- [Polaris Component Library](https://polaris.shopify.com/)

---

## Support

For questions or issues, refer to:
- `docs/IMPLEMENTATION_PLAN.md` - Technical architecture
- `docs/WALKTHROUGH.md` - Testing guide
- `docs/TASK.md` - Development checklist
