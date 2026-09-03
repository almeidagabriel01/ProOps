/**
 * Regressão: a Lia era um desvio completo do sistema de permissões.
 *
 * Os handlers de ferramenta chamam os services direto (proposals.service,
 * contacts.service, products.service, wallets.service, transaction-ai.service)
 * e NENHUM desses services checa permissão — ao contrário dos controllers
 * equivalentes, que checam. O resultado era que um membro com tudo desmarcado
 * podia pedir à Lia para criar e apagar proposta, contato, produto, lançamento
 * e carteira, transferir entre carteiras e pagar parcela.
 *
 * Estes testes falham se uma ferramenta de escrita voltar a ser executável sem
 * a permissão correspondente, ou se uma ferramenta nova nascer sem declarar a
 * sua.
 */

jest.mock("../../init", () => ({ db: {} }));

import { executeToolCall } from "./executor";
import { TOOL_REGISTRY, buildAvailableTools } from "./index";
import { resolvePlanCapabilities } from "../../shared/plan-capabilities";

const MEMBER = {
  tenantId: "tenant-1",
  uid: "member-1",
  role: "MEMBER",
  planTier: "enterprise" as const,
  capabilities: resolvePlanCapabilities("enterprise"),
  confirmed: true,
  sessionId: "s1",
};

describe("toda ferramenta de dominio declara a permissao que exige", () => {
  const UTILITIES = new Set([
    "get_tenant_summary",
    "search_help",
    "request_confirmation",
    "send_whatsapp_message",
  ]);

  it.each(
    TOOL_REGISTRY.map((entry) => entry.declaration.name).filter(
      (name) => !UTILITIES.has(name),
    ),
  )("%s tem pageId e acao", (name) => {
    const entry = TOOL_REGISTRY.find((e) => e.declaration.name === name);
    expect(entry?.permission).not.toBeNull();
    expect(entry?.permission?.pageId).toBeTruthy();
    expect(entry?.permission?.action).toMatch(
      /^can(View|Create|Edit|Delete)$/,
    );
  });
});

/**
 * O que estava REALMENTE aberto. `minRole: "admin"` no registry já barrava as
 * ferramentas destrutivas (delete_*, update_*, transfer, pay_installment) para
 * qualquer membro — o buraco eram as de CRIAÇÃO e as de leitura, que são
 * `minRole: "member"` e não checavam nada além do plano.
 */
describe("membro sem permissao nao executa a ferramenta", () => {
  const MEMBER_ROLE_TOOLS: Array<[string, string]> = [
    ["create_proposal", "proposals"],
    ["update_proposal_status", "proposals"],
    ["list_proposals", "proposals"],
    ["get_proposal", "proposals"],
    ["create_contact", "clients"],
    ["list_contacts", "clients"],
    ["get_contact", "clients"],
    ["create_product", "products"],
    ["list_products", "products"],
    ["get_product", "products"],
    ["create_transaction", "transactions"],
    ["list_transactions", "transactions"],
    ["list_wallets", "wallet"],
    ["list_crm_leads", "kanban"],
    ["update_crm_status", "kanban"],
  ];

  it.each(MEMBER_ROLE_TOOLS)(
    "%s e negada quando falta permissao em %s",
    async (tool, pageId) => {
      const result = await executeToolCall(tool, {}, { ...MEMBER, permissions: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain(pageId);
    },
  );

  const ADMIN_ROLE_TOOLS = [
    "delete_proposal",
    "update_proposal",
    "delete_contact",
    "update_contact",
    "delete_product",
    "update_product",
    "delete_transaction",
    "pay_installment",
    "create_wallet",
    "transfer_between_wallets",
  ];

  it.each(ADMIN_ROLE_TOOLS)(
    "%s segue barrada para membro pelo minRole do registry",
    async (tool) => {
      const result = await executeToolCall(tool, {}, { ...MEMBER, permissions: {} });
      expect(result.success).toBe(false);
    },
  );

  it("nao vaza permissao entre paginas: carteira nao libera lancamento", async () => {
    const result = await executeToolCall(
      "create_transaction",
      {},
      { ...MEMBER, permissions: { wallet: { canCreate: true } } },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("transactions");
  });

  it("nao aceita a acao errada: canView nao libera criar", async () => {
    const result = await executeToolCall(
      "create_proposal",
      {},
      { ...MEMBER, permissions: { proposals: { canView: true } } },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("proposals");
  });

  it("um doc legado chamado financial nao libera nada", async () => {
    const result = await executeToolCall(
      "create_transaction",
      {},
      {
        ...MEMBER,
        permissions: { financial: { canCreate: true, canDelete: true } },
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("transactions");
  });
});

describe("bypass de administrador do tenant", () => {
  it.each(["MASTER", "ADMIN", "WK", "SUPERADMIN"])(
    "%s passa do gate de permissao sem doc nenhum",
    async (role) => {
      const result = await executeToolCall(
        "create_proposal",
        {},
        { ...MEMBER, role, permissions: {} },
      );

      // Passa do gate e falha adiante, na validacao de argumentos — o que
      // prova que nao foi barrado por permissao.
      expect(result.error).not.toContain("permissao para esta acao");
    },
  );
});

describe("o modelo nao recebe a declaracao do que nao pode executar", () => {
  function toolNames(permissions: Record<string, Record<string, boolean>>) {
    const built = buildAvailableTools(resolvePlanCapabilities("enterprise"), "MEMBER", {}, permissions);
    return built.flatMap((group) =>
      (group.functionDeclarations ?? []).map((d) => d.name),
    );
  }

  it("membro sem permissao nenhuma so ve os utilitarios", () => {
    expect(toolNames({}).sort()).toEqual([
      "get_tenant_summary",
      "request_confirmation",
      "search_help",
    ]);
  });

  it("membro com leitura de propostas ve list/get mas nao create/delete", () => {
    const names = toolNames({ proposals: { canView: true } });
    expect(names).toContain("list_proposals");
    expect(names).toContain("get_proposal");
    expect(names).not.toContain("create_proposal");
    expect(names).not.toContain("delete_proposal");
  });

  it("admin do tenant ve o conjunto completo do plano", () => {
    const built = buildAvailableTools(resolvePlanCapabilities("enterprise"), "MASTER", {}, {});
    const names = built.flatMap((group) =>
      (group.functionDeclarations ?? []).map((d) => d.name),
    );
    expect(names).toContain("create_proposal");
    expect(names).toContain("delete_transaction");
  });
});
