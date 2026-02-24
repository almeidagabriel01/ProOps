import { storage } from "@/lib/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadString,
} from "firebase/storage";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
];

export interface UploadResult {
  url: string;
  path: string;
}

function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `Arquivo muito grande. O tamanho maximo e ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "Tipo de arquivo nao suportado. Use JPEG, PNG, GIF, WebP ou AVIF.",
    );
  }
}

function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}-${randomSuffix}.${extension}`;
}

export async function uploadImage(
  file: File,
  tenantId: string,
  folder: "products" | "proposals",
  entityId?: string,
): Promise<UploadResult> {
  validateFile(file);

  const fileName = generateFileName(file.name);
  const path = entityId
    ? `tenants/${tenantId}/${folder}/${entityId}/${fileName}`
    : `tenants/${tenantId}/${folder}/${fileName}`;

  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  const url = await getDownloadURL(storageRef);

  return { url, path };
}

export async function uploadBase64Image(
  base64Data: string,
  tenantId: string,
  folder: "products" | "proposals",
  entityId?: string,
): Promise<UploadResult> {
  const isDataUrl = base64Data.startsWith("data:");

  let contentType = "image/png";
  let base64Content = base64Data;

  if (isDataUrl) {
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      contentType = matches[1];
      base64Content = matches[2];
    }
  }

  const fileName = generateFileName(`image.${contentType.split("/")[1]}`);
  const path = entityId
    ? `tenants/${tenantId}/${folder}/${entityId}/${fileName}`
    : `tenants/${tenantId}/${folder}/${fileName}`;

  const storageRef = ref(storage, path);

  await uploadString(storageRef, base64Content, "base64", {
    contentType,
    customMetadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  const url = await getDownloadURL(storageRef);

  return { url, path };
}

export async function deleteImage(urlOrPath: string): Promise<void> {
  try {
    let storagePath = urlOrPath;

    if (
      urlOrPath.includes("firebasestorage.googleapis.com") ||
      urlOrPath.includes("storage.googleapis.com")
    ) {
      const decodedUrl = decodeURIComponent(urlOrPath);
      const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
      if (pathMatch) {
        storagePath = pathMatch[1];
      }
    }

    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    if ((error as Error).message?.includes("object-not-found")) {
      console.warn("Image already deleted:", urlOrPath);
      return;
    }
    throw error;
  }
}

export function isStorageUrl(value: string): boolean {
  return (
    value.startsWith("https://firebasestorage.googleapis.com") ||
    value.startsWith("https://storage.googleapis.com") ||
    value.startsWith("gs://")
  );
}

export function isBase64DataUrl(value: string): boolean {
  return value.startsWith("data:image/");
}
