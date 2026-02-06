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
import { createShopifyGiftCard, saveGiftCardRecord, markGiftCardEmailSent } from "../models/giftcard.server";
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
            console.log("Gift card feature enabled:", process.env.ENABLE_GIFT_CARDS === "true");
            console.log("Admin client available:", !!admin);
            
            if (process.env.ENABLE_GIFT_CARDS === "true" && admin) {
                try {
                    // Get gift card reward amount from env (default $10)
                    const giftCardAmount = parseFloat(process.env.GIFT_CARD_AMOUNT || "10");
                    const giftCardValueCents = Math.round(giftCardAmount * 100);

                    console.log("Creating gift card with amount:", giftCardAmount);

                    // Create gift card via Shopify Admin API
                    const shopifyGiftCard = await createShopifyGiftCard({
                        shopifyClient: admin.graphql,
                        initialBalance: giftCardAmount,
                        currency: process.env.GIFT_CARD_CURRENCY || "USD",
                    });

                    console.log("Gift card created successfully:", shopifyGiftCard);

                    // Save gift card record to database
                    const giftCardRecord = await saveGiftCardRecord({
                        shop: session.shop,
                        videoId: videoId,
                        uploaderEmail: video.uploaderEmail,
                        uploaderName: video.uploaderName,
                        shopifyGiftCardId: shopifyGiftCard.id,
                        giftCardCode: shopifyGiftCard.lastCharacters || "PENDING",
                        giftCardValue: giftCardValueCents,
                        currency: process.env.GIFT_CARD_CURRENCY || "USD",
                    });

                    // Update video with gift card info
                    video.giftCardCreated = true;
                    video.giftCardId = giftCardRecord._id.toString();
                    await video.save();

                    console.log("Video updated with gift card:", video.giftCardCreated, video.giftCardId);

                    // Send email with gift card details
                    if (video.uploaderEmail && process.env.ENABLE_GIFT_CARD_EMAIL === "true") {
                        try {
                            console.log("Sending email to:", video.uploaderEmail);
                            await sendGiftCardEmail({
                                email: video.uploaderEmail,
                                uploaderName: video.uploaderName,
                                giftCardCode: shopifyGiftCard.lastCharacters || "PENDING",
                                giftCardValue: giftCardValueCents,
                                shopName: process.env.SHOPIFY_SHOP_NAME || session.shop,
                                shopDomain: session.shop,
                            });

                            // Mark email as sent
                            video.giftCardEmailSent = true;
                            await video.save();
                            await markGiftCardEmailSent(giftCardRecord._id.toString(), true);

                            console.log("Email sent successfully");

                            giftCardResult = {
                                created: true,
                                emailSent: true,
                                giftCardCode: shopifyGiftCard.lastCharacters,
                                message: "Gift card created and email sent successfully"
                            };
                        } catch (emailError) {
                            console.warn("Failed to send gift card email:", emailError);
                            giftCardResult = {
                                created: true,
                                emailSent: false,
                                giftCardCode: shopifyGiftCard.lastCharacters,
                                message: "Gift card created but email failed to send",
                                emailError: emailError.message
                            };
                        }
                    } else {
                        console.log("Email not sent - email disabled or no email address");
                        giftCardResult = {
                            created: true,
                            emailSent: false,
                            giftCardCode: shopifyGiftCard.lastCharacters,
                            message: "Gift card created (email delivery disabled or no email address)"
                        };
                    }
                } catch (giftCardError) {
                    console.error("Failed to create gift card:", giftCardError);
                    // Video is still approved even if gift card creation fails
                    giftCardResult = {
                        created: false,
                        error: giftCardError.message,
                        message: "Video approved but gift card creation failed"
                    };
                }
            } else {
                console.log("Skipping gift card - feature disabled or no admin client");
            }

            return json({
                success: true,
                message: "Video approved",
                giftCardResult
            });
        } catch (error) {
            console.error("Error approving video:", error);
            return json({ error: "Failed to approve video: " + error.message }, { status: 500 });
        }
    }

    if (intent === "delete") {
        try {
            const video = await Video.findOne({ _id: videoId, shop: session.shop });
            if (video) {
                try {
                    await deleteFileFromGridFS(video.fileId);
                } catch (e) {
                    console.warn("GridFS delete failed", e);
                }
                await Video.deleteOne({ _id: videoId });
            }
            return json({ success: true, message: "Video deleted" });
        } catch (error) {
            console.error("Error deleting video:", error);
            return json({ error: "Failed to delete video: " + error.message }, { status: 500 });
        }
    }

    return json({ error: "Invalid intent" }, { status: 400 });
};

export default function Index() {
    const { videos } = useLoaderData();
    const fetcher = useFetcher();

    console.log("Loaded videos:", videos);

    const handleAction = (id, intent) => {
        fetcher.submit({ id, intent }, { method: "POST" });
    };

    const { selectedResources, allResourcesSelected, handleSelectionChange } =
        useIndexResourceState(videos);


    const rowMarkup = videos.map(
        (
            { id, _videoTitle, thumbnailLink, uploaderName, uploaderEmail, status, createdAt, giftCardCreated, giftCardEmailSent },
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
                <IndexTable.Cell>{new Date(createdAt).toLocaleDateString()}</IndexTable.Cell>
                <IndexTable.Cell>{uploaderName}</IndexTable.Cell>
                <IndexTable.Cell>{uploaderEmail}</IndexTable.Cell>
                <IndexTable.Cell>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div>
                            {status === "approved" ? <Badge status="success" tone="success">Approved</Badge> : <Badge status="attention" tone="attention">Pending</Badge>}
                        </div>
                        {giftCardCreated && (
                            <div title={giftCardEmailSent ? "Gift card sent" : "Gift card created (email pending)"}>
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
                        <Button onClick={() => handleAction(id, "approve")} size="slim" loading={fetcher.state !== "idle"} tone="success">
                            Approve
                        </Button>
                    )}
                    <Button onClick={() => handleAction(id, "delete")} size="slim" destructive loading={fetcher.state !== "idle"} tone="critical" variant="plain">
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
                                { title: 'Video Thumbnail' },
                                { title: 'Upload Date' },
                                { title: 'Uploader Name' },
                                { title: 'Uploader Email' },
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
