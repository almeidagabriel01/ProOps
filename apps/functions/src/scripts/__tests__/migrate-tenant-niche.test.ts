import {
  NICHE_SEEDED_SETTINGS,
  TENANT_DATA_COLLECTIONS,
  planTenantNicheMigration,
  type NicheMigrationInput,
} from "../migrate-tenant-niche";

const NOW = "2026-09-27T12:00:00.000Z";
const emptyCounts = () => Object.fromEntries(TENANT_DATA_COLLECTIONS.map((c) => [c, 0]));

const input = (over: Partial<NicheMigrationInput> = {}): NicheMigrationInput => ({
  tenant: { niche: "cortinas" },
  targetNiche: "vidracaria_esquadrias",
  dataCounts: emptyCounts(),
  existingSettings: [],
  userIds: ["uid-1"],
  companyExists: false,
  nowIso: NOW,
  ...over,
});

describe("planTenantNicheMigration", () => {
  it("conta vazia: troca o nicho e reinicia o tutorial como conta nova", () => {
    const plan = planTenantNicheMigration(input());
    expect(plan).toEqual({
      ok: true,
      noop: false,
      from: "cortinas",
      to: "vidracaria_esquadrias",
      tenantUpdate: { niche: "vidracaria_esquadrias" },
      companyUpdate: null,
      onboardingResets: [
        {
          uid: "uid-1",
          onboarding: {
            version: "core-v2",
            status: "active",
            completedStepIds: [],
            currentStepId: "dashboard",
            startedAt: NOW,
            updatedAt: NOW,
          },
        },
      ],
    });
  });

  it("o tutorial reiniciado não carrega welcomeSeenAt, então as boas-vindas abrem de novo", () => {
    const plan = planTenantNicheMigration(input());
    if (!plan.ok || plan.noop) throw new Error("esperava um plano");
    expect(plan.onboardingResets[0].onboarding).not.toHaveProperty("welcomeSeenAt");
  });

  it("atualiza também companies quando o documento existe", () => {
    const plan = planTenantNicheMigration(input({ companyExists: true }));
    if (!plan.ok || plan.noop) throw new Error("esperava um plano");
    expect(plan.companyUpdate).toEqual({ niche: "vidracaria_esquadrias" });
  });

  it.each([...TENANT_DATA_COLLECTIONS])("recusa se a conta tem %s", (collection) => {
    const plan = planTenantNicheMigration(input({ dataCounts: { ...emptyCounts(), [collection]: 1 } }));
    expect(plan.ok).toBe(false);
  });

  it.each([...NICHE_SEEDED_SETTINGS])("recusa se %s já foi gravado com o padrão antigo", (settings) => {
    const plan = planTenantNicheMigration(input({ existingSettings: [settings] }));
    expect(plan.ok).toBe(false);
  });

  it("recusa nicho desconhecido, inclusive nome do protótipo", () => {
    expect(planTenantNicheMigration(input({ targetNiche: "marcenaria" })).ok).toBe(false);
    expect(planTenantNicheMigration(input({ targetNiche: "constructor" })).ok).toBe(false);
  });

  it("recusa empresa inexistente", () => {
    expect(planTenantNicheMigration(input({ tenant: null })).ok).toBe(false);
  });

  it("já no nicho de destino: não grava nada", () => {
    expect(planTenantNicheMigration(input({ tenant: { niche: "vidracaria_esquadrias" } }))).toEqual({
      ok: true,
      noop: true,
    });
  });
});
