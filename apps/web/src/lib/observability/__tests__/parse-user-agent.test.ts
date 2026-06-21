import { describe, it, expect } from "vitest";
import { parseUserAgent } from "../parse-user-agent";

describe("parseUserAgent", () => {
  it("parses Chrome on Windows desktop", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", os: "Windows", device: "Desktop" });
  });

  it("parses Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "iOS", device: "Mobile" });
  });

  it("parses Firefox on Android", () => {
    const ua = "Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0";
    expect(parseUserAgent(ua)).toEqual({ browser: "Firefox", os: "Android", device: "Mobile" });
  });

  it("returns Desconhecido for null", () => {
    expect(parseUserAgent(null)).toEqual({
      browser: "Desconhecido",
      os: "Desconhecido",
      device: "Desconhecido",
    });
  });
});
