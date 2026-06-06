import {
  selectRefreshTokenSource,
  buildRefreshTokenStorageFields,
} from "./token-source";

describe("selectRefreshTokenSource — migration coexistence", () => {
  it("(a) uses legacy plaintext when only refreshToken is present", () => {
    const result = selectRefreshTokenSource({ refreshToken: "legacy-token" });
    expect(result).toEqual({ source: "legacy", value: "legacy-token" });
  });

  it("(b) uses encrypted value when only refreshTokenEnc is present", () => {
    const result = selectRefreshTokenSource({
      refreshTokenEnc: "kms:v1:ciphertext",
    });
    expect(result).toEqual({ source: "encrypted", value: "kms:v1:ciphertext" });
  });

  it("(c) prioritizes the encrypted value when both coexist", () => {
    const result = selectRefreshTokenSource({
      refreshToken: "stale-legacy-token",
      refreshTokenEnc: "kms:v1:ciphertext",
    });
    expect(result).toEqual({ source: "encrypted", value: "kms:v1:ciphertext" });
  });

  it("(d) reports none when neither is present", () => {
    expect(selectRefreshTokenSource({})).toEqual({ source: "none", value: "" });
    expect(
      selectRefreshTokenSource({ refreshToken: "", refreshTokenEnc: null }),
    ).toEqual({ source: "none", value: "" });
  });

  it("treats whitespace-only fields as absent", () => {
    expect(
      selectRefreshTokenSource({ refreshToken: "   ", refreshTokenEnc: "  " }),
    ).toEqual({ source: "none", value: "" });
  });

  it("ignores a blank encrypted field and falls back to legacy", () => {
    const result = selectRefreshTokenSource({
      refreshToken: "legacy-token",
      refreshTokenEnc: "   ",
    });
    expect(result).toEqual({ source: "legacy", value: "legacy-token" });
  });
});

describe("buildRefreshTokenStorageFields — new writes never persist plaintext", () => {
  it("clears the plaintext field and stores the ciphertext", () => {
    const fields = buildRefreshTokenStorageFields("kms:v1:ciphertext");
    expect(fields).toEqual({
      refreshToken: "",
      refreshTokenEnc: "kms:v1:ciphertext",
    });
  });

  it("never returns a non-empty plaintext refreshToken", () => {
    const fields = buildRefreshTokenStorageFields("kms:v1:anything");
    expect(fields.refreshToken).toBe("");
  });

  it("throws when given an empty ciphertext", () => {
    expect(() => buildRefreshTokenStorageFields("")).toThrow(
      "MISSING_ENCRYPTED_REFRESH_TOKEN",
    );
    expect(() => buildRefreshTokenStorageFields("   ")).toThrow(
      "MISSING_ENCRYPTED_REFRESH_TOKEN",
    );
  });
});
