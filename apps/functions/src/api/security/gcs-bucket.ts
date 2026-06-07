/**
 * Bucket-pinning for the image proxy.
 *
 * The proxy's host allowlist (firebasestorage.googleapis.com, storage.googleapis.com,
 * firebasestorage.app) is not enough on its own: with path-style URLs the bucket
 * lives in the PATH (storage.googleapis.com/<bucket>/...), so host matching alone
 * lets any public GCS bucket through — an image-only open proxy / origin-masking
 * vector. To close it we extract the bucket from every supported URL shape and
 * require it to be one of the project's own buckets.
 */

const FIREBASE_DOWNLOAD_HOST = "firebasestorage.googleapis.com";
const GCS_HOST = "storage.googleapis.com";
const FIREBASE_APP_HOST = "firebasestorage.app";

/**
 * Extracts the GCS bucket name from a Firebase/GCS storage URL, covering the
 * shapes the proxy can receive. Returns null when the URL is not a recognized
 * storage URL (callers should treat null as "deny" when enforcement is on).
 */
export function extractStorageBucket(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const path = url.pathname;

  // firebasestorage.googleapis.com/v0/b/<bucket>/o/<object>
  if (host === FIREBASE_DOWNLOAD_HOST) {
    const match = path.match(/^\/v0\/b\/([^/]+)\/o(?:\/|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // <bucket>.storage.googleapis.com/<object>  (virtual-hosted style)
  if (host.endsWith(`.${GCS_HOST}`)) {
    const bucket = host.slice(0, host.length - GCS_HOST.length - 1);
    return bucket || null;
  }

  // storage.googleapis.com/<bucket>/<object>  (path style)
  if (host === GCS_HOST) {
    const match = path.match(/^\/([^/]+)(?:\/|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // firebasestorage.app/<bucket>/<object>  (path style)
  if (host === FIREBASE_APP_HOST) {
    const match = path.match(/^\/([^/]+)(?:\/|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // <bucket>.firebasestorage.app  (the host itself is the bucket name)
  if (host.endsWith(`.${FIREBASE_APP_HOST}`)) {
    return host;
  }

  return null;
}

/** Case-insensitive membership check against the allowed bucket list. */
export function isBucketAllowed(
  bucket: string | null,
  allowedBuckets: string[],
): boolean {
  if (!bucket) return false;
  const normalized = bucket.trim().toLowerCase();
  if (!normalized) return false;
  return allowedBuckets.some(
    (allowed) => allowed.trim().toLowerCase() === normalized,
  );
}

/**
 * Resolves the project's allowed buckets. Prefers an explicit comma-separated
 * PROXY_IMAGE_ALLOWED_BUCKETS, otherwise derives the standard Firebase defaults
 * from the project id. Returns [] when nothing can be resolved — callers treat
 * an empty list as "bucket enforcement disabled" to avoid breaking environments
 * with no project context (e.g. local emulator).
 */
export function resolveAllowedBuckets(): string[] {
  const explicit = String(process.env.PROXY_IMAGE_ALLOWED_BUCKETS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (explicit.length > 0) {
    return Array.from(new Set(explicit));
  }

  const projectId = String(
    process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
  )
    .trim()
    .toLowerCase();
  if (!projectId) {
    return [];
  }

  return [`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`];
}
