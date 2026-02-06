# Gift Card Creation - Quick Test Checklist

## Pre-Test Verification

- [ ] Run `npm install` to ensure all dependencies are installed
- [ ] Check `.env` file has `ENABLE_GIFT_CARDS=true`
- [ ] Check `.env` file has `ENABLE_GIFT_CARD_EMAIL=true`
- [ ] Restart dev server: `npm run dev`
- [ ] Open browser DevTools (F12) → Console tab

## Test Procedure

### 1. Upload a Test Video
- [ ] Go to storefront and upload a video
- [ ] Wait for upload to complete
- [ ] Note the video title/ID

### 2. Approve the Video
- [ ] Go to admin dashboard (`/app`)
- [ ] Find the pending video
- [ ] Click "Approve" button
- [ ] Wait for response

### 3. Check Console Logs
**You should see these exact logs in order:**
```
✓ Gift card feature enabled: true
✓ Admin client available: true
✓ Creating gift card with amount: 10
✓ Gift card created successfully: {id: "...", lastCharacters: "XXXX", ...}
✓ Video updated with gift card: true, <database-id>
✓ Sending email to: <email-address>
✓ Email sent successfully
```

**If you see errors**, check:
- Check for "Failed to create gift card:" → Shopify API issue
- Check for "Failed to send gift card email:" → SMTP issue
- Check for "is not a function" → Code error

### 4. Verify Database Update
In MongoDB, the video should have:
```json
{
  "status": "approved",
  "giftCardCreated": true,
  "giftCardId": "6985bf578e61d390e06cb086",
  "giftCardEmailSent": true,
  "approvedAt": "2026-02-06T10:15:51.048Z"
}
```

### 5. Verify Email Received
- [ ] Check email inbox (uploader's email)
- [ ] Should arrive within 30 seconds
- [ ] Subject: "Your Gift Card Code"
- [ ] Contains gift card code (last 4 characters shown)

### 6. Verify Admin Dashboard UI
- [ ] Refresh admin page
- [ ] Video should show "Approved" badge (green)
- [ ] Video should show "🎁 Sent" badge (green) if email successful
- [ ] Video should show "🎁 Created" badge (orange) if email pending

## Success Criteria

✅ **All of the following must be true:**
1. Console shows all 7 success log messages
2. Video document in MongoDB has `giftCardCreated: true`
3. Video document in MongoDB has `giftCardEmailSent: true`
4. Email is received by uploader within 30 seconds
5. Email contains valid gift card code
6. Admin UI shows both "Approved" and "🎁 Sent" badges

## Common Issues & Solutions

### Issue: "Admin client available: false"
**Solution**: 
- Ensure you're logged in as admin
- Check authentication is working

### Issue: Logs stop at "Creating gift card with amount"
**Solution**:
- Check Shopify API scopes include `write_gift_cards`
- Check `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are correct

### Issue: "Failed to send gift card email"
**Solution**:
- Check SMTP credentials in `.env`
- Check `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are correct
- Try sending a test email from command line:
  ```bash
  node -e "require('./app/services/email.server.js').testEmailConfig()"
  ```

### Issue: Email not received
**Solution**:
- Check spam folder
- Check email address in video document
- Verify SMTP credentials are working
- Check server logs for SMTP errors

## Detailed Debug Steps

### If Console Logs Don't Appear:

1. **Check feature is enabled:**
   ```bash
   cat .env | grep ENABLE_GIFT
   # Should output:
   # ENABLE_GIFT_CARDS=true
   # ENABLE_GIFT_CARD_EMAIL=true
   ```

2. **Check server logs:**
   ```bash
   # Terminal running npm run dev should show:
   # Gift card feature enabled: true
   # Admin client available: true
   ```

3. **Check browser network tab:**
   - Open DevTools → Network tab
   - Click Approve button
   - Look for POST request to `/app`
   - Check response in "Response" tab
   - Should contain `"giftCardResult"` in JSON

### If Email Not Sent:

1. **Test SMTP configuration:**
   ```bash
   node -e "
   const email = require('./app/services/email.server.js');
   email.testEmailConfig().then(result => {
     console.log('Email config test:', result);
   }).catch(err => {
     console.error('Email config error:', err.message);
   });
   "
   ```

2. **Check SMTP credentials:**
   ```bash
   cat .env | grep SMTP_
   ```

3. **Verify sender email is valid:**
   - Check `SMTP_FROM_EMAIL` matches verified sender in SMTP provider

## Rollback Instructions

If something breaks, rollback to previous version:
```bash
# View previous commits
git log --oneline -10

# Rollback to before fix
git revert HEAD

# Or reset to specific commit
git reset --hard <commit-hash>
```

## Next Actions

After verification:
1. ✅ Document any custom SMTP configuration needed
2. ✅ Test with multiple videos
3. ✅ Test with different email addresses
4. ✅ Deploy to production
5. ✅ Monitor email delivery in production

---

**Last Updated**: February 6, 2026
**Status**: Ready for Testing
