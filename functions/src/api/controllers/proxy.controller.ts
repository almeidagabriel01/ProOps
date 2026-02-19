import { Request, Response } from "express";
import { getStorage } from "firebase-admin/storage";
import axios from "axios";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

/**
 * Extracts the file path from a Firebase Storage URL
 */
function extractFirebaseStoragePath(url: string): string | null {
  try {
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/\/o\/(.+?)\?/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if the URL is a Firebase Storage URL
 */
function isFirebaseStorageUrl(url: string): boolean {
  return (
    url.includes("firebasestorage.googleapis.com") ||
    url.includes("firebasestorage.app")
  );
}

function getCacheControl(req: Request): string {
  const isCaptureMode = req.query.capture === "1";
  const disableCache = req.query.noStore === "1";
  return isCaptureMode || disableCache
    ? "no-store, max-age=0"
    : "public, max-age=3600";
}

function applyCorsAndCacheHeaders(req: Request, res: Response): void {
  const origin = req.get("origin");
  const isCaptureMode = req.query.capture === "1";
  const disableCache = req.query.noStore === "1";
  const isNoStore = isCaptureMode || disableCache;

  res.set("Access-Control-Allow-Origin", isCaptureMode ? "*" : origin || "*");
  res.set("Vary", "Origin");

  if (isNoStore) {
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
}

type FirebaseReadResult =
  | { status: "not-firebase" | "fallback-http" }
  | { status: "not-found" }
  | { status: "ok"; buffer: Buffer; contentType: string };

async function tryReadFirebaseImage(imageUrl: string): Promise<FirebaseReadResult> {
  if (!isFirebaseStorageUrl(imageUrl)) {
    return { status: "not-firebase" };
  }

  const filePath = extractFirebaseStoragePath(imageUrl);
  if (!filePath) {
    return { status: "fallback-http" };
  }

  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();

    if (!exists) {
      console.error(`[Proxy] File not found: ${filePath}`);
      return { status: "not-found" };
    }

    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();

    return {
      status: "ok",
      buffer,
      contentType: metadata.contentType || "image/jpeg",
    };
  } catch (storageError) {
    console.error("[Proxy] Storage error, falling back to HTTP:", storageError);
    return { status: "fallback-http" };
  }
}

async function fetchImageViaHttp(imageUrl: string): Promise<{
  data: Buffer;
  contentType: string;
}> {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
    },
  });

  return {
    data: response.data,
    contentType: response.headers["content-type"] || "application/octet-stream",
  };
}

export const proxyImage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const imageUrl = req.query.url as string;
    const cacheControl = getCacheControl(req);

    applyCorsAndCacheHeaders(req, res);

    if (!imageUrl) {
      return res.status(400).send("URL parameter is required.");
    }

    const firebaseImage = await tryReadFirebaseImage(imageUrl);

    if (firebaseImage.status === "not-found") {
      return res.status(404).send("Image not found.");
    }

    if (firebaseImage.status === "ok") {
      res.set("Content-Type", firebaseImage.contentType);
      res.set("Cache-Control", cacheControl);
      return res.send(firebaseImage.buffer);
    }

    const remoteImage = await fetchImageViaHttp(imageUrl);

    res.set("Content-Type", remoteImage.contentType);
    res.set("Cache-Control", cacheControl);
    return res.send(remoteImage.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error proxying image.";
    console.error("Error proxying image:", message);
    return res.status(500).send("Error proxying image.");
  }
};
