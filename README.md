# Show Your Reaction - Shopify App

A Shopify app that allows customers to upload video reactions, which can be managed by store admins and displayed on the storefront. **NEW: Automatically rewards customers with Shopify gift cards when their videos are approved!**

## Features

- 📹 **Video Upload** - Customers can upload videos from the storefront
- 🗄️ **MongoDB GridFS Storage** - Videos stored directly in MongoDB (no external cloud services)
- ✅ **Admin Approval** - Review and approve videos before they appear on the storefront
- 🎨 **Customizable Gallery** - Display approved videos in a responsive grid
- 🎁 **Gift Card Rewards** - Automatically send Shopify gift cards to customers when videos are approved
- 📧 **Email Notifications** - Professional emails with gift card codes via SMTP
- 🔒 **Secure** - Built with Shopify's authentication and App Proxy

## Tech Stack

- **Framework**: Remix (Shopify App Template)
- **UI**: Shopify Polaris
- **Database**: MongoDB + GridFS
- **Email**: Nodemailer + SMTP
- **Gift Cards**: Shopify Admin GraphQL API

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (free tier works)
- Shopify Partner account
- Development store
- SMTP Server (Gmail, SendGrid, Mailgun, etc.)

### Installation

1. **Clone and install:**
   ```bash
   cd show-your-reaction
   npm install
   ```

2. **Configure environment:**
   Create/edit `.env` file with required variables:
   
   ```bash
   # MongoDB (Required)
   MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/dbname"
   
   # Gift Card Configuration (Optional, but recommended)
   ENABLE_GIFT_CARDS=true
   ENABLE_GIFT_CARD_EMAIL=true
   GIFT_CARD_AMOUNT=10
   GIFT_CARD_CURRENCY=USD
   SHOPIFY_SHOP_NAME="My Store"
   
   # SMTP Configuration (Required if gift card emails enabled)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM_EMAIL=noreply@yourstore.com
   SMTP_REPLY_TO=support@yourstore.com
   ```

3. **Set up SMTP (Gmail Example)**
   - Enable 2-Factor Authentication on your Gmail account
   - Generate App Password: https://myaccount.google.com/apppasswords
   - Use the 16-character app password as `SMTP_PASS`

4. **Start development:**
   ```bash
   npm run dev
   ```

5. **Install on your store** when prompted

## Gift Card Feature

### How It Works

1. Customer uploads a video from the storefront
2. Admin reviews the video in the app dashboard
3. Admin clicks "Approve"
4. **Automatic Actions:**
   - Shopify creates a gift card for the customer
   - Gift card code is saved to database
   - Professional email sent to customer with gift card code
   - Video is marked with gift card status
5. Customer receives email with gift card code and instructions
6. Customer uses code at checkout to redeem the gift card

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_GIFT_CARDS` | `true` | Enable/disable gift card creation |
| `ENABLE_GIFT_CARD_EMAIL` | `true` | Enable/disable email notifications |
| `GIFT_CARD_AMOUNT` | `10` | Gift card value in dollars |
| `GIFT_CARD_CURRENCY` | `USD` | Currency code |
| `SHOPIFY_SHOP_NAME` | `{shop domain}` | Store name for emails |

### Admin Dashboard

The admin dashboard now shows:
- ✅ Video approval status
- 🎁 Gift card creation status
- 📧 Email delivery status
- Gift card management page to view all created cards

### Email Template

Professional HTML email includes:
- Welcome message
- Gift card value and code
- Store link
- Instructions for redemption
- Professional branding

## Documentation

- 📖 [**Developer Guide**](docs/DEVELOPER_GUIDE.md) - Complete setup and development guide
- 🔧 [**Implementation Plan**](docs/IMPLEMENTATION_PLAN.md) - Technical architecture and design
- ✅ [**Walkthrough**](docs/WALKTHROUGH.md) - Testing and verification procedures
- 📋 [**Task List**](docs/TASK.md) - Development checklist

## Usage

### For Store Admins
1. Go to **Apps > Show Your Reaction** in Shopify Admin
2. View uploaded videos with status badges
3. Click **Approve** to approve video and trigger gift card reward
4. Check **Gift Cards** tab to view all created gift cards and email status
5. Click **Delete** to remove videos

### For Customers
1. Visit a page with the "Upload Form" block
2. Enter your name and email
3. Select a video file
4. Click "Upload Reaction"
5. Wait for admin approval
6. Receive email with gift card code when approved
7. Use code at checkout

### For Theme Developers
Add these blocks to your theme:
- **Upload Form** - Allows customers to upload videos
- **Video Gallery** - Displays approved videos
- **Star Rating** - Optional rating component

## Project Structure

```
app/
├── db.server.js                 # MongoDB connection
├── models/
│   ├── video.server.js          # Video schema with gift card fields
│   └── giftcard.server.js       # Gift card schema (NEW)
├── services/
│   ├── gridfs.server.js         # Video storage
│   ├── thumbnail.server.js      # Thumbnail generation
│   └── email.server.js          # SMTP email service (NEW)
└── routes/
    ├── app._index.jsx           # Admin dashboard (enhanced)
    ├── app.gift-cards.jsx       # Gift card management (NEW)
    ├── app.proxy.jsx            # Video upload/list
    └── api.videos.$fileId.jsx   # Video serving

