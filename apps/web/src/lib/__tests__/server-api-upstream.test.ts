import { describe, it, expect } from "vitest";
import { resolveUpstreamForHost } from "../server-api-upstream";

describe("resolveUpstreamForHost", () => {
  it("local for localhost", () => {
    expect(resolveUpstreamForHost("localhost").target).toBe("local");
    expect(resolveUpstreamForHost("127.0.0.1").target).toBe("local");
  });
  it("dev for an unknown host", () => {
    expect(resolveUpstreamForHost("preview-xyz.vercel.app").target).toBe("dev");
  });
  it("dev for null host", () => {
    expect(resolveUpstreamForHost(null).target).toBe("dev");
  });
});
