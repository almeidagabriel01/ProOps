import { getStorage } from "firebase-admin/storage";

export async function deleteProductImages(
  images: string[] | undefined
): Promise<void> {
  if (!images || images.length === 0) return;

  const bucket = getStorage().bucket();

  for (const imageUrl of images) {
    try {
      if (imageUrl.startsWith("data:")) continue;

      let filePath: string | null = null;

      if (imageUrl.includes("firebasestorage.googleapis.com")) {
        const decodedUrl = decodeURIComponent(imageUrl);
        const match = decodedUrl.match(/\/o\/(.+?)\?/);
        if (match) filePath = match[1];
      } else if (imageUrl.includes("storage.googleapis.com")) {
        const urlParts = imageUrl.split("/");
        const bucketIndex = urlParts.findIndex(
          (p) => p.includes(".appspot.com") || p.includes("firebasestorage.app")
        );
        if (bucketIndex >= 0) {
          filePath = urlParts.slice(bucketIndex + 1).join("/");
        }
      } else if (imageUrl.startsWith("tenants/")) {
        filePath = imageUrl;
      }

      if (filePath) {
        await bucket.file(filePath).delete();
        console.log(`[Storage] Deleted: ${filePath}`);
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      // Ignore if not found
      if (err.code === 404 || err.message?.includes("No such object")) continue;
      console.error(`[Storage] Error deleting ${imageUrl}:`, error);
    }
  }
}
