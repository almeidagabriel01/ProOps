import { storage } from "@/lib/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadString,
} from "firebase/storage";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
];

const ALLOWED_ATTACHMENT_TYPES = [
  ...ALLOWED_TYPES,
  "application/pdf",
] as const;

export interface UploadResult {
  url: string;
  path: string;
}

function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `Arquivo muito grande. O tamanho máximo é ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "Tipo de arquivo não suportado. Use JPEG, PNG, GIF, WebP ou AVIF.",
    );
  }
}

function validateAttachmentFile(file: File): void {
  if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
    throw new Error(
      `Arquivo muito grande. O tamanho máximo é ${MAX_ATTACHMENT_FILE_SIZE / (1024 * 1024)}MB.`,
    );
  }

  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_TYPES)[number])) {
    throw new Error("Tipo de arquivo não suportado. Use imagens ou PDF.");
  }
}

function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}-${randomSuffix}.${extension}`;
}

function getAttachmentFileName(file: File): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const originalExtension = file.name.split(".").pop()?.toLowerCase();
  const mimeExtension = file.type.split("/").pop()?.toLowerCase();
  const extension = (originalExtension || mimeExtension || "bin").replace(
    /[^a-z0-9]/g,
    "",
  );
  return `${timestamp}-${randomSuffix}.${extension || "bin"}`;
}

export async function uploadImage(
  file: File,
  tenantId: string,
  folder: "products" | "services" | "proposals",
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
  folder: "products" | "services" | "proposals",
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
      urlOrPath.includes("firebasestorage.app") ||
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

export async function deleteStorageObject(pathOrUrl: string): Promise<void> {
  await deleteImage(pathOrUrl);
}

export async function uploadProposalAttachment(
  file: File,
  tenantId: string,
  proposalId: string,
): Promise<UploadResult> {
  validateAttachmentFile(file);

  const fileName = getAttachmentFileName(file);
  const path = `tenants/${tenantId}/proposals/${proposalId}/attachments/${fileName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      attachmentType: file.type === "application/pdf" ? "pdf" : "image",
    },
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
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
