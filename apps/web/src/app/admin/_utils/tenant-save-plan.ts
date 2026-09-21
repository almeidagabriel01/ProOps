import type { TenantBillingInfo } from "@/services/admin-service";
import type { TenantFormData } from "@/components/admin/tenant-dialog";
import type { TenantNiche } from "@/types";

/**
 * O que salvar ao editar uma empresa no painel, comparando o formulario com o
 * que foi carregado. Funcao pura para o hook so executar as chamadas.
 *
 * Existe porque o save antigo mandava TUDO sempre, inclusive
 * `isManualSubscription: true` em todo plano pago. Renomear uma empresa que
 * paga pelo Stripe a colocava no cron de assinaturas manuais, que a rebaixa
 * para free quando a data passa.
 */
export interface TenantSavePlan {
  tenantUpdate: Partial<{
    name: string;
    primaryColor: string;
    logoUrl: string;
    niche: TenantNiche;
    whatsappEnabled: boolean;
  }> | null;
  planChange: string | null;
  credentials: { email?: string; password?: string; phoneNumber?: string } | null;
  subscription: {
    currentPeriodEnd?: string;
    isManualSubscription: boolean;
  } | null;
}

export function isStripeManaged(item: TenantBillingInfo): boolean {
  return item.billingManagedBy === "stripe";
}

function dateOnly(value?: string | null): string {
  return (value || "").split("T")[0];
}

export function buildTenantSavePlan(
  editing: TenantBillingInfo,
  form: TenantFormData,
): TenantSavePlan {
  const stripeManaged = isStripeManaged(editing);

  const tenantUpdate: NonNullable<TenantSavePlan["tenantUpdate"]> = {};
  if (form.name.trim() !== editing.tenant.name) tenantUpdate.name = form.name.trim();
  if (form.color !== (editing.tenant.primaryColor || "#3b82f6")) {
    tenantUpdate.primaryColor = form.color;
  }
  if ((form.logoUrl || "") !== (editing.tenant.logoUrl || "")) {
    tenantUpdate.logoUrl = form.logoUrl || "";
  }
  if (form.niche !== (editing.tenant.niche || "automacao_residencial")) {
    tenantUpdate.niche = form.niche;
  }
  if (Boolean(form.whatsappEnabled) !== Boolean(editing.tenant.whatsappEnabled)) {
    tenantUpdate.whatsappEnabled = Boolean(form.whatsappEnabled);
  }

  const previousPlan = editing.planId || "free";
  const nextPlan = form.planId || "free";
  const planChange = !stripeManaged && nextPlan !== previousPlan ? nextPlan : null;

  const credentials: NonNullable<TenantSavePlan["credentials"]> = {};
  const email = (form.email || "").trim().toLowerCase();
  if (email && email !== (editing.admin.email || "").trim().toLowerCase()) {
    credentials.email = email;
  }
  if (form.password) credentials.password = form.password;
  if ((form.phoneNumber || "") !== (editing.admin.phoneNumber || "")) {
    credentials.phoneNumber = form.phoneNumber || "";
  }

  let subscription: TenantSavePlan["subscription"] = null;
  if (!stripeManaged) {
    if (nextPlan === "free") {
      // Voltar para free encerra o contrato manual; sem isso o cron seguiria
      // olhando uma data de um plano que nao existe mais.
      if (previousPlan !== "free") subscription = { isManualSubscription: false };
    } else {
      const periodChanged =
        dateOnly(form.currentPeriodEnd) !== dateOnly(editing.admin.currentPeriodEnd);
      if ((periodChanged || planChange) && dateOnly(form.currentPeriodEnd)) {
        subscription = {
          currentPeriodEnd: dateOnly(form.currentPeriodEnd),
          isManualSubscription: true,
        };
      }
    }
  }

  return {
    tenantUpdate: Object.keys(tenantUpdate).length > 0 ? tenantUpdate : null,
    planChange,
    credentials: Object.keys(credentials).length > 0 ? credentials : null,
    subscription,
  };
}
