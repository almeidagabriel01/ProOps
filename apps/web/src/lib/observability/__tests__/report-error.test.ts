// apps/web/src/lib/observability/__tests__/report-error.test.ts
import { describe, it, expect } from "vitest";
import { buildClientErrorPayload, dedupeKey } from "../report-error";

describe("buildClientErrorPayload", () => {
  it("extracts type/message/stack from an Error", () => {
    const p = buildClientErrorPayload(new TypeError("kaboom"), { route: "/dashboard" });
    expect(p.errorType).toBe("TypeError");
    expect(p.message).toBe("kaboom");
    expect(p.stack).toContain("kaboom");
    expect(p.route).toBe("/dashboard");
  });

  it("handles non-Error throwables", () => {
    const p = buildClientErrorPayload("oops");
    expect(p.errorType).toBe("Error");
    expect(p.message).toBe("oops");
    expect(p.stack).toBeNull();
    expect(p.route).toBeNull();
  });

  it("truncates very long messages", () => {
    const p = buildClientErrorPayload(new Error("x".repeat(5000)));
    expect(p.message.length).toBeLessThanOrEqual(2000);
  });

  it("captures status from ctx", () => {
    const p = buildClientErrorPayload(new Error("boom"), { route: "GET /x", status: 500 });
    expect(p.status).toBe(500);
    expect(p.route).toBe("GET /x");
    expect(p.errorType).toBe("Error");
    expect(p.message).toBe("boom");
  });

  it("defaults status to null", () => {
    const p = buildClientErrorPayload(new Error("boom"));
    expect(p.status).toBeNull();
  });
});

describe("dedupeKey", () => {
  it("is identical for same type+message+route", () => {
    const a = dedupeKey({ errorType: "TypeError", message: "x", route: "/a", status: null });
    const b = dedupeKey({ errorType: "TypeError", message: "x", route: "/a", status: null });
    expect(a).toBe(b);
  });
  it("differs by route", () => {
    expect(dedupeKey({ errorType: "E", message: "x", route: "/a", status: null })).not.toBe(
      dedupeKey({ errorType: "E", message: "x", route: "/b", status: null }),
    );
  });
  it("includes status so same message at different status are distinct", () => {
    const base = { errorType: "ApiError", message: "fail", route: "POST /a" };
    expect(dedupeKey({ ...base, status: 500 } as never)).not.toBe(
      dedupeKey({ ...base, status: 404 } as never),
    );
    expect(dedupeKey({ ...base, status: 500 } as never)).toBe("ApiError|fail|POST /a|500");
  });
});
