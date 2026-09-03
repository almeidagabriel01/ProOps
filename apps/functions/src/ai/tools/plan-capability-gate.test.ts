import { TOOL_REGISTRY, buildAvailableTools } from "./index";
import { applyAddonsToCapabilities } from "../../shared/addon-definitions";
import { resolvePlanCapabilities } from "../../shared/plan-capabilities";
import type { PlanTierId } from "../../shared/plan-capabilities";
import type { AddonId } from "../../shared/addon-definitions";

function toolNamesFor(
  tier: PlanTierId,
  addons: AddonId[] = [],
  role = "ADMIN",
  tenantData: { whatsappEnabled?: boolean } = { whatsappEnabled: true },
): string[] {
  const capabilities =
    addons.length === 0
      ? resolvePlanCapabilities(tier)
      : applyAddonsToCapabilities(
          {
            capabilities: resolvePlanCapabilities(tier),
            limits: {
              maxProposalsPerMonth: 0,
              maxClients: 0,
              maxProducts: 0,
              maxUsers: 0,
              maxWallets: 0,
              maxSpreadsheets: 0,
              maxPdfTemplates: 1,
              maxImagesPerProduct: 0,
              storageQuotaMB: 0,
              aiMessagesPerMonth: 0,
            },
          },
          addons,
        ).capabilities;

  const built = buildAvailableTools(capabilities, role, tenantData, {});
  return (built[0]?.functionDeclarations ?? []).map((d) => d.name);
}

const FINANCIAL_TOOLS = TOOL_REGISTRY.filter(
  (e) => e.capability === "financial",
).map((e) => e.declaration.name);
const CRM_TOOLS = TOOL_REGISTRY.filter((e) => e.capability === "crm").map(
  (e) => e.declaration.name,
);

describe("gate de plano das ferramentas da Lia", () => {
  it("nenhuma ferramenta declara plano por conta propria", () => {
    // O registro tinha um `minPlan` proprio, e foi assim que o CRM acabou com
    // quatro regras: UI dizia Enterprise, a Lia dizia Pro, o add-on era vendido
    // a Starter e Pro, e a REST nao bloqueava. Ler o catalogo elimina isso.
    for (const entry of TOOL_REGISTRY) {
      expect(entry).not.toHaveProperty("minPlan");
    }
  });

  it("Starter nao ve ferramenta de financeiro nem de CRM", () => {
    const tools = toolNamesFor("starter");
    for (const name of [...FINANCIAL_TOOLS, ...CRM_TOOLS]) {
      expect(tools).not.toContain(name);
    }
    expect(tools).toContain("list_proposals");
  });

  it("Pro ve financeiro, mas NAO ve CRM", () => {
    // Este era o desalinhamento: a Lia entregava CRM ao Pro enquanto a tela
    // dizia Enterprise.
    const tools = toolNamesFor("pro");
    for (const name of FINANCIAL_TOOLS) expect(tools).toContain(name);
    for (const name of CRM_TOOLS) expect(tools).not.toContain(name);
  });

  it("Enterprise ve tudo, CRM e WhatsApp inclusive", () => {
    const tools = toolNamesFor("enterprise");
    for (const name of [...FINANCIAL_TOOLS, ...CRM_TOOLS]) {
      expect(tools).toContain(name);
    }
    expect(tools).toContain("send_whatsapp_message");
  });

  it("o add-on financeiro abre as ferramentas para um Starter", () => {
    // O bug: quem PAGOU o add-on via a tela abrir e a Lia recusar.
    const tools = toolNamesFor("starter", ["financial"]);
    for (const name of FINANCIAL_TOOLS) expect(tools).toContain(name);
    for (const name of CRM_TOOLS) expect(tools).not.toContain(name);
  });

  it("o add-on de CRM abre as ferramentas de CRM para um Pro", () => {
    const tools = toolNamesFor("pro", ["crm"]);
    for (const name of CRM_TOOLS) expect(tools).toContain(name);
  });

  it("WhatsApp exige plano E a flag do tenant", () => {
    expect(
      toolNamesFor("enterprise", [], "ADMIN", { whatsappEnabled: false }),
    ).not.toContain("send_whatsapp_message");
    expect(toolNamesFor("pro", [], "ADMIN", { whatsappEnabled: true })).not.toContain(
      "send_whatsapp_message",
    );
  });
});
