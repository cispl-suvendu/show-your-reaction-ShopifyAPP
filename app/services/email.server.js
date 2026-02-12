import nodemailer from "nodemailer";

/**
 * Validates Environment Variables for Email
 * Throws error if configuration is missing to fail fast.
 */
function validateEmailConfig() {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_SENDER"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing Email Configuration: ${missing.join(", ")}. Check your .env file.`
    );
  }
}

/**
 * Creates the Nodemailer Transporter
 * Uses Singleton pattern to prevent creating new connections on every request.
 */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  validateEmailConfig();

  const port = parseInt(process.env.SMTP_PORT || "587");
  
  // Auto-detect secure connection: 
  // Port 465 is usually true (Implicit SSL/TLS)
  // Port 587 is usually false (Explicit STARTTLS)
  const isSecure = process.env.SMTP_SECURE 
    ? process.env.SMTP_SECURE === "true" 
    : port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: isSecure, 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      // Helps with self-signed certs in dev, but strictly validate in prod usually
      rejectUnauthorized: process.env.NODE_ENV === "production",
      ciphers: "SSLv3",
    },
  });

  return transporter;
}

/**
 * Send gift card email to customer
 * @param {Object} params
 * @param {string} params.email - Customer email address
 * @param {string} params.uploaderName - Customer name
 * @param {string} params.giftCardCode - The full code to display
 * @param {number|string} params.giftCardAmount - The FACE VALUE (e.g., 10 or "10.00")
 * @param {string} params.shopName - Name of the shop
 * @param {string} params.shopDomain - myshopify.com domain
 */
export async function sendGiftCardEmail({
  email,
  uploaderName,
  giftCardCode,
  giftCardAmount,
  shopName,
  shopDomain,
}) {
  console.log(`📧 Preparing to send email to ${email}...`);

  try {
    const mailer = getTransporter();

    // Ensure we format the money correctly. 
    // Assumes giftCardAmount is passed as Dollars (e.g. 10). 
    // If passing cents, divide by 100.
    const formattedAmount = parseFloat(giftCardAmount).toFixed(2);
    
    const storeUrl = `https://${shopDomain}`;
    const sender = process.env.SMTP_SENDER || process.env.SMTP_USER;

    // HTML Template
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #008060; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
              .content { background-color: #ffffff; padding: 30px; border: 1px solid #e1e3e5; border-top: none; border-radius: 0 0 8px 8px; }
              .greeting { font-size: 18px; margin-bottom: 20px; }
              .card-container { background-color: #f4f6f8; border: 1px dashed #c4cdd5; border-radius: 8px; padding: 25px; text-align: center; margin: 25px 0; }
              .amount { font-size: 32px; font-weight: bold; color: #008060; margin-bottom: 10px; }
              .code-label { text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #637381; margin-bottom: 5px; }
              .code { font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; color: #212b36; background: #fff; padding: 10px 20px; border-radius: 4px; border: 1px solid #dfe3e8; display: inline-block; letter-spacing: 2px; }
              .button { display: inline-block; background-color: #008060; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
              .footer { text-align: center; font-size: 12px; color: #637381; margin-top: 30px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Here is your Reward! 🎁</h1>
              </div>
              <div class="content">
                  <p class="greeting">Hi ${uploaderName},</p>
                  <p>Thanks for uploading your video! To show our appreciation, here is a gift card you can use on our store.</p>
                  
                  <div class="card-container">
                      <div class="amount">$${formattedAmount}</div>
                      <div class="code-label">Gift Card Code</div>
                      <div class="code">${giftCardCode}</div>
                      <br>
                      <a href="${storeUrl}" class="button">Shop Now</a>
                  </div>
                  
                  <p>Simply enter the code above at checkout to redeem your credit.</p>
              </div>
              <div class="footer">
                  <p>Sent by ${shopName}</p>
                  <p>If you have questions, reply to this email.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const info = await mailer.sendMail({
      from: `"${process.env.SHOPIFY_SHOP_NAME || shopName}" <${sender}>`,
      to: email,
      subject: `You've received a $${formattedAmount} Gift Card from ${shopName}!`,
      html: htmlContent,
      text: `Your video was approved! Here is your $${formattedAmount} gift card code: ${giftCardCode}. Redeem at ${storeUrl}`, // Fallback plain text
    });

    console.log("✅ Email sent successfully via SMTP.");
    console.log("   Message ID:", info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error("❌ Send Mail Error:", error);
    // Rethrow so the calling function knows it failed
    throw new Error(`SMTP Error: ${error.message}`);
  }
}