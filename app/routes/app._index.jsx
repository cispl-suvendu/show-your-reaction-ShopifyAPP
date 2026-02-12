import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Button,
    InlineStack,
    Thumbnail,
    Badge,
    IndexTable,
    useIndexResourceState
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import Video from "../models/video.server";
import { deleteFileFromGridFS } from "../services/gridfs.server";
import { 
    createShopifyGiftCard, 
    saveGiftCardRecord, 
    markGiftCardEmailSent,
    getGiftCardCodeREST ,
    findOrCreateCustomer 
} from "../models/giftcard.server";
import { sendGiftCardEmail } from "../services/email.server";
import connection from "../db.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    await connection;

    const videos = await Video.find({ shop: session.shop }).sort({ createdAt: -1 });

    const formattedVideos = videos.map(v => ({
        id: v._id.toString(),
        fileId: v.fileId,
        status: v.status,
        createdAt: v.createdAt,
        videoTitle: `Video ${v.fileId.substr(0, 5)}...`,
        thumbnailLink: v.thumbnailLink,
        link: v.webViewLink,
        uploaderName: v.uploaderName || 'Anonymous',
        uploaderEmail: v.uploaderEmail || 'N/A',
        giftCardCreated: v.giftCardCreated,
        giftCardEmailSent: v.giftCardEmailSent
    }));

    return json({ videos: formattedVideos });
};

