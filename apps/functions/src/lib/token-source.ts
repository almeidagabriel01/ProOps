/**
 * Pure helpers for the encrypted-token migration of OAuth refresh tokens.
 *
 * During the migration window a `calendar_integrations` document may carry the
 * token in two shapes simultaneously:
 *  - `refreshToken`    — legacy plaintext (pre-migration writes)
 *  - `refreshTokenEnc` — KMS-encrypted ciphertext (new writes)
 *
 * The encrypted form always wins so that, once a document has been re-encrypted,
 * a stale plaintext copy left behind is never used.
 */

export type RefreshTokenSourceKind = "encrypted" | "legacy" | "none";

export interface RefreshTokenSource {
  source: RefreshTokenSourceKind;
  /** Ciphertext when `encrypted`, plaintext when `legacy`, empty when `none`. */
  value: string;
}

export interface StoredRefreshTokenFields {
  refreshToken?: string | null;
  refreshTokenEnc?: string | null;
}

/**
 * Decides which stored representation of the refresh token to use, preferring
 * the encrypted form over any legacy plaintext that may still coexist.
 */
export function selectRefreshTokenSource(
  raw: StoredRefreshTokenFields,
): RefreshTokenSource {
  const enc = String(raw.refreshTokenEnc || "").trim();
  if (enc) {
    return { source: "encrypted", value: enc };
  }

  const legacy = String(raw.refreshToken || "").trim();
  if (legacy) {
    return { source: "legacy", value: legacy };
  }

  return { source: "none", value: "" };
}

/**
 * Builds the persisted token fields for a write. Encrypted ciphertext goes to
 * `refreshTokenEnc`; the legacy plaintext field is explicitly cleared so new
 * writes never persist a plaintext token.
 */
export function buildRefreshTokenStorageFields(
  encryptedValue: string,
): { refreshToken: string; refreshTokenEnc: string } {
  const enc = String(encryptedValue || "").trim();
  if (!enc) {
    throw new Error("MISSING_ENCRYPTED_REFRESH_TOKEN");
  }
  return { refreshToken: "", refreshTokenEnc: enc };
}
