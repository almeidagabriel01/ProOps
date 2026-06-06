import { KeyManagementServiceClient } from "@google-cloud/kms";
import { logger } from "./logger";

/**
 * Envelope encryption for sensitive OAuth tokens using Cloud KMS.
 *
 * Stored ciphertext is prefixed with `ENC_PREFIX` so an encrypted value is
 * always distinguishable from legacy plaintext. The KMS key is resolved from
 * env, either as a full resource name or composed from its parts.
 *
 * Required env (one of):
 *  - CALENDAR_TOKEN_KMS_KEY: full key resource name
 *    (projects/P/locations/L/keyRings/R/cryptoKeys/K), OR
 *  - CALENDAR_TOKEN_KMS_KEYRING + CALENDAR_TOKEN_KMS_KEY_ID
 *    (+ optional CALENDAR_TOKEN_KMS_LOCATION, default southamerica-east1;
 *     project defaults to GCLOUD_PROJECT)
 *
 * The Cloud Run service account needs
 * roles/cloudkms.cryptoKeyEncrypterDecrypter on the key.
 */

const ENC_PREFIX = "kms:v1:";
const DEFAULT_LOCATION = "southamerica-east1";

let cachedClient: KeyManagementServiceClient | null = null;

function getClient(): KeyManagementServiceClient {
  if (!cachedClient) {
    cachedClient = new KeyManagementServiceClient();
  }
  return cachedClient;
}

function resolveKeyName(): string {
  const explicit = String(process.env.CALENDAR_TOKEN_KMS_KEY || "").trim();
  if (explicit) {
    return explicit;
  }

  const project = String(process.env.GCLOUD_PROJECT || "").trim();
  const location =
    String(process.env.CALENDAR_TOKEN_KMS_LOCATION || "").trim() ||
    DEFAULT_LOCATION;
  const keyRing = String(process.env.CALENDAR_TOKEN_KMS_KEYRING || "").trim();
  const keyId = String(process.env.CALENDAR_TOKEN_KMS_KEY_ID || "").trim();

  if (!project || !keyRing || !keyId) {
    throw new Error("CALENDAR_TOKEN_KMS_KEY_NOT_CONFIGURED");
  }

  return getClient().cryptoKeyPath(project, location, keyRing, keyId);
}

/** Whether a stored value is in the KMS-encrypted envelope format. */
export function isEncryptedToken(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

/** Encrypts a plaintext token, returning a prefixed base64 envelope. */
export async function encryptToken(plaintext: string): Promise<string> {
  const value = String(plaintext || "");
  if (!value) {
    throw new Error("ENCRYPT_EMPTY_TOKEN");
  }

  const [result] = await getClient().encrypt({
    name: resolveKeyName(),
    plaintext: Buffer.from(value, "utf8"),
  });

  const ciphertext = result.ciphertext;
  if (!ciphertext) {
    throw new Error("ENCRYPT_FAILED");
  }

  return ENC_PREFIX + Buffer.from(ciphertext as Uint8Array).toString("base64");
}

/**
 * Decrypts a stored token. Accepts both prefixed envelopes and a bare base64
 * ciphertext (defensive — the prefix is stripped when present).
 */
export async function decryptToken(stored: string): Promise<string> {
  const value = String(stored || "");
  if (!value) {
    throw new Error("DECRYPT_EMPTY_TOKEN");
  }

  const base64 = value.startsWith(ENC_PREFIX)
    ? value.slice(ENC_PREFIX.length)
    : value;

  try {
    const [result] = await getClient().decrypt({
      name: resolveKeyName(),
      ciphertext: Buffer.from(base64, "base64"),
    });

    const plaintext = result.plaintext;
    if (!plaintext) {
      throw new Error("DECRYPT_FAILED");
    }

    return Buffer.from(plaintext as Uint8Array).toString("utf8");
  } catch (error) {
    logger.error("Falha ao descriptografar token OAuth", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
