# Implementation Plan - Show Your Reaction with Gift Card Rewards

This document outlines the technical architecture and implementation of the Show Your Reaction app, including the Gift Card Reward feature.

## Overview

The app allows storefront customers to upload videos which are stored in **MongoDB GridFS** and managed via a Shopify Admin interface. Approved videos are displayed on the storefront. **NEW: When videos are approved, customers automatically receive Shopify gift cards via email.**

## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     STOREFRONT (Customer)                       │
├─────────────────────────────────────────────────────────────────┤
│ Upload Video → GridFS Storage + MongoDB (pending status)        │
│ View Approved Videos → Gallery from MongoDB                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD (Store Admin)                │
├─────────────────────────────────────────────────────────────────┤
│ View Pending Videos → Click "Approve"                           │
│                              ↓                                  │
│ Video Status Updated → "approved"                               │
│                              ↓                                  │
│         ┌───────────────────┴────────────────────┐              │
│         │   GIFT CARD WORKFLOW (NEW)            │              │
│         ├───────────────────┬────────────────────┤              │
│         ↓                   ↓                    ↓              │
│    Create Gift    Save to MongoDB    Send Email    │              │
│    Card via       Gift Card Record    with Code     │              │
│    Shopify API    (tracking)          (SMTP)        │              │
│         │                   │                    │              │
│         └───────────────────┴────────────────────┘              │
│                        ↓                                        │
│         Video marked with gift card status                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  CUSTOMER EMAIL INBOX                           │
├─────────────────────────────────────────────────────────────────┤
│ 🎁 Gift Card Reward Email with Code                            │
│ Customer uses code at checkout                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Remix (Full Stack React) | App structure and routing |
| **UI** | Shopify Polaris | Admin interface components |
| **Database** | MongoDB + Mongoose | Data storage & ORM |
| **File Storage** | MongoDB GridFS | Video file storage |
| **Email** | Nodemailer + SMTP | Email delivery |
| **Shopify Integration** | Shopify Admin GraphQL API | Gift card creation |
| **Frontend** | Liquid + JavaScript | Theme extension blocks |

## Database Schema

### Video Model
```javascript
{
  _id: ObjectId,
  shop: "mystore.myshopify.com",
  fileId: "gridfs_file_id",
  webContentLink: "/api/videos/...",
  webViewLink: "/api/videos/...",
  thumbnailLink: "...",
  uploaderName: "John Doe",
  uploaderEmail: "john@example.com",
  status: "pending|approved|rejected",
  
  // Gift Card Fields (NEW)
  giftCardCreated: false,
  giftCardId: "mongodb_giftcard_id",
  giftCardEmailSent: false,
  approvedAt: ISODate,
  
  createdAt: ISODate
}
```

### GiftCard Model (NEW)
```javascript
{
  _id: ObjectId,
  shop: "mystore.myshopify.com",
  videoId: "mongodb_video_id",
  uploaderEmail: "john@example.com",
  uploaderName: "John Doe",
  shopifyGiftCardId: "gid://shopify/GiftCard/123456",
  giftCardCode: "ABC1234DEF567",
  giftCardValue: 1000, // In cents ($10.00)
  currency: "USD",
  emailSent: false,
  emailSentAt: ISODate | null,
  createdAt: ISODate
}
```

## Key Components

### 1. Upload Flow
- **Route**: `app/routes/app.proxy.jsx`
- **Process**:
  1. Customer uploads video file
  2. File is stored in GridFS
  3. Thumbnail is generated
  4. Video metadata saved to MongoDB with `status: "pending"`
  5. Success response sent to customer

### 2. Approval Flow (Enhanced with Gift Cards)
- **Route**: `app/routes/app._index.jsx`
- **Process**:
  1. Admin views pending videos in dashboard
  2. Admin clicks "Approve"
  3. Video status updated to "approved"
  4. **NEW**: Shopify gift card created via Admin API
  5. **NEW**: Gift card record saved to MongoDB
  6. **NEW**: Email sent to uploader with gift card code
  7. **NEW**: Video record updated with gift card tracking fields
  8. Admin sees visual confirmation of gift card status

### 3. Gift Card Creation (NEW)
- **Service**: `app/models/giftcard.server.js`
- **Process**:
  1. GraphQL mutation sent to Shopify Admin API
  2. Gift card created with configured amount
  3. Gift card ID and code retrieved
  4. Saved to database for tracking
  5. Email sent immediately

### 4. Email Service (NEW)
- **Service**: `app/services/email.server.js`
- **Process**:
  1. SMTP connection established (cached)
  2. Professional HTML email template generated
  3. Email sent via configured SMTP server
  4. Status tracked in database
  5. Errors logged for troubleshooting

### 5. Gallery Display
- **Route**: `app/routes/app.proxy.jsx` (loader)
- **Process**:
  1. Customer requests approved videos
  2. MongoDB query filters by `status: "approved"`
  3. Video metadata returned as JSON
  4. Theme extension displays in gallery

## Service Layer

### `app/services/email.server.js`
```
Functions:
├── sendGiftCardEmail() - Main email sending function
├── getEmailTransporter() - SMTP connection management
└── testEmailConfig() - Configuration validation
```

### `app/models/giftcard.server.js`
```
Functions:
├── createShopifyGiftCard() - Shopify Admin API integration
├── resendGiftCardCode() - Retrieve gift card code
├── saveGiftCardRecord() - MongoDB persistence
├── markGiftCardEmailSent() - Status tracking
├── getGiftCardByVideoId() - Query by video
└── getShopGiftCards() - List all for shop
```

