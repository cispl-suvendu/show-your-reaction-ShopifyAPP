# Show Your Reaction - Shopify App

A Shopify app that allows customers to upload video reactions, which can be managed by store admins and displayed on the storefront.

## Features

- 📹 **Video Upload** - Customers can upload videos from the storefront
- 🗄️ **MongoDB GridFS Storage** - Videos stored directly in MongoDB (no external cloud services)
- ✅ **Admin Approval** - Review and approve videos before they appear on the storefront
- 🎨 **Customizable Gallery** - Display approved videos in a responsive grid
- 🔒 **Secure** - Built with Shopify's authentication and App Proxy

## Tech Stack

- **Framework**: Remix (Shopify App Template)
- **UI**: Shopify Polaris
- **Database**: MongoDB + GridFS
- **Storage**: MongoDB GridFS (no external services needed)

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Shopify Partner account
- Development store

### Installation

1. **Clone and install:**
   ```bash
   cd show-your-reaction
   npm install
   ```

2. **Configure environment:**
   Create/edit `.env` file:
   ```bash
   MONGODB_URI="your-mongodb-connection-string"
   ```

3. **Start development:**
   ```bash
   npm run dev
   ```

4. **Install on your store** when prompted

## Documentation

- 📖 [**Developer Guide**](docs/DEVELOPER_GUIDE.md) - Complete guide for developers
- 🔧 [**Implementation Plan**](docs/IMPLEMENTATION_PLAN.md) - Technical architecture
- ✅ [**Walkthrough**](docs/WALKTHROUGH.md) - Testing and verification guide
- 📋 [**Task List**](docs/TASK.md) - Development checklist

## Usage

### For Store Admins
1. Go to **Apps > Show Your Reaction** in Shopify Admin
2. View uploaded videos
3. Click **Approve** to make videos visible on storefront
4. Click **Delete** to remove videos

### For Customers
1. Visit a page with the "Upload Form" block
2. Select a video file
3. Click "Upload Reaction"
4. Wait for admin approval

### For Theme Developers
Add these blocks to your theme:
- **Upload Form** - Allows customers to upload videos
- **Video Gallery** - Displays approved videos

## Project Structure

```
app/
├── models/          # MongoDB schemas
├── services/        # GridFS storage service
└── routes/          # API endpoints and admin UI

extensions/
└── video-gallery/   # Theme app extension blocks
    ├── blocks/      # Liquid templates
    └── assets/      # JavaScript and CSS

docs/                # Documentation
```

## Development

See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for detailed development instructions.

## Deployment

```bash
npm run deploy
```

## License

MIT

## Support

For issues or questions, check the documentation in the `docs/` folder.
