import { getStorage } from "firebase-admin/storage";

function extractStoragePath(imageUrlOrPath: string): string | null {
  if (imageUrlOrPath.startsWith("tenants/")) {
    return imageUrlOrPath;
  }

  if (imageUrlOrPath.includes("firebasestorage.googleapis.com")) {
    const decodedUrl = decodeURIComponent(imageUrlOrPath);
    const match = decodedUrl.match(/\/o\/(.+?)\?/);
    return match?.[1] || null;
  }

  if (imageUrlOrPath.includes("firebasestorage.app")) {
    const decodedUrl = decodeURIComponent(imageUrlOrPath);
    const match = decodedUrl.match(/\/o\/(.+?)\?/);
    return match?.[1] || null;
  }

  if (imageUrlOrPath.includes("storage.googleapis.com")) {
    const urlParts = imageUrlOrPath.split("/");
    const bucketIndex = urlParts.findIndex(
      (part) =>
        part.includes(".appspot.com") || part.includes("firebasestorage.app"),
    );
    if (bucketIndex >= 0) {
      return urlParts.slice(bucketIndex + 1).join("/");
    }
  }

  return null;
}

export async function deleteProductImages(
  images: string[] | undefined,
  tenantId?: string,
): Promise<void> {
  if (!images || images.length === 0) return;

  const bucket = getStorage().bucket();
  const tenantPrefix = tenantId ? `tenants/${tenantId}/` : "";

  for (const imageUrl of images) {
    try {
      if (imageUrl.startsWith("data:")) continue;

      const filePath = extractStoragePath(imageUrl);

      if (filePath) {
        if (tenantPrefix && !filePath.startsWith(tenantPrefix)) {
          console.warn(
            `[Storage] Skip deleting cross-tenant path: ${filePath} (tenant: ${tenantId})`,
          );
          continue;
        }

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