export const action = async ({ request }) => {
    const { session, admin } = await authenticate.admin(request);
    await connection;
    const formData = await request.formData();

    const intent = formData.get("intent");
    const videoId = formData.get("id");

    if (!videoId) return json({ error: "Missing video ID" }, { status: 400 });

    if (intent === "approve") {
        try {
            const video = await Video.findOne({ _id: videoId, shop: session.shop });
            
            if (!video) {
                return json({ error: "Video not found" }, { status: 404 });
            }

            // Update video status to approved
            video.status = "approved";
            video.approvedAt = new Date();
            await video.save();

            // Attempt to create and send gift card
            let giftCardResult = null;
            console.log("🎁 Gift card feature enabled:", process.env.ENABLE_GIFT_CARDS === "true");
            console.log("🔑 Admin client available:", !!admin);
            
            if (process.env.ENABLE_GIFT_CARDS === "true" && admin) {
                try {
        const giftCardAmount = parseFloat(process.env.GIFT_CARD_AMOUNT || "10");
        const giftCardValueCents = Math.round(giftCardAmount * 100);

        console.log("💰 Creating gift card with amount: $" + giftCardAmount);

        // Optional: Find or create customer to link gift card
                let customerId = null;
                if (video.uploaderEmail && process.env.LINK_GIFT_CARD_TO_CUSTOMER === "true") {
                    try {
                        console.log("👤 Finding/creating customer for:", video.uploaderEmail);
                        customerId = await findOrCreateCustomer({
                            shopifyClient: admin.graphql,
                            email: video.uploaderEmail,
                            firstName: video.uploaderName || "",
                            lastName: "",
                        });
                        console.log("👤 Customer ID:", customerId || "Not created");
                    } catch (customerError) {
                        console.warn("⚠️  Failed to create customer, proceeding without:", customerError.message);
                    }
                }

                // Step 1: Create gift card via Shopify GraphQL API
                const shopifyGiftCard = await createShopifyGiftCard({
                    shopifyClient: async (query, options) => {
                        const response = await admin.graphql(query, options);
                        const json = await response.json();
                        return json;
                    },
                    initialBalance: giftCardAmount,
                    currency: process.env.GIFT_CARD_CURRENCY || "USD",
                    note: `Video approval reward for ${video.uploaderName || 'user'}`,
                    customerId: customerId,  // ← Pass customer ID (or null)
                });

                    if (!shopifyGiftCard || !shopifyGiftCard.id) {
                        throw new Error("Gift card creation returned no valid data.");
                    }

                    console.log("✅ Gift card created in Shopify:", {
                        id: shopifyGiftCard.id,
                        lastCharacters: shopifyGiftCard.lastCharacters
                    });

                    // Step 2: Get the full gift card code using REST API
                    let fullGiftCardCode = null;
                    try {
                        console.log("🔍 Fetching full gift card code via REST API...");
                        
                        const giftCardDetails = await getGiftCardCodeREST({
                            shop: session.shop,
                            accessToken: session.accessToken,
                            giftCardId: shopifyGiftCard.id
                        });

                        fullGiftCardCode = giftCardDetails.code;
                        console.log("✅ Full gift card code retrieved:", fullGiftCardCode);
                    } catch (restError) {
                        console.error("⚠️  Failed to retrieve full code via REST API:", restError.message);
                        console.log("📝 Will use last characters instead");
                        // Fallback to last characters if REST fails
                        fullGiftCardCode = shopifyGiftCard.lastCharacters 
                            ? `****${shopifyGiftCard.lastCharacters}` 
                            : "PENDING";
                    }

                    // Step 3: Save gift card record to database
                    const giftCardRecord = await saveGiftCardRecord({
                        shop: session.shop,
                        videoId: videoId,
                        uploaderEmail: video.uploaderEmail,
                        uploaderName: video.uploaderName,
                        shopifyGiftCardId: shopifyGiftCard.id,
                        giftCardCode: fullGiftCardCode,
                        lastCharacters: shopifyGiftCard.lastCharacters,
                        giftCardValue: giftCardValueCents,
                        currency: process.env.GIFT_CARD_CURRENCY || "USD",
                    });

                    // Step 4: Update video with gift card info
                    video.giftCardCreated = true;
                    video.giftCardId = giftCardRecord._id.toString();
                    await video.save();

                    console.log("📊 Video updated with gift card:", {
                        giftCardCreated: video.giftCardCreated,
                        giftCardId: video.giftCardId
                    });

                    // Step 5: Send email with gift card details
                    console.log("📧 Email Configuration Check:");
                    console.log("  - Uploader Email:", video.uploaderEmail || "❌ MISSING");
                    console.log("  - ENABLE_GIFT_CARD_EMAIL:", process.env.ENABLE_GIFT_CARD_EMAIL);
                    console.log("  - SMTP_HOST:", process.env.SMTP_HOST ? "✓ Set" : "✗ Missing");
                    console.log("  - SMTP_USER:", process.env.SMTP_USER ? "✓ Set" : "✗ Missing");
                    console.log("  - SMTP_PASS:", process.env.SMTP_PASS ? "✓ Set" : "✗ Missing");
                    
                    if (video.uploaderEmail && process.env.ENABLE_GIFT_CARD_EMAIL === "true") {
                        try {
                            console.log("🚀 Attempting to send email to:", video.uploaderEmail);
                            
                            await sendGiftCardEmail({
                                email: video.uploaderEmail,
                                uploaderName: video.uploaderName || "Valued Customer",
                                giftCardCode: fullGiftCardCode,
                                // FIX: Pass the dollar amount directly, not cents
                                giftCardAmount: giftCardAmount, 
                                shopName: process.env.SHOPIFY_SHOP_NAME || session.shop,
                                shopDomain: session.shop,
                            });

                            // Mark email as sent in Database
                            video.giftCardEmailSent = true;
                            await video.save();
                            await markGiftCardEmailSent(giftCardRecord._id.toString(), true);

                            console.log("✅ Email sent successfully to:", video.uploaderEmail);

                            giftCardResult = {
                                created: true,
                                emailSent: true,
                                giftCardCode: fullGiftCardCode,
                                message: "Gift card created and email sent successfully"
                            };
                        } catch (emailError) {
                            console.error("❌ Failed to send gift card email (Action Layer):");
                            console.error("   Error Message:", emailError.message);
                            
                            // Don't fail the whole request, just mark email as failed
                            giftCardResult = {
                                created: true,
                                emailSent: false,
                                giftCardCode: fullGiftCardCode,
                                message: "Gift card created but email failed to send",
                                emailError: emailError.message
                            };
                        }
                    } else {
                        const reasons = [];
                        if (!video.uploaderEmail) reasons.push("no email address");
                        if (process.env.ENABLE_GIFT_CARD_EMAIL !== "true") reasons.push("email disabled in config");
                        
                        console.log("⏭️  Email skipped - " + reasons.join(" | "));
                        
                        giftCardResult = {
                            created: true,
                            emailSent: false,
                            giftCardCode: fullGiftCardCode,
                            message: "Gift card created (email: " + reasons.join(", ") + ")"
                        };
                    }
                } catch (giftCardError) {
                    console.error("❌ Failed to create gift card:");
                    console.error("   Error Message:", giftCardError.message);
                    console.error("   Error Stack:", giftCardError.stack);
                    console.error("   Full Error:", giftCardError);
                    
                    // Video is still approved even if gift card creation fails
                    giftCardResult = {
                        created: false,
                        error: giftCardError.message,
                        message: "Video approved but gift card creation failed"
                    };
                }
            } else {
                const reason = !admin ? "no admin client" : "feature disabled";
                console.log(`⏭️  Skipping gift card - ${reason}`);
            }

            return json({
                success: true,
                message: "Video approved",
                giftCardResult
            });
        } catch (error) {
            console.error("❌ Error approving video:", error);
            return json({ 
                error: "Failed to approve video: " + error.message 
            }, { status: 500 });
        }
    }

    if (intent === "delete") {
        try {
            const video = await Video.findOne({ _id: videoId, shop: session.shop });
            if (video) {
                try {
                    await deleteFileFromGridFS(video.fileId);
                    console.log("✅ GridFS file deleted:", video.fileId);
                } catch (e) {
                    console.warn("⚠️  GridFS delete failed (file may not exist):", e.message);
                }
                await Video.deleteOne({ _id: videoId });
                console.log("✅ Video deleted from database:", videoId);
            }
            return json({ success: true, message: "Video deleted" });
        } catch (error) {
            console.error("❌ Error deleting video:", error);
            return json({ 
                error: "Failed to delete video: " + error.message 
            }, { status: 500 });
        }
    }

    return json({ error: "Invalid intent" }, { status: 400 });
};

