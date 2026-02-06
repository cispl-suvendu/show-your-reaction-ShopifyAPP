# Developer Guide - Show Your Reaction

This guide will help developers understand, modify, and extend the "Show Your Reaction" Shopify app with the new Gift Card Reward feature.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Gift Card Feature](#gift-card-feature)
5. [Common Development Tasks](#common-development-tasks)
6. [Adding New Features](#adding-new-features)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

**Tech Stack:**
- **Framework**: Remix (Shopify App Template)
- **UI Library**: Shopify Polaris
- **Database**: MongoDB (with Mongoose ODM)
- **Storage**: MongoDB GridFS
- **Authentication**: Shopify OAuth (via `@shopify/shopify-app-remix`)
- **Email**: SMTP with Nodemailer
- **Gift Cards**: Shopify Admin GraphQL API

**Data Flow:**
1. **Upload**: Storefront → App Proxy → GridFS + MongoDB
2. **Approval**: Admin Dashboard → MongoDB (approve/delete)
3. **Gift Card**: Approval Event → Shopify Admin API → Email Service → Customer
4. **Display**: Storefront → App Proxy → MongoDB (approved videos only)

**Gift Card Workflow:**
```
Video Uploaded (pending)
    ↓
Admin Clicks "Approve"
    ↓
Video Status → "approved" (saved)
    ↓
Shopify Gift Card Created (via Admin API)
    ↓
Gift Card Record Saved (MongoDB)
    ↓
Email Sent (SMTP) to uploader with gift card code
    ↓
Customer Receives Gift Card
    ↓
Customer Uses Code at Checkout
```

---

## Project Structure

```
show-your-reaction/
├── app/
│   ├── db.server.js                    # MongoDB connection
│   ├── models/
│   │   ├── video.server.js             # Video schema (+ gift card fields)
│   │   └── giftcard.server.js          # Gift card schema & helpers
│   ├── services/
│   │   ├── gridfs.server.js            # GridFS storage service
│   │   ├── thumbnail.server.js         # Video thumbnail generation
│   │   └── email.server.js             # SMTP email service (NEW)
│   ├── routes/
│   │   ├── app._index.jsx              # Admin dashboard (+ gift card trigger)
│   │   ├── app.gift-cards.jsx          # Gift card management view (NEW)
│   │   ├── app.proxy.jsx               # Upload & list videos (storefront)
│   │   └── api.videos.$fileId.jsx      # Serve videos from GridFS
│   └── shopify.server.js               # Shopify app config
├── extensions/
│   └── video-gallery/
│       ├── blocks/
│       │   ├── upload-form.liquid      # Upload form block
│       │   ├── gallery.liquid          # Video gallery block
│       │   └── star_rating.liquid      # Star rating component
│       └── assets/
│           ├── upload-form.js/css      # Upload logic & styles
│           ├── gallery.js/css          # Gallery logic & styles
│           └── stars.liquid            # Rating snippet
├── docs/                               # Documentation
├── prisma/                             # Session storage schema
├── .env                                # Environment variables
└── shopify.app.toml                    # App configuration
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (free tier works)
- Shopify Partner account
- Development store
- SMTP server (for gift card emails)

### Setup
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Edit `.env` and add:
   ```bash
   MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/dbname"
   
   # Gift Card Configuration (Optional)
   ENABLE_GIFT_CARDS=true
   ENABLE_GIFT_CARD_EMAIL=true
   GIFT_CARD_AMOUNT=10
   GIFT_CARD_CURRENCY=USD
   
   # SMTP Configuration for Email (Required for gift card emails)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM_EMAIL=noreply@yourstore.com
   SMTP_REPLY_TO=support@yourstore.com
   SHOPIFY_SHOP_NAME="My Store"
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Select your development store** when prompted.

---

## Gift Card Feature

### Overview
The Gift Card Reward feature automatically creates and sends Shopify gift cards to customers when their videos are approved by admins.

### Configuration

#### Environment Variables
```bash
# Feature Toggle
ENABLE_GIFT_CARDS=true              # Enable/disable gift card creation
ENABLE_GIFT_CARD_EMAIL=true         # Enable/disable email notifications

# Gift Card Details
GIFT_CARD_AMOUNT=10                 # Amount in dollars (default: 10)
GIFT_CARD_CURRENCY=USD              # Currency code (default: USD)
SHOPIFY_SHOP_NAME="My Store"        # Store name for emails

# SMTP Configuration (required if emails enabled)
SMTP_HOST=smtp.gmail.com            # SMTP server address
SMTP_PORT=587                       # SMTP port (587 = TLS, 465 = SSL)
SMTP_SECURE=false                   # Use SSL/TLS
SMTP_USER=your-email@gmail.com      # SMTP authentication user
SMTP_PASS=your-app-password         # SMTP authentication password
SMTP_FROM_EMAIL=noreply@store.com   # Sender email address
SMTP_REPLY_TO=support@store.com     # Reply-to email address
```

#### Setting Up SMTP (Gmail Example)
1. Enable 2-Factor Authentication on your Gmail account
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character app password as `SMTP_PASS`

#### Setting Up SMTP (Other Providers)
- **SendGrid**: Use `SMTP_HOST=smtp.sendgrid.net`, port `587`, user `apikey`
- **AWS SES**: Use `SMTP_HOST=email-smtp.region.amazonaws.com`, port `587`
- **Mailgun**: Use `SMTP_HOST=smtp.mailgun.org`, port `587`

### How It Works

**1. Video Approval Triggered**
Admin clicks "Approve" on a pending video in the admin dashboard.

**2. Gift Card Creation**
```javascript
// app/routes/app._index.jsx - action handler
const shopifyGiftCard = await createShopifyGiftCard({
  shopifyClient: admin.graphql,
  initialBalance: 10,  // From GIFT_CARD_AMOUNT env var
  currency: "USD"      // From GIFT_CARD_CURRENCY env var
});
```

**3. Database Record**
Gift card details are saved to MongoDB:
```javascript
{
  shop: "mystore.myshopify.com",
  videoId: "video_object_id",
  uploaderEmail: "customer@example.com",
  uploaderName: "John Doe",
  shopifyGiftCardId: "gid://shopify/GiftCard/123456",
  giftCardCode: "ABC1234DEF567",
  giftCardValue: 1000,  // In cents
  currency: "USD",
  emailSent: false,
  createdAt: "2024-01-15T10:30:00Z"
}
```

**4. Email Sent**
Customer receives a professional HTML email with:
- Gift card details
- Unique gift card code
- Store link
- Instructions on how to use the card

**5. Video Updated**
Video record is updated with gift card tracking:
```javascript
{
  giftCardCreated: true,
  giftCardId: "gift_card_object_id",
  giftCardEmailSent: true,
  approvedAt: "2024-01-15T10:30:00Z"
}
```

### Gift Card Service Reference

#### `app/models/giftcard.server.js`

**Functions:**
- `createShopifyGiftCard({shopifyClient, initialBalance, currency})` - Creates gift card via Shopify API
- `resendGiftCardCode({shopifyClient, giftCardId})` - Retrieves gift card code
- `saveGiftCardRecord({...})` - Saves gift card record to MongoDB
- `markGiftCardEmailSent(giftCardId, success)` - Updates email status
- `getGiftCardByVideoId(videoId)` - Retrieves gift card by video
- `getShopGiftCards(shop, options)` - Lists all gift cards for shop

#### `app/services/email.server.js`

**Functions:**
- `sendGiftCardEmail({email, uploaderName, giftCardCode, giftCardValue, shopName, shopDomain})` - Sends gift card email
- `testEmailConfig()` - Tests SMTP configuration
- `getEmailTransporter()` - Gets/creates SMTP transporter (cached)

### Viewing Gift Cards

**Admin Dashboard:**
1. Go to **Apps > Show Your Reaction > Gift Cards**
2. View all gift cards created for your store
3. See email delivery status

**Programmatic Access:**
```javascript
import GiftCard from "../models/giftcard.server";
import connection from "../db.server";

await connection;
const giftCards = await GiftCard.find({ shop: "mystore.myshopify.com" });
```

### Error Handling

If gift card creation fails:
- Video is still marked as approved
- Error is logged to console
- Admin is notified via response
- Email is not sent
- You can manually create a gift card if needed

If email fails:
- Gift card is still created
- Error is logged
- Gift card record shows `emailSent: false`
- You can retry manually or configure email retry logic

---

## Common Development Tasks

### 1. Modify Video Schema

**File:** `app/models/video.server.js`

**Example: Add a "category" field**
```javascript
const videoSchema = new mongoose.Schema({
  // ... existing fields
  category: {
    type: String,
    enum: ['reaction', 'testimonial', 'unboxing'],
    default: 'reaction'
  }
  // ... rest of schema
});
```

### 2. Change Gift Card Amount per Tier

**File:** `app/routes/app._index.jsx`

**Example: Award more for quality videos**
```javascript
// In the approval action handler
let giftCardAmount = 10; // Default

// Check video quality (you could add quality field to schema)
if (video.quality === 'premium') {
  giftCardAmount = 25;
} else if (video.quality === 'good') {
  giftCardAmount = 15;
}

const shopifyGiftCard = await createShopifyGiftCard({
  shopifyClient: admin.graphql,
  initialBalance: giftCardAmount,
  currency: "USD"
});
```

### 3. Customize Gift Card Email

**File:** `app/services/email.server.js`

The email template is in the `sendGiftCardEmail()` function. Modify the `htmlContent` variable to customize:
- Colors
- Logo/branding
- Content and messaging
- Additional information

### 4. Add Gift Card Resend Functionality

**File:** `app/routes/app.gift-cards.jsx`

Add an action handler:
```javascript
export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  await connection;
  const formData = await request.formData();

  if (formData.get("intent") === "resend-email") {
    const giftCardId = formData.get("giftCardId");
    const giftCard = await GiftCard.findById(giftCardId);

    try {
      await sendGiftCardEmail({
        email: giftCard.uploaderEmail,
        uploaderName: giftCard.uploaderName,
        giftCardCode: giftCard.giftCardCode,
        giftCardValue: giftCard.giftCardValue,
        shopName: process.env.SHOPIFY_SHOP_NAME,
        shopDomain: session.shop
      });

      await markGiftCardEmailSent(giftCardId, true);
      return json({ success: true });
    } catch (error) {
      return json({ error: error.message }, { status: 500 });
    }
  }
};
```

### 5. Add Video Rejection with Notification

**File:** `app/routes/app._index.jsx`

Extend the approval logic:
```javascript
if (intent === "reject") {
  const video = await Video.findOne({ _id: videoId, shop: session.shop });
  video.status = "rejected";
  await video.save();

  // Optionally notify customer
  if (video.uploaderEmail) {
    await sendEmail({
      email: video.uploaderEmail,
      subject: "Video Update",
      message: "Your video was not approved. Please try another."
    });
  }

  return json({ success: true, message: "Video rejected" });
}
```

---

## Adding New Features

### Example: Add Video Ratings

#### 1. Update Video Schema
**File:** `app/models/video.server.js`
```javascript
const videoSchema = new mongoose.Schema({
  // ... existing fields
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 }
});
```

#### 2. Create Rating API Route
**File:** `app/routes/api.videos.$fileId.rating.jsx`
```javascript
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import Video from "../models/video.server";
import connection from "../db.server";

export const action = async ({ request, params }) => {
  await authenticate.public.appProxy(request);
  await connection;

  const formData = await request.formData();
  const rating = parseInt(formData.get("rating"));
  const fileId = params.fileId;

  if (rating < 1 || rating > 5) {
    return json({ error: "Invalid rating" }, { status: 400 });
  }

  const video = await Video.findOne({ fileId });
  if (!video) return json({ error: "Not found" }, { status: 404 });

  // Update average rating
  const currentSum = video.rating * video.ratingCount;
  video.ratingCount += 1;
  video.rating = (currentSum + rating) / video.ratingCount;

  await video.save();
  return json({ success: true, newRating: video.rating });
};
```

#### 3. Update Frontend
Update your gallery block to display and submit ratings.

---

## Troubleshooting

### Gift Card Issues

**Issue: Gift card not creating on approval**
- [ ] Check `ENABLE_GIFT_CARDS=true` in `.env`
- [ ] Verify Shopify API token has `giftcards:manage` scope
- [ ] Check server logs for Shopify API errors
- [ ] Ensure MongoDB connection is working

**Issue: Email not sending**
- [ ] Verify `ENABLE_GIFT_CARD_EMAIL=true`
- [ ] Check SMTP configuration in `.env`
- [ ] Test with `testEmailConfig()` function
- [ ] Check server logs for email errors
- [ ] Verify email credentials are correct
- [ ] For Gmail: Use app-specific password, not regular password
- [ ] Check spam folder for bounced emails

**Issue: Gift card code not showing**
- [ ] Wait a moment - Shopify may need time to generate code
- [ ] Try querying the gift card directly via GraphQL
- [ ] The code is stored when gift card is created

### Video Upload Issues
**Check:**
1. MongoDB connection string is correct in `.env`
2. MongoDB cluster allows connections from your IP
3. GridFS collections exist in MongoDB
4. Check browser console for errors

### Videos not displaying in gallery
**Check:**
1. Video status is `approved` in MongoDB
2. App Proxy is configured in `shopify.app.toml`
3. Theme blocks are added to the page
4. `/apps/videos` endpoint returns data

### Admin dashboard not loading
**Check:**
1. App is installed on development store
2. Shopify API credentials are correct
3. Session storage is working

---

## Deployment

### Production Checklist
- [ ] Update `MONGODB_URI` with production database
- [ ] Configure MongoDB Atlas IP whitelist
- [ ] Set production Shopify app credentials
- [ ] Test all features on production store
- [ ] Configure email with production SMTP
- [ ] Set up error tracking and monitoring
- [ ] Configure MongoDB backups
- [ ] Test gift card creation workflow
- [ ] Verify email delivery rates

### Deploy to Shopify
```bash
npm run deploy
```

---

## Additional Resources

- [Shopify Apps Documentation](https://shopify.dev/docs/apps)
- [Shopify Admin API Reference](https://shopify.dev/api/admin-rest)
- [Remix Documentation](https://remix.run/docs)
- [MongoDB GridFS](https://www.mongodb.com/docs/manual/core/gridfs/)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Polaris Components](https://polaris.shopify.com/)

---

## Support

For questions or issues:
- Review `docs/IMPLEMENTATION_PLAN.md` for architecture details
- Check `docs/WALKTHROUGH.md` for testing procedures
- See `docs/TASK.md` for development checklist
- Review server logs in terminal: `npm run dev`

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
