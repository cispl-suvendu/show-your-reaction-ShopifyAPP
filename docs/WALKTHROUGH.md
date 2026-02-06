# Verification Walkthrough - Show Your Reaction

Follow these steps to verify the app functionality, including the new Gift Card Reward feature.

## Prerequisites Setup

### 1. Environment Configuration
Edit `.env` and ensure you have all required variables:

```bash
# Core MongoDB (Required)
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/dbname"

# Gift Card Configuration (Recommended)
ENABLE_GIFT_CARDS=true
ENABLE_GIFT_CARD_EMAIL=true
GIFT_CARD_AMOUNT=10
GIFT_CARD_CURRENCY=USD
SHOPIFY_SHOP_NAME="My Test Store"

# SMTP Configuration (Required for emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_EMAIL=noreply@yourstore.com
SMTP_REPLY_TO=support@yourstore.com
```

### 2. Start the App
```bash
npm run dev
```

- Press `p` to open Partner Dashboard if needed
- Install the app on your development store when prompted

---

## Core Video Upload & Approval Flow

### 3. Configure Storefront
1. Go to **Online Store > Themes > Customize**
2. Navigate to a page (or create a new "Reactions" page)
3. **Add Block**: Search for "Upload Form"
   - Add it to a section
   - Save
4. **Add Block**: Search for "Video Gallery"
   - Add it below the form
   - Save

### 4. Test Customer Upload
1. Open the storefront page preview
2. Fill in:
   - **Name**: e.g., "John Doe"
   - **Email**: e.g., "john@example.com"
   - **Video File**: Select a small test video
3. Click **"Upload Reaction"**
4. **Verify**:
   - ✅ Success message appears
   - ✅ Video appears in admin with status "Pending"

### 5. Test Video Approval (without Gift Cards)
1. Go to **Shopify Admin > Apps > Show Your Reaction**
2. Find your uploaded video
3. **Verify**:
   - ✅ Video shows in list
   - ✅ Status badge shows "Pending"
   - ✅ Thumbnail displays
   - ✅ Uploader name and email visible
4. Click **Approve** button
5. **Verify**:
   - ✅ Status changes to "Approved"
   - ✅ Video now appears in the Storefront Gallery

---

## Gift Card Feature Testing

### 6. Test Gift Card Creation

**Before Approval:**
- [ ] Check that `ENABLE_GIFT_CARDS=true` in `.env`
- [ ] Verify SMTP configuration is correct
- [ ] Terminal should show no SMTP errors on startup

**During Approval:**
1. Upload a new test video
2. Go to admin dashboard
3. Click **Approve** on a new video (not the one from step 5)
4. **Check Server Logs** for messages like:
   - ✅ "✅ Gift card created: ..."
   - ✅ "✅ Gift card email sent to ..."
5. **Verify in Admin Dashboard**:
   - ✅ Video shows gift card badge (🎁 Sent or 🎁 Created)

### 7. Test Email Delivery

**Check Email:**
1. Open the email address you configured in the upload form
2. **Verify Email Contains**:
   - ✅ "🎁 Gift Card Reward" subject line
   - ✅ Gift card value ($10 by default)
   - ✅ Unique gift card code (e.g., ABC1234DEF567)
   - ✅ Store link
   - ✅ Instructions for redemption
   - ✅ Professional HTML formatting