export default function Index() {
    const { videos } = useLoaderData();
    const fetcher = useFetcher();

    const handleAction = (id, intent) => {
        fetcher.submit({ id, intent }, { method: "POST" });
    };

    const { selectedResources, allResourcesSelected, handleSelectionChange } =
        useIndexResourceState(videos);

    const rowMarkup = videos.map(
        (
            { id, thumbnailLink, uploaderName, uploaderEmail, status, createdAt, giftCardCreated, giftCardEmailSent },
            index,
        ) => (
            <IndexTable.Row
                id={id}
                key={id}
                selected={selectedResources.includes(id)}
                position={index}
            >
                <IndexTable.Cell>
                    {thumbnailLink ?
                        <Thumbnail source={thumbnailLink} alt="Video" /> :
                        <Thumbnail source="video" alt="Video" />
                    }
                </IndexTable.Cell>
                <IndexTable.Cell>
                    {new Date(createdAt).toLocaleDateString()}
                </IndexTable.Cell>
                <IndexTable.Cell>{uploaderName}</IndexTable.Cell>
                <IndexTable.Cell>{uploaderEmail}</IndexTable.Cell>
                <IndexTable.Cell>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            {status === "approved" ? (
                                <Badge status="success" tone="success">Approved</Badge>
                            ) : (
                                <Badge status="attention" tone="attention">Pending</Badge>
                            )}
                        </div>
                        {giftCardCreated && (
                            <div title={giftCardEmailSent ? "Gift card sent via email" : "Gift card created (email pending)"}>
                                {giftCardEmailSent ? (
                                    <Badge status="success" tone="success">🎁 Sent</Badge>
                                ) : (
                                    <Badge status="warning" tone="warning">🎁 Created</Badge>
                                )}
                            </div>
                        )}
                    </div>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <InlineStack gap="300">
                        {status !== "approved" && (
                            <Button 
                                onClick={() => handleAction(id, "approve")} 
                                size="slim" 
                                loading={fetcher.state !== "idle" && fetcher.formData?.get("id") === id} 
                                tone="success"
                            >
                                Approve
                            </Button>
                        )}
                        <Button 
                            onClick={() => handleAction(id, "delete")} 
                            size="slim" 
                            loading={fetcher.state !== "idle" && fetcher.formData?.get("id") === id} 
                            tone="critical" 
                            variant="plain"
                        >
                            Delete
                        </Button>
                    </InlineStack>
                </IndexTable.Cell>
            </IndexTable.Row>
        ),
    );

    return (
        <Page title="Video Management">
            <Layout>
                <Layout.Section>
                    <Card>
                        <IndexTable
                            resourceName={{ singular: 'video', plural: 'videos' }}
                            itemCount={videos.length}
                            selectedItemsCount={
                                allResourcesSelected ? 'All' : selectedResources.length
                            }
                            onSelectionChange={handleSelectionChange}
                            headings={[
                                { title: 'Thumbnail' },
                                { title: 'Upload Date' },
                                { title: 'Uploader' },
                                { title: 'Email' },
                                { title: 'Status' },
                                { title: 'Actions' },
                            ]}
                        >
                            {rowMarkup}
                        </IndexTable>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}