extensions/
└── video-gallery/               # Theme app extension
    ├── blocks/                  # Liquid templates
    └── assets/                  # JavaScript and CSS

docs/                            # Documentation
```

## Development

### Common Tasks

**Modify video schema:**
```javascript
// app/models/video.server.js
// Add custom fields and logic
```

**Customize email template:**
```javascript
// app/services/email.server.js
// Edit the htmlContent variable in sendGiftCardEmail()
```

**Change gift card amount:**
```javascript
// app/routes/app._index.jsx
// Modify GIFT_CARD_AMOUNT environment variable
```

See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for detailed development instructions.

## Environment Variables Reference

### Required for Core App
```
MONGODB_URI              MongoDB connection string
SHOPIFY_API_KEY         Shopify app API key
SHOPIFY_API_SECRET      Shopify app secret
SCOPES                  Shopify API scopes
SHOPIFY_APP_URL         App URL for OAuth redirects
```

### Required for Gift Cards (Optional)
```
ENABLE_GIFT_CARDS       true/false (default: true)
ENABLE_GIFT_CARD_EMAIL  true/false (default: true)
GIFT_CARD_AMOUNT        Dollar amount (default: 10)
GIFT_CARD_CURRENCY      Currency code (default: USD)
SHOPIFY_SHOP_NAME       Store name for emails
```

### Required for Email (If enabled)
```
SMTP_HOST              SMTP server address
SMTP_PORT              SMTP port (587 or 465)
SMTP_SECURE            true/false (use SSL/TLS)
SMTP_USER              SMTP authentication username
SMTP_PASS              SMTP authentication password
SMTP_FROM_EMAIL        Sender email address
SMTP_REPLY_TO          Reply-to email address (optional)
```

## Troubleshooting

### Gift Cards Not Creating
- [ ] Check `ENABLE_GIFT_CARDS=true` in `.env`
- [ ] Verify Shopify API token has `giftcards:manage` scope
- [ ] Check terminal logs for API errors
- [ ] Ensure MongoDB is connected

### Email Not Sending
- [ ] Verify `ENABLE_GIFT_CARD_EMAIL=true`
- [ ] Check SMTP configuration in `.env`
- [ ] For Gmail: Use app-specific password
- [ ] Check terminal logs for email errors
- [ ] Verify sender email is correct

### MongoDB Issues
- [ ] Verify connection string is correct
- [ ] Check MongoDB Atlas IP whitelist includes your IP
- [ ] Ensure database exists and credentials are valid

## Deployment

### Pre-Deployment Checklist
- [ ] Test gift card creation on staging store
- [ ] Test email delivery with production SMTP
- [ ] Verify all environment variables are configured
- [ ] Set up MongoDB backups
- [ ] Configure MongoDB Atlas network access
- [ ] Test error scenarios

### Deploy to Shopify
```bash
npm run deploy
```

Follow prompts to deploy your app to Shopify's infrastructure.

## Performance Notes

- Email transporter is cached in memory for performance
- MongoDB connections are pooled
- No blocking operations for gift card creation
- Graceful error handling allows video approval even if gift card creation fails

## Security

- ✅ All credentials stored in environment variables
- ✅ SMTP password never logged
- ✅ Shopify OAuth for admin authentication
- ✅ Gift cards created via secure Shopify Admin API
- ✅ Shop validation on all database queries
- ✅ Email sent only to video uploader

## License

MIT

## Support

For issues or questions:
1. Check the documentation in the `docs/` folder
2. Review [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for setup help
3. See [WALKTHROUGH.md](docs/WALKTHROUGH.md) for testing procedures
4. Check terminal logs: `npm run dev`
