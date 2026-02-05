import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Badge,
  InlineStack,
  Banner
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
    link: v.webViewLink
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

  try {
    if (intent === "approve") {
      await Video.updateOne({ _id: videoId, shop: session.shop }, { status: 'approved' });
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
  } catch (error) {
    console.error(error);
    return json({ error: "Action failed" }, { status: 500 });
  }

  return null;
};

export default function Index() {
  const { videos } = useLoaderData();
  const fetcher = useFetcher();

  const handleAction = (id, intent) => {
    fetcher.submit({ id, intent }, { method: "POST" });
  };

  return (
    <Page title="Video Management">
      <Layout>
        <Layout.Section>
          <Card>
            <ResourceList
              resourceName={{ singular: 'video', plural: 'videos' }}
              items={videos}
              emptyState={
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <Text variant="bodyMd">No videos uploaded yet.</Text>
                </div>
              }
              renderItem={(item) => {
                const { id, status, createdAt, thumbnailLink, link } = item;

                return (
                  <ResourceItem
                    id={id}
                    media={
                      thumbnailLink ?
                        <Thumbnail source={thumbnailLink} alt="Video" /> :
                        <Thumbnail source="video" alt="Video" />
                    }
                    accessibilityLabel={`View details for video`}
                  >
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="bold">
                            Uploaded on {new Date(createdAt).toLocaleDateString()}
                          </Text>
                          {link && (
                            <Button variant="plain" url={link} target="_blank">
                              View Video
                            </Button>
                          )}
                        </BlockStack>
                        <Badge tone={status === 'approved' ? 'success' : 'attention'}>
                          {status.toUpperCase()}
                        </Badge>
                      </InlineStack>
                      <InlineStack gap="300">
                        {status !== 'approved' && (
                          <Button onClick={() => handleAction(id, 'approve')} tone="success" loading={fetcher.state !== "idle"}>
                            Approve
                          </Button>
                        )}
                        <Button onClick={() => handleAction(id, 'delete')} tone="critical" variant="plain" loading={fetcher.state !== "idle"}>
                          Delete
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </ResourceItem>
                );
              }}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
