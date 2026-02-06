import mongoose from "mongoose";

// Gift Card schema for tracking created gift cards
const GiftCardSchema = new mongoose.Schema({
  shop: { type: String, required: true },
  videoId: { type: String, required: true }, // Reference to the approved video
  uploaderEmail: { type: String, required: true },
  uploaderName: { type: String, required: true },
  shopifyGiftCardId: { type: String, required: true }, // Shopify's internal ID
  giftCardCode: { type: String, required: true }, // The code to use
  giftCardValue: { type: Number, required: true }, // Value in cents
  currency: { type: String, default: "USD" },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Use existing model if defined (hmr safe)
const GiftCard =
  mongoose.models.GiftCard || mongoose.model("GiftCard", GiftCardSchema);

export default GiftCard;

/**
 * Create a gift card via Shopify Admin API
 * @param {Object} params
 * @param {Object} params.shopifyClient - Authenticated Shopify GraphQL client function
 * @param {number} params.initialBalance - Gift card balance in dollars
 * @param {string} params.currency - Currency code (default: USD)
 * @returns {Promise<Object>} - Gift card details {id, code}
 */
export async function createShopifyGiftCard({
  shopifyClient,
  initialBalance,
  currency = "USD",
}) {
  if (!shopifyClient) {
    throw new Error("Shopify client is required to create a gift card");
  }

  if (!initialBalance || initialBalance <= 0) {
    throw new Error("Gift card balance must be greater than 0");
  }

  const mutation = `
    mutation CreateGiftCard($input: GiftCardCreateInput!) {
      giftCardCreate(input: $input) {
        giftCard {
          id
          lastCharacters
        }
        userErrors {
          code
          field
          message
        }
      }
    }
  `;

  try {
    console.log("GraphQL Mutation Request:", {
      query: mutation,
      variables: { input: { initialBalance: initialBalance, currencyCode: currency } }
    });
    
    const response = await shopifyClient(mutation, {
      variables: {
        input: {
          initialValue: initialBalance.toString(),
        },
      },
    });

    console.log("GraphQL Response received:", {
      hasErrors: !!response.errors,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : null
    });

    // Check for GraphQL-level errors
    if (response.errors) {
      console.error("❌ GraphQL Errors (API Level):");
      response.errors.forEach((error, index) => {
        console.error(`  Error ${index + 1}:`, error.message);
        if (error.extensions) {
          console.error(`    Code: ${error.extensions.code}`);
          console.error(`    Details:`, error.extensions);
        }
      });
      throw new Error(
        `GraphQL Error: ${response.errors.map((e) => e.message).join(", ")}`
      );
    }

    // Check for mutation-level errors
    const giftCardCreateResult = response.data?.giftCardCreate;
    if (!giftCardCreateResult) {
      console.error("❌ No giftCardCreate result in response");
      console.error("Response data keys:", Object.keys(response.data || {}));
      throw new Error("No giftCardCreate data in response");
    }

    if (giftCardCreateResult.userErrors && giftCardCreateResult.userErrors.length > 0) {
      console.error("❌ Shopify User Errors (Mutation Level):");
      giftCardCreateResult.userErrors.forEach((error, index) => {
        console.error(`  Error ${index + 1}:`, error.message);
        console.error(`    Code: ${error.code}`);
        console.error(`    Field: ${error.field}`);
      });
      throw new Error(
        `Shopify API Error: ${giftCardCreateResult.userErrors.map((e) => e.message).join(", ")}`
      );
    }

    const giftCard = response.data.giftCardCreate.giftCard;

    return {
      id: giftCard.id,
      lastCharacters: giftCard.lastCharacters,
      initialBalance: initialBalance,
      currencyCode: currency,
    };
  } catch (error) {
    console.error("Failed to create Shopify gift card:", error);
    throw error;
  }
}

/**
 * Resend gift card code for a gift card
 * Shopify requires a separate API call to generate/resend the code
 * @param {Object} params
 * @param {Object} params.shopifyClient - Authenticated Shopify GraphQL client function
 * @param {string} params.giftCardId - Shopify gift card ID (gid format)
 * @returns {Promise<string>} - The gift card code
 */
export async function resendGiftCardCode({
  shopifyClient,
  giftCardId,
}) {
  if (!shopifyClient) {
    throw new Error("Shopify client is required");
  }

  if (!giftCardId) {
    throw new Error("Gift card ID is required");
  }

  const query = `
    query GetGiftCard($id: ID!) {
      giftCard(id: $id) {
        id
        code
        lastCharacters
        initialBalance {
          amount
          currencyCode
        }
      }
    }
  `;

  try {
    const response = await shopifyClient(query, {
      variables: {
        id: giftCardId,
      },
    });

    if (response.errors) {
      throw new Error(response.errors[0].message);
    }

    const giftCard = response.data.giftCard;
    if (!giftCard) {
      throw new Error("Gift card not found");
    }

    // If code exists, return it
    if (giftCard.code) {
      return giftCard.code;
    }

    // Note: In recent Shopify API versions, the code is automatically generated
    // If not available, we may need to use a different endpoint or approach
    console.warn(
      "Gift card code not immediately available. It should be generated by Shopify."
    );

    return `*${giftCard.lastCharacters}`;
  } catch (error) {
    console.error("Failed to get gift card code:", error);
    throw error;
  }
}

/**
 * Save gift card record to database
 * @param {Object} params
 * @param {string} params.shop - Shopify shop domain
 * @param {string} params.videoId - Video ID
 * @param {string} params.uploaderEmail - Uploader email
 * @param {string} params.uploaderName - Uploader name
 * @param {string} params.shopifyGiftCardId - Shopify gift card ID
 * @param {string} params.giftCardCode - Gift card code
 * @param {number} params.giftCardValue - Value in cents
 * @param {string} params.currency - Currency code
 * @returns {Promise<Object>} - Saved gift card record
 */
export async function saveGiftCardRecord({
  shop,
  videoId,
  uploaderEmail,
  uploaderName,
  shopifyGiftCardId,
  giftCardCode,
  giftCardValue,
  currency = "USD",
}) {
  try {
    const giftCard = await GiftCard.create({
      shop,
      videoId,
      uploaderEmail,
      uploaderName,
      shopifyGiftCardId,
      giftCardCode,
      giftCardValue,
      currency,
    });

    console.log(`✅ Gift card record saved: ${giftCard._id}`);
    return giftCard;
  } catch (error) {
    console.error("Failed to save gift card record:", error);
    throw error;
  }
}

/**
 * Update gift card record to mark email as sent
 * @param {string} giftCardId - Database gift card ID
 * @param {boolean} success - Whether email was sent successfully
 * @returns {Promise<Object>}
 */
export async function markGiftCardEmailSent(giftCardId, success = true) {
  try {
    const update = {
      emailSent: success,
      emailSentAt: success ? new Date() : null,
    };

    const giftCard = await GiftCard.findByIdAndUpdate(giftCardId, update, {
      new: true,
    });

    return giftCard;
  } catch (error) {
    console.error("Failed to update gift card email status:", error);
    throw error;
  }
}

/**
 * Get gift card by video ID
 * @param {string} videoId
 * @returns {Promise<Object|null>}
 */
export async function getGiftCardByVideoId(videoId) {
  try {
    return await GiftCard.findOne({ videoId });
  } catch (error) {
    console.error("Failed to find gift card:", error);
    return null;
  }
}

/**
 * Get all gift cards for a shop
 * @param {string} shop
 * @param {Object} options - Query options {limit, skip, sort}
 * @returns {Promise<Array>}
 */
export async function getShopGiftCards(
  shop,
  options = { limit: 100, skip: 0 }
) {
  try {
    return await GiftCard.find({ shop })
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip(options.skip);
  } catch (error) {
    console.error("Failed to fetch gift cards:", error);
    return [];
  }
}
