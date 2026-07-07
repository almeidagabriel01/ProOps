import {
  renderInternalLifecycleEmail,
  type InternalLifecycleEmailData,
} from "./lifecycle-internal";

function baseData(
  overrides: Partial<InternalLifecycleEmailData> = {},
): InternalLifecycleEmailData {
  return {
    event: "signup",
    user: {
      name: "João Silva",
      email: "joao@exemplo.com",
      phone: "+55 11 99999-0000",
    },
    tenant: {
      id: "tenant_abc123",
      company: "Automação XYZ",
      niche: "automacao_residencial",
    },
    ...overrides,
  };
}

describe("renderInternalLifecycleEmail", () => {
  it("renders signup subject and heading with name and company", () => {
    const { subject, html } = renderInternalLifecycleEmail(baseData());
    expect(subject).toBe("[ProOps] Novo cadastro: João Silva — Automação XYZ");
    expect(html).toContain("Novo cadastro na plataforma");
    expect(html).toContain("joao@exemplo.com");
    expect(html).toContain("+55 11 99999-0000");
    expect(html).toContain("tenant_abc123");
    expect(html).toContain("automacao_residencial");
  });

  it("renders team_member_added subject", () => {
    const { subject, html } = renderInternalLifecycleEmail(
      baseData({ event: "team_member_added" }),
    );
    expect(subject).toBe(
      "[ProOps] Novo membro de equipe: João Silva — Automação XYZ",
    );
    expect(html).toContain("Novo membro de equipe adicionado");
  });

  it("renders new_subscription subject with tier and interval", () => {
    const { subject, html } = renderInternalLifecycleEmail(
      baseData({
        event: "new_subscription",
        plan: { to: "pro", interval: "mensal" },
      }),
    );
    expect(subject).toBe("[ProOps] Nova assinatura: Automação XYZ → pro (mensal)");
    expect(html).toContain("Nova assinatura contratada");
    expect(html).toContain("Recorrência");
    expect(html).toContain("mensal");
  });

  it("renders plan_upgrade subject with from → to", () => {
    const { subject } = renderInternalLifecycleEmail(
      baseData({ event: "plan_upgrade", plan: { from: "starter", to: "pro" } }),
    );
    expect(subject).toBe(
      "[ProOps] Upgrade de plano: Automação XYZ — starter → pro",
    );
  });

  it("renders plan_downgrade with effectiveAt row when present", () => {
    const { subject, html } = renderInternalLifecycleEmail(
      baseData({
        event: "plan_downgrade",
        plan: { from: "pro", to: "starter", effectiveAtLabel: "01/08/2026" },
      }),
    );
    expect(subject).toBe(
      "[ProOps] Downgrade de plano: Automação XYZ — pro → starter",
    );
    expect(html).toContain("Efetivo em");
    expect(html).toContain("01/08/2026");
  });

  it("omits the effectiveAt row when not provided", () => {
    const { html } = renderInternalLifecycleEmail(
      baseData({
        event: "plan_downgrade",
        plan: { from: "pro", to: "starter" },
      }),
    );
    expect(html).not.toContain("Efetivo em");
  });

  it("renders cancel_scheduled with effective date", () => {
    const { subject, html } = renderInternalLifecycleEmail(
      baseData({
        event: "cancel_scheduled",
        plan: { from: "pro", to: "free", effectiveAtLabel: "15/08/2026" },
      }),
    );
    expect(subject).toBe("[ProOps] Cancelamento agendado: Automação XYZ");
    expect(html).toContain("15/08/2026");
  });

  it("renders cancel_rescinded", () => {
    const { subject } = renderInternalLifecycleEmail(
      baseData({ event: "cancel_rescinded", plan: { from: "pro" } }),
    );
    expect(subject).toBe("[ProOps] Cancelamento revertido: Automação XYZ");
  });

  it("renders subscription_canceled", () => {
    const { subject, html } = renderInternalLifecycleEmail(
      baseData({
        event: "subscription_canceled",
        plan: { from: "pro", to: "free" },
      }),
    );
    expect(subject).toBe(
      "[ProOps] Assinatura cancelada: Automação XYZ — pro → free",
    );
    expect(html).toContain("Assinatura cancelada");
  });

  it("prefixes subject with [DEV] when isDev", () => {
    const { subject } = renderInternalLifecycleEmail(
      baseData({ isDev: true }),
    );
    expect(subject).toBe(
      "[DEV] [ProOps] Novo cadastro: João Silva — Automação XYZ",
    );
  });

  it("escapes HTML in user-controlled fields", () => {
    const { html } = renderInternalLifecycleEmail(
      baseData({
        user: { name: '<script>alert("x")</script>', email: "a@b.com" },
        tenant: { id: "t1", company: "Empresa <b>" },
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Empresa &lt;b&gt;");
  });

  it("renders 'Não informado' for missing phone and niche", () => {
    const { html } = renderInternalLifecycleEmail(
      baseData({
        user: { name: "João", email: "a@b.com" },
        tenant: { id: "t1", company: "Empresa" },
      }),
    );
    expect(html).toContain("Não informado");
  });
});