**Email Troubleshooting:**
- Check **SMTP configuration**: host, port, user, password
- For Gmail: Use [app-specific password](https://myaccount.google.com/apppasswords), not regular password
- Check server logs for SMTP errors
- Verify email wasn't sent to spam folder

### 8. Test Gift Card Admin Page

1. Go to **Shopify Admin > Apps > Show Your Reaction**
2. Find and click **"Gift Cards"** tab/link
3. **Verify Dashboard Shows**:
   - ✅ List of all created gift cards
   - ✅ Uploader name and email
   - ✅ Gift card code
   - ✅ Gift card value
   - ✅ Email status (Sent/Pending)
   - ✅ Creation date
   - ✅ Total count of gift cards

### 9. Test Gift Card at Checkout

1. **In Storefront:**
   - Add a product to cart
   - Go to checkout
2. **During Payment:**
   - Look for "Gift Card" field
   - Enter the gift card code from the email
3. **Verify**:
   - ✅ Code validates
   - ✅ Gift card amount ($10) is applied
   - ✅ Order total decreases by gift card amount

---

## Error Handling Testing

### 10. Test Error Scenarios

**Scenario 1: SMTP Configuration Disabled**
1. Set `ENABLE_GIFT_CARD_EMAIL=false`
2. Restart app and upload a new video
3. Approve it
4. **Verify**:
   - ✅ Video is marked "Approved"
   - ✅ Gift card is created (if `ENABLE_GIFT_CARDS=true`)
   - ✅ Email is NOT sent
   - ✅ Gift card dashboard shows "emailSent: false"

**Scenario 2: Invalid SMTP Config**
1. Set `SMTP_HOST=invalid.example.com`
2. Check server logs on startup
3. Upload and approve a video
4. **Verify**:
   - ✅ Video is marked "Approved"
   - ✅ Error logged to console
   - ✅ Email failed gracefully
   - ✅ Gift card still created if it succeeded

**Scenario 3: Gift Card Creation Disabled**
1. Set `ENABLE_GIFT_CARDS=false`
2. Upload and approve a video
3. **Verify**:
   - ✅ Video is marked "Approved"
   - ✅ No gift card created
   - ✅ No email sent
   - ✅ Video shows no gift card badge

---

## Database Verification

### 11. Check MongoDB Collections

Connect to your MongoDB database and verify:

**Videos Collection:**
```javascript
db.videos.findOne({status: "approved"})
// Should show:
{
  status: "approved",
  giftCardCreated: true/false,
  giftCardId: "ObjectId or null",
  giftCardEmailSent: true/false,
  approvedAt: ISODate(...)
}
```

**GiftCards Collection:**
```javascript
db.giftcards.find({}).limit(5)
// Should show:
{
  shop: "mystore.myshopify.com",
  videoId: ObjectId("..."),
  uploaderEmail: "john@example.com",
  uploaderName: "John Doe",
  giftCardCode: "ABC1234DEF567",
  giftCardValue: 1000, // In cents
  emailSent: true/false,
  createdAt: ISODate(...)
}
```

---

## Performance & Monitoring

### 12. Check Logs

**During Approval**, terminal should show:
```
✅ Video approved: {videoId}
✅ Gift card created: {giftCardId}
✅ Gift card email sent to {email}: {messageId}
```

**If Errors Occur**, logs will show:
```
❌ Failed to create gift card: {error}
❌ Failed to send gift card email: {error}
```

---

## Full End-to-End Test

### 13. Complete Workflow Test

1. **Customer Action**:
   - [ ] Upload video with name, email, and file

2. **Admin Action**:
   - [ ] View pending video in dashboard
   - [ ] Click "Approve"

3. **System Actions** (automatic):
   - [ ] Gift card created in Shopify
   - [ ] Gift card record saved to MongoDB
   - [ ] Email sent to customer

4. **Verification**:
   - [ ] Video status changed to "Approved"
   - [ ] Video shows gift card status badge
   - [ ] Customer receives email with code
   - [ ] Gift card appears in admin dashboard
   - [ ] Customer can use code at checkout

---

## Troubleshooting Checklist

| Issue | Solution |
|-------|----------|
| Gift card not creating | Check `ENABLE_GIFT_CARDS=true`, verify Shopify API scope has `giftcards:manage`, check logs |
| Email not sending | Check SMTP config, verify Gmail app password, check logs, verify sender email |
| Video not approving | Check MongoDB connection, verify shop domain, check browser console |
| Gallery not showing videos | Check video status is "approved", verify app proxy configured, refresh page |
| Gift card code not visible | Wait a moment, refresh admin page, check database directly |

---

## Next Steps

After successful testing:
1. ✅ Review [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for customization
2. ✅ Check [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for technical details
3. ✅ Deploy to production following the deployment checklist
4. ✅ Monitor logs and email delivery rates
5. ✅ Set up alerts for errors