## Environment Configuration

### Required Variables
```
MONGODB_URI                 # MongoDB connection string
SHOPIFY_API_KEY            # Shopify app API key
SHOPIFY_API_SECRET         # Shopify app secret
SCOPES                     # Shopify API scopes
SHOPIFY_APP_URL            # App URL for OAuth
```

### Gift Card Configuration
```
ENABLE_GIFT_CARDS          # Enable/disable feature (true|false)
ENABLE_GIFT_CARD_EMAIL     # Enable email delivery (true|false)
GIFT_CARD_AMOUNT           # Amount in dollars (default: 10)
GIFT_CARD_CURRENCY         # Currency code (default: USD)
SHOPIFY_SHOP_NAME          # Store name for emails
```

### SMTP Configuration
```
SMTP_HOST                  # SMTP server address
SMTP_PORT                  # SMTP port (587 for TLS, 465 for SSL)
SMTP_SECURE                # Use SSL/TLS (true|false)
SMTP_USER                  # SMTP authentication username
SMTP_PASS                  # SMTP authentication password
SMTP_FROM_EMAIL            # Sender email address
SMTP_REPLY_TO              # Reply-to email address
```

## Security Considerations

### Authentication
- ✅ Shopify OAuth for admin access
- ✅ App Proxy authentication for storefront
- ✅ GraphQL authentication for API calls

### Email Security
- ✅ SMTP credentials from environment variables
- ✅ Connection pooling for performance
- ✅ Error logging without exposing credentials
- ✅ Transporter caching for efficiency

### Database
- ✅ MongoDB connection string in environment
- ✅ Shop ID validation on all queries
- ✅ No direct customer data access from public routes

### Gift Card Handling
- ✅ Shopify Admin API for gift card creation
- ✅ GraphQL authentication required
- ✅ Email sent only to video uploader
- ✅ All gift card data encrypted in transit

## Error Handling

### Graceful Degradation
```
Video Approval:
├── Video marked approved (always succeeds)
├── Gift Card Creation:
│   ├── Success → Send Email
│   ├── Failure → Log error, continue
└── Email Delivery:
    ├── Success → Mark emailSent: true
    └── Failure → Log error, emailSent: false
```

### Error Scenarios
| Scenario | Handling |
|----------|----------|
| Gift card API fails | Video still approved, gift card not created |
| Email fails | Gift card created, email marked as pending |
| SMTP misconfigured | Logged on startup, email attempts fail gracefully |
| MongoDB connection fails | App fails to start with clear error message |

## Performance Optimization

### Caching
- Email transporter cached in memory
- MongoDB connection pooled
- Session storage cached via Prisma

### Asynchronous Processing
- Gift card creation doesn't block video approval
- Email sending doesn't block response
- Error handling prevents cascade failures

### Database Indexing Recommendations
```javascript
// Add to your MongoDB instance:
db.videos.createIndex({ shop: 1, status: 1 })
db.videos.createIndex({ uploaderEmail: 1 })
db.giftcards.createIndex({ shop: 1, createdAt: -1 })
db.giftcards.createIndex({ uploaderEmail: 1 })
db.giftcards.createIndex({ videoId: 1 })
```

## Deployment Checklist

### Before Production
- [ ] Test gift card creation on staging store
- [ ] Test email delivery with real SMTP
- [ ] Verify all environment variables are set
- [ ] Configure MongoDB Atlas network access
- [ ] Set up MongoDB backups
- [ ] Test error scenarios
- [ ] Verify Shopify scopes include `giftcards:manage`
- [ ] Load test with expected volume

### Post-Deployment
- [ ] Monitor error logs
- [ ] Verify email delivery rates
- [ ] Track gift card usage
- [ ] Monitor MongoDB performance
- [ ] Set up alerts for failures

## Testing Strategy

### Unit Tests
- Email template generation
- Gift card code validation
- Database queries

### Integration Tests
- Full approval workflow
- Email delivery
- Shopify API integration

### Manual Testing
- Upload video → Approve → Check email
- View gift cards in admin
- Use gift card at checkout
- Test error scenarios

## Future Enhancements

### Phase 2
- [ ] Tiered gift card amounts based on video quality
- [ ] Gift card expiration dates
- [ ] Email resend functionality
- [ ] Gift card analytics dashboard

### Phase 3
- [ ] Automatic video quality scoring
- [ ] Custom email templates per brand
- [ ] Gift card code management
- [ ] Refund tracking for gift cards

### Phase 4
- [ ] A/B testing email templates
- [ ] Gift card purchase history integration
- [ ] Customer feedback on gift cards
- [ ] Multi-currency support

## Files Modified/Created

### New Files
- `app/services/email.server.js` - Email service
- `app/models/giftcard.server.js` - Gift card model
- `app/routes/app.gift-cards.jsx` - Gift card admin page

### Modified Files
- `app/models/video.server.js` - Added gift card fields
- `app/routes/app._index.jsx` - Added gift card logic
- `package.json` - Added nodemailer dependency

### Documentation
- `docs/DEVELOPER_GUIDE.md` - Updated with gift card info
- `docs/IMPLEMENTATION_PLAN.md` - This file
- `README.md` - Updated with setup instructions

## Support & Troubleshooting

See the main documentation files:
- **DEVELOPER_GUIDE.md** - Development and configuration
- **WALKTHROUGH.md** - Testing procedures
- **README.md** - Quick start guide

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
