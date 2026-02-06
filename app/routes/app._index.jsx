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
        uploaderEmail: v.uploaderEmail || 'N/A'
    }));

    return json({ videos: formattedVideos });
};

export const action = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    await connection;
    const formData = await request.formData();

    const intent = formData.get("intent");
    const videoId = formData.get("id");

    if (!videoId) return json({ error: "Missing video ID" }, { status: 400 });

    if (intent === "approve") {
        await Video.updateOne(
            { _id: videoId, shop: session.shop },
            { status: "approved" }
        );
        return json({ success: true, message: "Video approved" });
    }

    if (intent === "delete") {
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
            { id, _videoTitle, thumbnailLink, uploaderName, uploaderEmail, status, createdAt },
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
                <IndexTable.Cell>{status === "approved" ? <Badge status="success" tone="success">Approved</Badge> : <Badge status="attention" tone="attention">Pending</Badge>}</IndexTable.Cell>
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
