import {
  extractStorageBucket,
  isBucketAllowed,
  resolveAllowedBuckets,
} from "./gcs-bucket";

const PROJECT_BUCKET = "erp-softcode-prod.appspot.com";

function bucketOf(rawUrl: string): string | null {
  return extractStorageBucket(new URL(rawUrl));
}

describe("extractStorageBucket — all proxy URL shapes", () => {
  it("Firebase download URL (firebasestorage.googleapis.com/v0/b/<bucket>/o)", () => {
    expect(
      bucketOf(
        `https://firebasestorage.googleapis.com/v0/b/${PROJECT_BUCKET}/o/logos%2Fa.png?alt=media&token=x`,
      ),
    ).toBe(PROJECT_BUCKET);
  });

  it("path-style (storage.googleapis.com/<bucket>/...)", () => {
    expect(bucketOf(`https://storage.googleapis.com/${PROJECT_BUCKET}/a.png`)).toBe(
      PROJECT_BUCKET,
    );
  });

  it("virtual-hosted (<bucket>.storage.googleapis.com/...)", () => {
    expect(
      bucketOf(`https://${PROJECT_BUCKET}.storage.googleapis.com/a.png`),
    ).toBe(PROJECT_BUCKET);
  });

  it("firebasestorage.app host is treated as the bucket name", () => {
    expect(bucketOf("https://erp-softcode-prod.firebasestorage.app/a.png")).toBe(
      "erp-softcode-prod.firebasestorage.app",
    );
  });

  it("returns null for an unrecognized host", () => {
    expect(bucketOf("https://example.com/a.png")).toBeNull();
  });
});

describe("isBucketAllowed — open-proxy is closed", () => {
  const allowed = [PROJECT_BUCKET, "erp-softcode-prod.firebasestorage.app"];

  it("accepts the project's own bucket", () => {
    expect(isBucketAllowed(PROJECT_BUCKET, allowed)).toBe(true);
    expect(isBucketAllowed(PROJECT_BUCKET.toUpperCase(), allowed)).toBe(true);
  });

  it("REJECTS an arbitrary bucket via path-style", () => {
    const bucket = bucketOf("https://storage.googleapis.com/some-victim-bucket/secret.png");
    expect(bucket).toBe("some-victim-bucket");
    expect(isBucketAllowed(bucket, allowed)).toBe(false);
  });

  it("REJECTS an arbitrary bucket via virtual-hosted subdomain", () => {
    const bucket = bucketOf("https://attacker-bucket.storage.googleapis.com/secret.png");
    expect(bucket).toBe("attacker-bucket");
    expect(isBucketAllowed(bucket, allowed)).toBe(false);
  });

  it("REJECTS when bucket cannot be extracted (null) — fail closed", () => {
    expect(isBucketAllowed(null, allowed)).toBe(false);
  });
});

describe("extractStorageBucket — parser confusion / bypass attempts", () => {
  const allowed = [PROJECT_BUCKET, "erp-softcode-prod.firebasestorage.app"];

  it("path traversal normalizes to the REAL target bucket, not the allowed prefix", () => {
    // WHATWG URL normalizes /<allowed>/../evil -> /evil, and axios fetches that
    // same normalized URL, so extraction and fetch stay consistent.
    const bucket = bucketOf(
      `https://storage.googleapis.com/${PROJECT_BUCKET}/../evil-bucket/secret.png`,
    );
    expect(bucket).toBe("evil-bucket");
    expect(isBucketAllowed(bucket, allowed)).toBe(false);
  });

  it("host-suffix confusion (...storage.googleapis.com.evil.com) is not a storage host", () => {
    expect(
      bucketOf("https://attacker.storage.googleapis.com.evil.com/x.png"),
    ).toBeNull();
    expect(
      bucketOf(
        `https://${PROJECT_BUCKET}.storage.googleapis.com.evil.com/x.png`,
      ),
    ).toBeNull();
  });

  it("userinfo trick (<allowed>@evil.com) resolves to evil.com, not a storage host", () => {
    // The real hostname is evil.com; credentials are also rejected upstream by
    // validateOutboundUrl, but extraction must independently fail closed here.
    expect(bucketOf(`https://${PROJECT_BUCKET}@evil.com/x.png`)).toBeNull();
  });

  it("a legit virtual-hosted arbitrary bucket is still rejected (control)", () => {
    const bucket = bucketOf("https://attacker.storage.googleapis.com/x.png");
    expect(bucket).toBe("attacker");
    expect(isBucketAllowed(bucket, allowed)).toBe(false);
  });
});

describe("resolveAllowedBuckets", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("derives the Firebase defaults from GCLOUD_PROJECT", () => {
    process.env.GCLOUD_PROJECT = "erp-softcode-prod";
    delete process.env.PROXY_IMAGE_ALLOWED_BUCKETS;
    expect(resolveAllowedBuckets()).toEqual([
      "erp-softcode-prod.appspot.com",
      "erp-softcode-prod.firebasestorage.app",
    ]);
  });

  it("prefers an explicit PROXY_IMAGE_ALLOWED_BUCKETS override", () => {
    process.env.PROXY_IMAGE_ALLOWED_BUCKETS = "custom-bucket, Other-Bucket";
    expect(resolveAllowedBuckets()).toEqual(["custom-bucket", "other-bucket"]);
  });

  it("returns [] when no project context (enforcement disabled)", () => {
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.PROXY_IMAGE_ALLOWED_BUCKETS;
    expect(resolveAllowedBuckets()).toEqual([]);
  });
});
