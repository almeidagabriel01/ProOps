/**
 * Contatos e produtos passaram a ser cobrados pelo `enforceTenantPlanLimit`,
 * com o plano do TENANT. Antes: contatos liam o plano do doc do usuario dono
 * (que diverge do tenant quando uma troca so atualizou um dos dois), e produtos
 * so bloqueavam se `subscription.limits.maxProducts` existisse no usuario, campo
 * que nenhum caminho grava; ou seja, nunca.
 */

jest.mock("../../init", () => ({ db: {}, auth: {}, adminApp: {} }));
jest.mock("../security-observability", () => ({
  logSecurityEvent: jest.fn(),
  incrementSecurityCounter: jest.fn(),
  writeSecurityAuditEvent: jest.fn(),
}));

import {
  buildCompatDefaultTenantPlanProfile,
  enforceTenantPlanLimit,
  setTenantPlanCacheForTest,
  type TenantPlanProfile,
} from "../tenant-plan-policy";
import { PLAN_CATALOG } from "../../shared/plan-capabilities";

function starter(tenantId: string): TenantPlanProfile {
  return buildCompatDefaultTenantPlanProfile({ tenantId, subscriptionStatus: "active" });
}

function pro(tenantId: string): TenantPlanProfile {
  const base = starter(tenantId);
  return {
    ...base,
    tier: "pro",
    limits: {
      ...base.limits,
      maxClients: PLAN_CATALOG.pro.limits.maxClients,
      maxProducts: PLAN_CATALOG.pro.limits.maxProducts,
      maxSpreadsheets: PLAN_CATALOG.pro.limits.maxSpreadsheets,
    },
  };
}

beforeAll(() => {
  process.env.TENANT_PLAN_ENFORCEMENT_MODE = "enforce";
});

it("o perfil do tenant carrega os tetos de contatos e produtos do catalogo", () => {
  const profile = starter("t-perfil");
  expect(profile.limits.maxClients).toBe(PLAN_CATALOG.starter.limits.maxClients);
  expect(profile.limits.maxProducts).toBe(PLAN_CATALOG.starter.limits.maxProducts);
  expect(profile.limits.maxSpreadsheets).toBe(5);
});

it.each([
  ["maxClients", 120],
  ["maxProducts", 220],
  ["maxSpreadsheets", 5],
] as const)("Starter: %s bloqueia no teto (%i) e libera abaixo dele", async (feature, teto) => {
  setTenantPlanCacheForTest("t-starter", starter("t-starter"));

  const abaixo = await enforceTenantPlanLimit({
    tenantId: "t-starter",
    feature,
    currentUsage: teto - 1,
  });
  expect(abaixo.allowed).toBe(true);

  const noTeto = await enforceTenantPlanLimit({
    tenantId: "t-starter",
    feature,
    currentUsage: teto,
  });
  expect(noTeto.allowed).toBe(false);
  expect(noTeto.statusCode).toBe(402);
});

it("Pro: contatos e produtos ilimitados, planilhas travam em 50", async () => {
  setTenantPlanCacheForTest("t-pro", pro("t-pro"));

  for (const feature of ["maxClients", "maxProducts"] as const) {
    const decision = await enforceTenantPlanLimit({
      tenantId: "t-pro",
      feature,
      currentUsage: 100_000,
    });
    expect(decision.allowed).toBe(true);
  }

  const planilhas = await enforceTenantPlanLimit({
    tenantId: "t-pro",
    feature: "maxSpreadsheets",
    currentUsage: 50,
  });
  expect(planilhas.allowed).toBe(false);
});

it("super admin passa mesmo no teto", async () => {
  setTenantPlanCacheForTest("t-sa", starter("t-sa"));
  const decision = await enforceTenantPlanLimit({
    tenantId: "t-sa",
    feature: "maxClients",
    currentUsage: 120,
    isSuperAdmin: true,
  });
  expect(decision.allowed).toBe(true);
});

describe("loadCurrentUsage: a contagem só roda quando o plano tem teto", () => {
  it("plano ilimitado (Pro) libera sem contar os documentos", async () => {
    setTenantPlanCacheForTest("t-pro-lazy", pro("t-pro-lazy"));
    const load = jest.fn().mockResolvedValue(999_999);
    for (const feature of ["maxClients", "maxProducts"] as const) {
      const decision = await enforceTenantPlanLimit({
        tenantId: "t-pro-lazy",
        feature,
        loadCurrentUsage: load,
      });
      expect(decision.allowed).toBe(true);
    }
    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    ["maxClients", 120],
    ["maxProducts", 220],
  ] as const)("Starter: %s conta e bloqueia no teto (%i)", async (feature, teto) => {
    setTenantPlanCacheForTest("t-starter-lazy", starter("t-starter-lazy"));

    const loadAbaixo = jest.fn().mockResolvedValue(teto - 1);
    const abaixo = await enforceTenantPlanLimit({
      tenantId: "t-starter-lazy",
      feature,
      loadCurrentUsage: loadAbaixo,
    });
    expect(loadAbaixo).toHaveBeenCalledTimes(1);
    expect(abaixo.allowed).toBe(true);

    const noTeto = await enforceTenantPlanLimit({
      tenantId: "t-starter-lazy",
      feature,
      loadCurrentUsage: jest.fn().mockResolvedValue(teto),
    });
    expect(noTeto.allowed).toBe(false);
    expect(noTeto.statusCode).toBe(402);
  });

  it("currentUsage explícito tem precedência e não chama o loader", async () => {
    setTenantPlanCacheForTest("t-starter-explicit", starter("t-starter-explicit"));
    const load = jest.fn().mockResolvedValue(0);
    const decision = await enforceTenantPlanLimit({
      tenantId: "t-starter-explicit",
      feature: "maxProducts",
      currentUsage: 220,
      loadCurrentUsage: load,
    });
    expect(decision.allowed).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });
});
