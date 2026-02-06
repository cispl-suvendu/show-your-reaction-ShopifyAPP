# Quick Start: Gift Card Feature

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure `.env`
Add these variables to your existing `.env` file:

```bash
# Gift Card Feature (copy exactly as shown)
ENABLE_GIFT_CARDS=true
ENABLE_GIFT_CARD_EMAIL=true
GIFT_CARD_AMOUNT=10
GIFT_CARD_CURRENCY=USD
SHOPIFY_SHOP_NAME="My Store"

# Gmail Setup (easiest option)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
SMTP_FROM_EMAIL=noreply@mystore.com
SMTP_REPLY_TO=support@mystore.com
```

**For Gmail:**
1. Enable 2FA: https://myaccount.google.com/security
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use 16-char password in `SMTP_PASS`

### 3. Start App
```bash
npm run dev
```

### 4. Test the Flow
1. Upload a video from storefront
2. Go to **Apps > Show Your Reaction**
3. Click "Approve"
4. Check your email for gift card code

## Features Working

✅ Videos upload to MongoDB
✅ Admin approves videos
✅ Gift cards auto-created
✅ Emails sent automatically
✅ Status badges show in admin
✅ Gift card dashboard available

## Configuration Options

| Variable | Options | Purpose |
|----------|---------|---------|
| `ENABLE_GIFT_CARDS` | `true`/`false` | Turn feature on/off |
| `ENABLE_GIFT_CARD_EMAIL` | `true`/`false` | Send emails? |
| `GIFT_CARD_AMOUNT` | Any number | Value in $ |
| `GIFT_CARD_CURRENCY` | `USD`, `EUR`, etc | Currency |

## Troubleshooting

**Email not sending?**
- Check SMTP_USER and SMTP_PASS
- For Gmail: Use app password, not regular password
- Check terminal for error messages

**Gift card not creating?**
- Verify `ENABLE_GIFT_CARDS=true`
- Check Shopify API scopes include `giftcards:manage`
- Check terminal logs

**Can't find Admin page?**
- Go to: **Apps > Show Your Reaction**
- Should see video list with status badges

## More Information

- Full setup: See [README.md](README.md)
- Configuration: See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)
- Testing: See [WALKTHROUGH.md](docs/WALKTHROUGH.md)
- Troubleshooting: See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) § Troubleshooting

## Email Providers

**Gmail** (Recommended for testing)
- App Password: https://myaccount.google.com/apppasswords
- Port: 587, Secure: false

**SendGrid**
- `SMTP_HOST=smtp.sendgrid.net`
- `SMTP_USER=apikey`
- `SMTP_PASS=your-api-key`

**Mailgun**
- `SMTP_HOST=smtp.mailgun.org`
- `SMTP_PORT=587`

## Need Help?

1. Check [WALKTHROUGH.md](docs/WALKTHROUGH.md) for step-by-step testing
2. Review [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for detailed info
3. Check terminal logs for error messages
4. See [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) for full details
