import type { Request, Response, NextFunction } from "express";

jest.mock("../../../lib/tenant-capabilities", () => ({
  resolveTenantCapabilities: jest.fn(),
}));
jest.mock("../../../lib/security-observability", () => ({
  incrementSecurityCounter: jest.fn().mockResolvedValue(undefined),
  writeSecurityAuditEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { requirePlanCapability } from "../require-plan-capability";
import { resolveTenantCapabilities } from "../../../lib/tenant-capabilities";
import {
  applyAddonsToCapabilities,
  type AddonId,
} from "../../../shared/addon-definitions";
import {
  resolvePlanCapabilities,
  resolvePlanLimits,
  type PlanTierId,
} from "../../../shared/plan-capabilities";

const resolveMock = resolveTenantCapabilities as jest.MockedFunction<
  typeof resolveTenantCapabilities
>;

function givenTenant(tier: PlanTierId, addons: AddonId[] = []) {
  const merged = applyAddonsToCapabilities(
    { capabilities: resolvePlanCapabilities(tier), limits: resolvePlanLimits(tier) },
    addons,
  );
  resolveMock.mockResolvedValue({
    tenantId: "t1",
    tier,
    capabilities: merged.capabilities,
    limits: merged.limits,
    activeAddons: addons,
  });
}

function buildReqRes(user: Record<string, unknown> | undefined = { tenantId: "t1", uid: "u1" }) {
  const req = { user, path: "/v1/transactions" } as unknown as Request;
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next, json };
}

async function run(
  capability: Parameters<typeof requirePlanCapability>[0],
  ctx: ReturnType<typeof buildReqRes>,
) {
  await requirePlanCapability(capability)(ctx.req, ctx.res, ctx.next);
}

describe("requirePlanCapability", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TENANT_PLAN_CAPABILITY_MODE = "enforce";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("modo enforce", () => {
    it("bloqueia Starter no financeiro, no CRM e no fiscal", async () => {
      for (const capability of ["financial", "crm", "fiscal"] as const) {
        givenTenant("starter");
        const ctx = buildReqRes();
        await run(capability, ctx);
        expect(ctx.next).not.toHaveBeenCalled();
        expect(ctx.res.status).toHaveBeenCalledWith(402);
        expect(ctx.json).toHaveBeenCalledWith(
          expect.objectContaining({ code: "PLAN_CAPABILITY_REQUIRED", capability }),
        );
      }
    });

    it("LIBERA o Starter que comprou o add-on financeiro", async () => {
      // O bug que motivou portar os add-ons para o backend: a compra existia e
      // o gate lia so o tier, entao quem pagou era recusado.
      givenTenant("starter", ["financial"]);
      const ctx = buildReqRes();
      await run("financial", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(ctx.res.status).not.toHaveBeenCalled();
    });

    it("LIBERA o Pro que comprou o add-on de CRM", async () => {
      givenTenant("pro", ["crm"]);
      const ctx = buildReqRes();
      await run("crm", ctx);
      expect(ctx.next).toHaveBeenCalled();
    });

    it("Pro tem financeiro, mas nao CRM nem fiscal", async () => {
      givenTenant("pro");
      const okCtx = buildReqRes();
      await run("financial", okCtx);
      expect(okCtx.next).toHaveBeenCalled();

      for (const capability of ["crm", "fiscal"] as const) {
        givenTenant("pro");
        const ctx = buildReqRes();
        await run(capability, ctx);
        expect(ctx.res.status).toHaveBeenCalledWith(402);
      }
    });

    it("Enterprise passa em tudo", async () => {
      for (const capability of [
        "financial",
        "crm",
        "fiscal",
        "whatsapp",
        "calendarSync",
        "pdfEditor",
        "customTheme",
      ] as const) {
        givenTenant("enterprise");
        const ctx = buildReqRes();
        await run(capability, ctx);
        expect(ctx.next).toHaveBeenCalled();
      }
    });

    it("aponta o plano minimo na resposta", async () => {
      givenTenant("starter");
      const ctx = buildReqRes();
      await run("fiscal", ctx);
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredPlan: "enterprise",
          message: expect.stringContaining("Enterprise"),
        }),
      );
    });

    it("diz tambem qual plano o BACKEND resolveu", async () => {
      // Sem isto, "plano insuficiente" e "dado desatualizado" produzem a mesma
      // resposta — e as duas exigem acoes opostas. O caso real: a tela mostrava
      // Enterprise (lido de `users/{uid}.planId`) e o gate resolvia outro tier
      // (de `tenants/{id}.plan`), sem nada na resposta que revelasse a
      // divergencia.
      givenTenant("pro");
      const ctx = buildReqRes();
      await run("fiscal", ctx);
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ currentPlan: "pro", requiredPlan: "enterprise" }),
      );
    });
  });

  describe("escapes", () => {
    it("superadmin nao e bloqueado e nem consulta o plano", async () => {
      const ctx = buildReqRes({ tenantId: "t1", uid: "root", isSuperAdmin: true });
      await run("fiscal", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(resolveMock).not.toHaveBeenCalled();
    });

    it("respeita TENANT_PLAN_SUPERADMIN_BYPASS=false", async () => {
      process.env.TENANT_PLAN_SUPERADMIN_BYPASS = "false";
      givenTenant("starter");
      const ctx = buildReqRes({ tenantId: "t1", uid: "root", isSuperAdmin: true });
      await run("fiscal", ctx);
      expect(ctx.res.status).toHaveBeenCalledWith(402);
    });

    it("modo monitor deixa passar e nao responde 402", async () => {
      process.env.TENANT_PLAN_CAPABILITY_MODE = "monitor";
      givenTenant("starter");
      const ctx = buildReqRes();
      await run("fiscal", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(ctx.res.status).not.toHaveBeenCalled();
    });

    it("modo off nem consulta o plano", async () => {
      process.env.TENANT_PLAN_CAPABILITY_MODE = "off";
      const ctx = buildReqRes();
      await run("fiscal", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(resolveMock).not.toHaveBeenCalled();
    });

    it("default do modo e monitor — ligar o gate e decisao explicita", async () => {
      delete process.env.TENANT_PLAN_CAPABILITY_MODE;
      givenTenant("starter");
      const ctx = buildReqRes();
      await run("fiscal", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(ctx.res.status).not.toHaveBeenCalled();
    });

    it("sem tenant resolvido, deixa o middleware de auth responder", async () => {
      const ctx = buildReqRes({ uid: "u1" });
      await run("fiscal", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(resolveMock).not.toHaveBeenCalled();
    });

    it("conta FREE passa — e o funil de demonstracao", async () => {
      // O frontend destrava hasFinancial/hasKanban para role=free navegar as
      // telas premium. Barrar aqui quebraria o funil; e seguro porque
      // require-active-subscription so deixa chegar aqui um GET em prefixo de
      // leitura de demo — mutacao morre antes com FREE_TIER_FORBIDDEN, e
      // fiscal e Asaas nem constam daquela lista.
      const ctx = buildReqRes({ tenantId: "t1", uid: "u1", role: "free" });
      await run("financial", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(ctx.res.status).not.toHaveBeenCalled();
      expect(resolveMock).not.toHaveBeenCalled();
    });

    it("role paga NAO recebe o bypass do free", async () => {
      givenTenant("starter");
      const ctx = buildReqRes({ tenantId: "t1", uid: "u1", role: "MASTER" });
      await run("financial", ctx);
      expect(ctx.res.status).toHaveBeenCalledWith(402);
    });

    it("falha de leitura NAO tira o modulo de quem paga (fail-open)", async () => {
      resolveMock.mockRejectedValue(new Error("firestore indisponivel"));
      const ctx = buildReqRes();
      await run("financial", ctx);
      expect(ctx.next).toHaveBeenCalled();
      expect(ctx.res.status).not.toHaveBeenCalled();
    });
  });
});
