import { describe, it, expect } from "vitest";
import { resolveGreetingName } from "@/utils/format";

describe("resolveGreetingName", () => {
  // Regression: a logged-in member used to see the master/tenant-owner name
  // in the dashboard greeting instead of their own name.
  it("shows the logged-in member's name, not the tenant owner's", () => {
    expect(resolveGreetingName("Membro Logado", "Master Owner")).toBe(
      "Membro Logado"
    );
  });

  it("shows the master's own name when the master is logged in", () => {
    expect(resolveGreetingName("Master Owner", "Master Owner")).toBe(
      "Master Owner"
    );
  });

  it("falls back to the tenant owner's name when the user has no name", () => {
    expect(resolveGreetingName(undefined, "Master Owner")).toBe("Master Owner");
    expect(resolveGreetingName(null, "Master Owner")).toBe("Master Owner");
    expect(resolveGreetingName("", "Master Owner")).toBe("Master Owner");
  });

  it("falls back to 'Usuário' when neither name is available", () => {
    expect(resolveGreetingName(undefined, undefined)).toBe("Usuário");
    expect(resolveGreetingName(null, null)).toBe("Usuário");
    expect(resolveGreetingName("", "")).toBe("Usuário");
  });
});
