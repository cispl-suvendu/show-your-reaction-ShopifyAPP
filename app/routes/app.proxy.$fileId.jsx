import { authenticate } from "../shopify.server";
import { getFileFromGridFS } from "../services/gridfs.server";
import connection from "../db.server";

export const loader = async ({ params, request }) => {
  // authenticate.public.appProxy verifies the request comes from Shopify
  await authenticate.public.appProxy(request);
  await connection;

  const { fileId } = params;

  if (!fileId) {
    return new Response("File ID required", { status: 400 });
  }

  try {
    const downloadStream = await getFileFromGridFS(fileId);

    // Collect stream data
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Determine content type based on filename pattern
    // Thumbnails start with "thumb_", videos don't
    const contentType = fileId.includes('thumb_') ? 'image/jpeg' : 'video/mp4';

    // Return the file as response
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error serving file from GridFS:", error);
    return new Response("File not found", { status: 404 });
  }
};
