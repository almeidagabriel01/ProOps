import { describe, it, expect } from "vitest";
import { buildTenantSavePlan } from "../tenant-save-plan";
import type { TenantBillingInfo } from "@/services/admin-service";
import type { TenantFormData } from "@/components/admin/tenant-dialog";

function item(overrides: Partial<TenantBillingInfo> = {}): TenantBillingInfo {
  return {
    tenant: {
      id: "t1",
      name: "Empresa",
      createdAt: "2026-01-01",
      primaryColor: "#111111",
      niche: "cortinas",
      whatsappEnabled: false,
    },
    admin: {
      id: "u1",
      email: "dono@empresa.com",
      phoneNumber: "+5511999999999",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    },
    planName: "Pro",
    planId: "pro",
    subscriptionStatus: "active",
    usage: {
      users: 0,
      proposals: 0,
      clients: 0,
      products: 0,
      transactions: 0,
      wallets: 0,
      calendarEvents: 0,
    },
    billingManagedBy: "manual",
    ...overrides,
  };
}

function form(overrides: Partial<TenantFormData> = {}): TenantFormData {
  return {
    name: "Empresa",
    userName: "",
    color: "#111111",
    logoUrl: "",
    niche: "cortinas",
    email: "dono@empresa.com",
    password: "",
    phoneNumber: "+5511999999999",
    whatsappEnabled: false,
    planId: "pro",
    subscriptionStatus: "active",
    currentPeriodEnd: "2026-10-01",
    ...overrides,
  };
}

describe("buildTenantSavePlan", () => {
  it("renomear uma empresa Stripe NAO toca assinatura (o bug que a rebaixava)", () => {
    const plan = buildTenantSavePlan(
      item({ billingManagedBy: "stripe" }),
      form({ name: "Empresa Nova" }),
    );
    expect(plan.tenantUpdate).toEqual({ name: "Empresa Nova" });
    expect(plan.subscription).toBeNull();
    expect(plan.planChange).toBeNull();
    expect(plan.credentials).toBeNull();
  });

  it("renomear uma empresa manual tambem nao reescreve a assinatura", () => {
    const plan = buildTenantSavePlan(item(), form({ name: "Outra" }));
    expect(plan.subscription).toBeNull();
  });

  it("empresa Stripe ignora troca de plano e de data", () => {
    const plan = buildTenantSavePlan(
      item({ billingManagedBy: "stripe" }),
      form({ planId: "enterprise", currentPeriodEnd: "2027-09-01" }),
    );
    expect(plan.planChange).toBeNull();
    expect(plan.subscription).toBeNull();
  });

  it("contrato manual: mudar a data envia so a data, como manual", () => {
    const plan = buildTenantSavePlan(item(), form({ currentPeriodEnd: "2027-09-14" }));
    expect(plan.subscription).toEqual({
      currentPeriodEnd: "2027-09-14",
      isManualSubscription: true,
    });
    expect(plan.planChange).toBeNull();
  });

  it("free virando Enterprise manual troca plano e grava o contrato", () => {
    const plan = buildTenantSavePlan(
      item({ planId: "free", admin: { id: "u1", email: "dono@empresa.com" } }),
      form({ planId: "enterprise", currentPeriodEnd: "2027-09-21" }),
    );
    expect(plan.planChange).toBe("enterprise");
    expect(plan.subscription).toEqual({
      currentPeriodEnd: "2027-09-21",
      isManualSubscription: true,
    });
  });

  it("voltar para free encerra o contrato manual", () => {
    const plan = buildTenantSavePlan(item(), form({ planId: "free" }));
    expect(plan.planChange).toBe("free");
    expect(plan.subscription).toEqual({ isManualSubscription: false });
  });

  it("credenciais: so e-mail alterado (normalizado) e senha preenchida", () => {
    const plan = buildTenantSavePlan(
      item(),
      form({ email: " DONO@empresa.com ", password: "segredo1" }),
    );
    expect(plan.credentials).toEqual({ password: "segredo1" });
  });

  it("limpar o telefone e uma mudanca real", () => {
    const plan = buildTenantSavePlan(item(), form({ phoneNumber: "" }));
    expect(plan.credentials).toEqual({ phoneNumber: "" });
  });

  it("sem mudanca nenhuma, nada e enviado", () => {
    expect(buildTenantSavePlan(item(), form())).toEqual({
      tenantUpdate: null,
      planChange: null,
      credentials: null,
      subscription: null,
    });
  });
});
