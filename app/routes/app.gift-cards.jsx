import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Badge,
    IndexTable,
    useIndexResourceState
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import GiftCard from "../models/giftcard.server";
import connection from "../db.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    await connection;

    // Fetch gift cards for this shop
    const giftCards = await GiftCard.find({ shop: session.shop })
        .sort({ createdAt: -1 })
        .limit(100);

    const formattedGiftCards = giftCards.map(gc => ({
        id: gc._id.toString(),
        uploaderName: gc.uploaderName,
        uploaderEmail: gc.uploaderEmail,
        giftCardCode: gc.giftCardCode,
        giftCardValue: (gc.giftCardValue / 100).toFixed(2),
        currency: gc.currency,
        emailSent: gc.emailSent,
        createdAt: gc.createdAt,
    }));

    return json({ giftCards: formattedGiftCards });
};

export default function GiftCardManagement() {
    const { giftCards } = useLoaderData();

    const { selectedResources, allResourcesSelected, handleSelectionChange } =
        useIndexResourceState(giftCards);

    const rowMarkup = giftCards.map(
        (
            { id, uploaderName, uploaderEmail, giftCardCode, giftCardValue, currency, emailSent, createdAt },
            index,
        ) => (
            <IndexTable.Row
                id={id}
                key={id}
                selected={selectedResources.includes(id)}
                position={index}
            >
                <IndexTable.Cell>{uploaderName}</IndexTable.Cell>
                <IndexTable.Cell>{uploaderEmail}</IndexTable.Cell>
                <IndexTable.Cell>{giftCardCode}</IndexTable.Cell>
                <IndexTable.Cell>{giftCardValue} {currency}</IndexTable.Cell>
                <IndexTable.Cell>
                    {emailSent ? (
                        <Badge status="success" tone="success">Sent</Badge>
                    ) : (
                        <Badge status="warning" tone="warning">Pending</Badge>
                    )}
                </IndexTable.Cell>
                <IndexTable.Cell>{new Date(createdAt).toLocaleDateString()}</IndexTable.Cell>
            </IndexTable.Row>
        ),
    );

    return (
        <Page title="Gift Card Management">
            <Layout>
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '16px' }}>
                            <p>Total Gift Cards: {giftCards.length}</p>
                            <p style={{ fontSize: '12px', color: '#999' }}>
                                Gift cards are automatically created and sent when videos are approved.
                            </p>
                        </div>
                    </Card>
                </Layout.Section>

                {giftCards.length > 0 && (
                    <Layout.Section>
                        <Card>
                            <IndexTable
                                resourceName={{ singular: 'gift card', plural: 'gift cards' }}
                                itemCount={giftCards.length}
                                selectedItemsCount={
                                    allResourcesSelected ? 'All' : selectedResources.length
                                }
                                onSelectionChange={handleSelectionChange}
                                headings={[
                                    { title: 'Uploader Name' },
                                    { title: 'Email' },
                                    { title: 'Gift Card Code' },
                                    { title: 'Value' },
                                    { title: 'Email Status' },
                                    { title: 'Created Date' },
                                ]}
                            >
                                {rowMarkup}
                            </IndexTable>
                        </Card>
                    </Layout.Section>
                )}
            </Layout>
        </Page>
    );
}
