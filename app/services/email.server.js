import nodemailer from "nodemailer";

// Initialize transporter (cached for performance)
let emailTransporter = null;

/**
 * Get or create email transporter
 * @returns {Promise<nodemailer.Transporter>}
 */
async function getEmailTransporter() {
  if (emailTransporter) {
    return emailTransporter;
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  // Validate SMTP configuration
  if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
    throw new Error(
      "Missing SMTP configuration. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables."
    );
  }

  emailTransporter = nodemailer.createTransport(smtpConfig);

  // Verify connection
  try {
    await emailTransporter.verify();
    console.log("✅ Email transporter ready");
  } catch (error) {
    console.error("❌ Email transporter verification failed:", error);
    emailTransporter = null;
    throw error;
  }

  return emailTransporter;
}

/**
 * Send gift card email to customer
 * @param {Object} params
 * @param {string} params.email - Customer email address
 * @param {string} params.uploaderName - Customer name
 * @param {string} params.giftCardCode - Shopify gift card code
 * @param {number} params.giftCardValue - Gift card value in cents
 * @param {string} params.shopName - Shopify store name
 * @param {string} params.shopDomain - Shopify store domain
 * @returns {Promise<Object>} - Email send result
 */
export async function sendGiftCardEmail({
  email,
  uploaderName,
  giftCardCode,
  giftCardValue,
  shopName,
  shopDomain,
}) {
  try {
    // Validate inputs
    if (!email || !giftCardCode || !giftCardValue || !shopDomain) {
      throw new Error("Missing required parameters for gift card email");
    }

    const transporter = await getEmailTransporter();

    const giftCardValueFormatted = (giftCardValue / 100).toFixed(2);
    const storeUrl = `https://${shopDomain}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              padding-bottom: 20px;
              border-bottom: 2px solid #007c5a;
            }
            .header h1 {
              color: #007c5a;
              margin: 0;
              font-size: 28px;
            }
            .content {
              padding: 30px 0;
            }
            .greeting {
              font-size: 16px;
              margin-bottom: 20px;
            }
            .gift-card-section {
              background-color: #f9f9f9;
              border: 2px dashed #007c5a;
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
              text-align: center;
            }
            .gift-card-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 10px;
            }
            .gift-card-code {
              background-color: #ffffff;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 15px;
              font-family: 'Monaco', 'Courier New', monospace;
              font-size: 18px;
              font-weight: bold;
              color: #007c5a;
              letter-spacing: 2px;
              margin: 15px 0;
              word-break: break-all;
            }
            .gift-card-value {
              font-size: 24px;
              font-weight: bold;
              color: #007c5a;
              margin: 15px 0;
            }
            .instructions {
              background-color: #f0f7f5;
              border-left: 4px solid #007c5a;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .instructions h3 {
              margin-top: 0;
              color: #007c5a;
            }
            .instructions ol {
              padding-left: 20px;
              margin: 10px 0;
            }
            .instructions li {
              margin-bottom: 10px;
            }
            .cta-button {
              display: inline-block;
              background-color: #007c5a;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 4px;
              margin: 20px 0;
              font-weight: bold;
              transition: background-color 0.3s;
            }
            .cta-button:hover {
              background-color: #005a45;
            }
            .footer {
              border-top: 2px solid #f0f0f0;
              padding-top: 20px;
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #999;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎁 Gift Card Reward</h1>
            </div>

            <div class="content">
              <div class="greeting">
                <p>Hi ${uploaderName},</p>
                <p>Thank you for uploading a video to ${shopName}! Your contribution has been approved, and we'd like to reward you with a gift card.</p>
              </div>

              <div class="gift-card-section">
                <div class="gift-card-label">Your Gift Card</div>
                <div class="gift-card-value">$${giftCardValueFormatted}</div>
                <div class="gift-card-code">${giftCardCode}</div>
              </div>

              <div class="instructions">
                <h3>How to Use Your Gift Card:</h3>
                <ol>
                  <li>Visit ${storeUrl}</li>
                  <li>Add items to your cart</li>
                  <li>At checkout, enter your gift card code: <strong>${giftCardCode}</strong></li>
                  <li>Your $${giftCardValueFormatted} will be applied to your purchase</li>
                </ol>
              </div>

              <div style="text-align: center;">
                <a href="${storeUrl}" class="cta-button">Start Shopping</a>
              </div>

              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                <strong>Gift Card Details:</strong><br>
                Value: $${giftCardValueFormatted}<br>
                Code: ${giftCardCode}<br>
                Store: ${storeUrl}
              </p>

              <p style="font-size: 12px; color: #999; margin-top: 20px;">
                This gift card can be used for any product on our store and has no expiration date. If you have any questions, please contact our support team.
              </p>
            </div>

            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${shopName}. All rights reserved.</p>
              <p>This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Gift Card Reward

Hi ${uploaderName},

Thank you for uploading a video to ${shopName}! Your contribution has been approved, and we'd like to reward you with a gift card.

Your Gift Card
Value: $${giftCardValueFormatted}
Code: ${giftCardCode}

How to Use Your Gift Card:
1. Visit ${storeUrl}
2. Add items to your cart
3. At checkout, enter your gift card code: ${giftCardCode}
4. Your $${giftCardValueFormatted} will be applied to your purchase

Gift Card Details:
- Value: $${giftCardValueFormatted}
- Code: ${giftCardCode}
- Store: ${storeUrl}

This gift card can be used for any product on our store and has no expiration date. If you have any questions, please contact our support team.

© ${new Date().getFullYear()} ${shopName}. All rights reserved.
    `;

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: email,
      subject: `🎁 Your Gift Card from ${shopName} ($${giftCardValueFormatted})`,
      html: htmlContent,
      text: textContent,
      replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_USER,
    });

    console.log(`✅ Gift card email sent to ${email}:`, result.messageId);

    return {
      success: true,
      messageId: result.messageId,
      email,
      giftCardCode,
    };
  } catch (error) {
    console.error(
      `❌ Failed to send gift card email to ${email}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Test email configuration
 * @returns {Promise<Object>}
 */
export async function testEmailConfig() {
  try {
    const transporter = await getEmailTransporter();
    const result = await transporter.verify();
    return {
      success: result,
      message: "SMTP configuration is valid and email service is ready",
    };
  } catch (error) {
    return {
      success: false,
      message: "SMTP configuration failed: " + error.message,
      error: error.message,
    };
  }
}
