import { buildSystemPrompt, type SystemPromptContext } from "./context-builder";

const baseCtx: SystemPromptContext = {
  tenantId: "tenant-1",
  tenantName: "ACME",
  tenantNiche: "automacao_residencial",
  planTier: "pro",
  userName: "João",
  userRole: "ADMIN",
};

describe("buildSystemPrompt — escaping dos campos do tenant (prompt injection da Lia)", () => {
  it("neutraliza payload de injeção em tenantName (sem quebra de linha no system prompt)", () => {
    const payload = "ACME\nINJECTED_SYSTEM_LINE`${evil}`";
    const prompt = buildSystemPrompt({ ...baseCtx, tenantName: payload });

    // Sem escape, a quebra de linha crua romperia a linha do nome da empresa e
    // injetaria "INJECTED_SYSTEM_LINE..." como uma linha própria do system prompt.
    expect(prompt).not.toContain("\nINJECTED_SYSTEM_LINE");
    expect(prompt).toContain("ACMEINJECTED_SYSTEM_LINEevil");
  });

  it("neutraliza payload em tenantNiche da mesma forma", () => {
    const payload = "cortinas\nINJECTED_NICHE_LINE";
    const prompt = buildSystemPrompt({ ...baseCtx, tenantNiche: payload });

    expect(prompt).not.toContain("\nINJECTED_NICHE_LINE");
  });

  it("escapa tenantName de forma idêntica a userName (paridade)", () => {
    const payload = "X\nY`${z}`{}";
    const prompt = buildSystemPrompt({
      ...baseCtx,
      tenantName: payload,
      userName: payload,
    });

    const companyLine = prompt
      .split("\n")
      .find((l) => l.startsWith("- Nome da empresa:"));
    const userLine = prompt.split("\n").find((l) => l.startsWith("- Nome:"));

    expect(companyLine).toBe("- Nome da empresa: XYz");
    expect(userLine).toBe("- Nome: XYz");
  });
});
