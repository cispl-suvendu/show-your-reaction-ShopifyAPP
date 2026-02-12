import mongoose from "mongoose";

const GiftCardSchema = new mongoose.Schema({
  shop: { type: String, required: true },
  videoId: { type: String, required: true },
  uploaderEmail: { type: String, required: true },
  uploaderName: { type: String, required: true },
  shopifyGiftCardId: { type: String, required: true },
  giftCardCode: { type: String },
  lastCharacters: { type: String },
  giftCardValue: { type: Number, required: true },
  currency: { type: String, default: "USD" },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const GiftCard =
  mongoose.models.GiftCard || mongoose.model("GiftCard", GiftCardSchema);

export default GiftCard;

/**
 * Create a gift card via Shopify Admin API
 */
export async function createShopifyGiftCard({
  shopifyClient,
  initialBalance,
  currency = "USD",
  note = "Promotional gift card",
  customerId = null,
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
          initialValue {
            amount
            currencyCode
          }
          createdAt
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
    const input = {
      initialValue: initialBalance.toString(),
      note: note,
    };

    if (customerId) {
      input.customerId = customerId;
    }

    const variables = { input };
    
    console.log("📤 Creating gift card with variables:", JSON.stringify(variables, null, 2));

    // Call the GraphQL client and await the response
    const response = await shopifyClient(mutation, { variables });
    
    console.log("📥 Response type:", typeof response);
    console.log("📥 Response is Response object:", response instanceof Response);
    
    // If it's a Response object, we need to parse the JSON
    let data;
    if (response instanceof Response || response.json) {
      console.log("🔄 Parsing JSON from Response object...");
      data = await response.json();
      console.log("✅ Parsed JSON data:", JSON.stringify(data, null, 2));
    } else {
      // Already parsed
      data = response;
      console.log("✅ Using direct response data:", JSON.stringify(data, null, 2));
    }

    // Check for GraphQL errors
    if (data.errors) {
      console.error("❌ GraphQL Errors:", data.errors);
      throw new Error(
        `GraphQL Error: ${data.errors.map((e) => e.message).join(", ")}`
      );
    }

    // Get the result
    const giftCardCreateResult = data.data?.giftCardCreate;
    
    if (!giftCardCreateResult) {
      console.error("❌ No giftCardCreate in response");
      console.error("Response data:", JSON.stringify(data, null, 2));
      throw new Error("No giftCardCreate data in response");
    }

    if (giftCardCreateResult.userErrors?.length > 0) {
      console.error("❌ Shopify User Errors:", giftCardCreateResult.userErrors);
      throw new Error(
        `Shopify API Error: ${giftCardCreateResult.userErrors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    const giftCard = giftCardCreateResult.giftCard;

    if (!giftCard) {
      throw new Error("Gift card creation failed - no gift card returned");
    }

    console.log("✅ Gift card created successfully:", {
      id: giftCard.id,
      lastCharacters: giftCard.lastCharacters,
    });

    return {
      id: giftCard.id,
      lastCharacters: giftCard.lastCharacters,
      initialValue: giftCard.initialValue?.amount || initialBalance,
      currencyCode: giftCard.initialValue?.currencyCode || currency,
    };
  } catch (error) {
    console.error("❌ Failed to create Shopify gift card:", error.message);
    throw error;
  }
}

/**
 * Find or create a Shopify customer by email
 */
export async function findOrCreateCustomer({
  shopifyClient,
  email,
  firstName = "",
  lastName = "",
}) {
  if (!shopifyClient || !email) {
    return null;
  }

  try {
    const searchQuery = `
      query SearchCustomer($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
            }
          }
        }
      }
    `;

    console.log("🔍 Searching for customer:", email);

    const response = await shopifyClient(searchQuery, {
      variables: { query: `email:${email}` },
    });

    // Parse response if needed
    let data;
    if (response instanceof Response || response.json) {
      data = await response.json();
    } else {
      data = response;
    }

    const existingCustomer = data.data?.customers?.edges?.[0]?.node;

    if (existingCustomer) {
      console.log("✅ Found existing customer:", existingCustomer.id);
      return existingCustomer.id;
    }

    console.log("📝 Creating new customer for:", email);
    
    const createMutation = `
      mutation CreateCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const createResponse = await shopifyClient(createMutation, {
      variables: {
        input: {
          email: email,
          firstName: firstName || email.split('@')[0],
          lastName: lastName || "",
        },
      },
    });

    // Parse response if needed
    let createData;
    if (createResponse instanceof Response || createResponse.json) {
      createData = await createResponse.json();
    } else {
      createData = createResponse;
    }
    
    if (createData.data?.customerCreate?.userErrors?.length > 0) {
      console.error("❌ Customer creation errors:", createData.data.customerCreate.userErrors);
      return null;
    }

    const newCustomer = createData.data?.customerCreate?.customer;
    if (newCustomer) {
      console.log("✅ Created new customer:", newCustomer.id);
      return newCustomer.id;
    }

    return null;
  } catch (error) {
    console.error("❌ Failed to find/create customer:", error);
    return null;
  }
}

/**
 * Get gift card code using REST Admin API
 */
export async function getGiftCardCodeREST({
  shop,
  accessToken,
  giftCardId,
}) {
  const numericId = giftCardId.includes('gid://') 
    ? giftCardId.split('/').pop() 
    : giftCardId;

  const url = `https://${shop}/admin/api/2024-01/gift_cards/${numericId}.json`;

  try {
    console.log(`🔍 Fetching gift card code from REST API...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ REST API Error: ${response.status}`, errorText);
      throw new Error(`REST API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log("✅ Gift card code retrieved:", data.gift_card.code);

    return {
      code: data.gift_card.code,
      balance: data.gift_card.balance,
      lastCharacters: data.gift_card.last_characters,
    };
  } catch (error) {
    console.error("❌ Failed to get gift card code via REST:", error);
    throw error;
  }
}

export async function saveGiftCardRecord({
  shop,
  videoId,
  uploaderEmail,
  uploaderName,
  shopifyGiftCardId,
  giftCardCode = null,
  lastCharacters,
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
      lastCharacters,
      giftCardValue,
      currency,
    });

    console.log(`✅ Gift card record saved: ${giftCard._id}`);
    return giftCard;
  } catch (error) {
    console.error("❌ Failed to save gift card record:", error);
    throw error;
  }
}

export async function updateGiftCardCode(giftCardDbId, code) {
  try {
    const giftCard = await GiftCard.findByIdAndUpdate(
      giftCardDbId,
      { giftCardCode: code },
      { new: true }
    );

    console.log(`✅ Gift card code updated`);
    return giftCard;
  } catch (error) {
    console.error("❌ Failed to update gift card code:", error);
    throw error;
  }
}

export async function markGiftCardEmailSent(giftCardId, success = true) {
  try {
    const update = {
      emailSent: success,
      emailSentAt: success ? new Date() : null,
    };

    const giftCard = await GiftCard.findByIdAndUpdate(giftCardId, update, {
      new: true,
    });

    console.log(`✅ Gift card email status updated: ${success}`);
    return giftCard;
  } catch (error) {
    console.error("❌ Failed to update gift card email status:", error);
    throw error;
  }
}

export async function getGiftCardByVideoId(videoId) {
  try {
    return await GiftCard.findOne({ videoId });
  } catch (error) {
    console.error("❌ Failed to find gift card:", error);
    return null;
  }
}

export async function getShopGiftCards(shop, options = { limit: 100, skip: 0 }) {
  try {
    return await GiftCard.find({ shop })
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip(options.skip);
  } catch (error) {
    console.error("❌ Failed to fetch gift cards:", error);
    return [];
  }
}