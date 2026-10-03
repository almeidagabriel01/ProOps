/**
 * One-shot: troca o nicho de uma empresa que ainda NÃO usou a conta.
 *
 * O nicho é fixo depois do cadastro (rules, `PUT /v1/tenants` e o painel
 * recusam a troca), porque catálogo, proposta e obra de uma empresa são
 * gravados no formato do nicho dela. A exceção é a conta que nasceu no nicho
 * errado e está vazia: não há nada gravado no formato antigo, então trocar é
 * seguro. Este script só troca nesse caso, e recusa se achar qualquer dado.
 *
 * Junto com o nicho, o tutorial dos usuários da empresa volta ao estado de
 * conta nova, para abrir sozinho no próximo acesso já no vocabulário do nicho
 * novo. A demonstração que a conta free vê sai do nicho, sem nada a gravar.
 *
 *   cd apps/functions
 *   GCLOUD_PROJECT=<projeto> npx tsx src/scripts/migrate-tenant-niche.ts --tenant=<id> --niche=<nicho>           # só mostra
 *   GCLOUD_PROJECT=<projeto> npx tsx src/scripts/migrate-tenant-niche.ts --tenant=<id> --niche=<nicho> --apply   # grava
 *
 * Idempotente: rodar de novo com o nicho já trocado não grava nada.
 */
import { isTenantNiche, type TenantNicheId } from "../shared/niches";

/** Coleções de dado da empresa: qualquer documento aqui impede a troca. */
export const TENANT_DATA_COLLECTIONS = [
  "proposals",
  "products",
  "services",
  "clients",
  "ambientes",
  "sistemas",
  "transactions",
  "wallets",
  "projects",
  "customer_equipment",
  "service_orders",
  "leads",
  "tasks",
  "calendar_events",
  "custom_fields",
  "proposal_templates",
  "spreadsheets",
] as const;

/** Configurações gravadas uma vez com o padrão do nicho (`<coleção>/<tenantId>`). */
export const NICHE_SEEDED_SETTINGS = ["booking_settings", "project_settings"] as const;

export interface NicheMigrationInput {
  tenant: { niche?: unknown } | null;
  targetNiche: string;
  /** Documentos por coleção de `TENANT_DATA_COLLECTIONS`. */
  dataCounts: Record<string, number>;
  /** Quais de `NICHE_SEEDED_SETTINGS` existem para a empresa. */
  existingSettings: string[];
  userIds: string[];
  companyExists: boolean;
  nowIso: string;
}

export type NicheMigrationPlan =
  | { ok: false; reasons: string[] }
  | { ok: true; noop: true }
  | {
      ok: true;
      noop: false;
      from: unknown;
      to: TenantNicheId;
      tenantUpdate: { niche: TenantNicheId };
      companyUpdate: { niche: TenantNicheId } | null;
      onboardingResets: Array<{ uid: string; onboarding: Record<string, unknown> }>;
    };

/** O mesmo estado com que o cadastro cria o tutorial. */
export function freshOnboarding(nowIso: string): Record<string, unknown> {
  return {
    version: "core-v2",
    status: "active",
    completedStepIds: [],
    currentStepId: "dashboard",
    startedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function planTenantNicheMigration(input: NicheMigrationInput): NicheMigrationPlan {
  const reasons: string[] = [];
  if (!input.tenant) reasons.push("empresa não encontrada");
  if (!isTenantNiche(input.targetNiche)) reasons.push(`nicho desconhecido: ${input.targetNiche}`);
  if (reasons.length) return { ok: false, reasons };

  if (input.tenant?.niche === input.targetNiche) return { ok: true, noop: true };

  for (const [collection, count] of Object.entries(input.dataCounts)) {
    if (count > 0) reasons.push(`${collection}: ${count} documento(s)`);
  }
  for (const settings of input.existingSettings) reasons.push(`${settings} já gravado com o padrão do nicho antigo`);
  if (reasons.length) return { ok: false, reasons: ["a conta já tem dados no nicho atual", ...reasons] };

  const to = input.targetNiche as TenantNicheId;
  return {
    ok: true,
    noop: false,
    from: input.tenant?.niche,
    to,
    tenantUpdate: { niche: to },
    companyUpdate: input.companyExists ? { niche: to } : null,
    onboardingResets: input.userIds.map((uid) => ({ uid, onboarding: freshOnboarding(input.nowIso) })),
  };
}

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main(): Promise<void> {
  const tenantId = arg("tenant");
  const targetNiche = arg("niche");
  const apply = process.argv.includes("--apply");
  if (!tenantId || !targetNiche) {
    console.error("Uso: --tenant=<id> --niche=<nicho> [--apply]");
    process.exit(1);
  }
  const { db } = await import("../init");
  console.log(`--- migrate-tenant-niche (${apply ? "APLICANDO" : "dry-run"}) em ${process.env.GCLOUD_PROJECT ?? "?"} ---`);

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const dataCounts: Record<string, number> = {};
  for (const collection of TENANT_DATA_COLLECTIONS) {
    dataCounts[collection] = (await db.collection(collection).where("tenantId", "==", tenantId).count().get()).data().count;
  }
  const existingSettings: string[] = [];
  for (const settings of NICHE_SEEDED_SETTINGS) {
    if ((await db.collection(settings).doc(tenantId).get()).exists) existingSettings.push(settings);
  }
  const users = await db.collection("users").where("tenantId", "==", tenantId).limit(50).get();
  const companyExists = (await db.collection("companies").doc(tenantId).get()).exists;

  const plan = planTenantNicheMigration({
    tenant: tenantSnap.exists ? (tenantSnap.data() as { niche?: unknown }) : null,
    targetNiche,
    dataCounts,
    existingSettings,
    userIds: users.docs.map((d) => d.id),
    companyExists,
    nowIso: new Date().toISOString(),
  });

  if (!plan.ok) {
    console.error("Recusado:\n  - " + plan.reasons.join("\n  - "));
    process.exit(1);
  }
  if (plan.noop) {
    console.log(`Nada a fazer: a empresa já está em ${targetNiche}.`);
    process.exit(0);
  }
  console.log(`Empresa ${tenantId}: ${String(plan.from)} -> ${plan.to}`);
  console.log(`companies/${tenantId}: ${plan.companyUpdate ? "atualiza o nicho" : "não existe, nada a fazer"}`);
  console.log(`Tutorial reiniciado para ${plan.onboardingResets.length} usuário(s): ${plan.onboardingResets.map((r) => r.uid).join(", ")}`);
  if (!apply) {
    console.log("Dry-run: nada foi gravado. Rode com --apply para gravar.");
    process.exit(0);
  }

  const batch = db.batch();
  batch.update(db.collection("tenants").doc(tenantId), plan.tenantUpdate);
  if (plan.companyUpdate) batch.update(db.collection("companies").doc(tenantId), plan.companyUpdate);
  for (const reset of plan.onboardingResets) {
    batch.update(db.collection("users").doc(reset.uid), { onboarding: reset.onboarding });
  }
  await batch.commit();
  console.log("Gravado.");
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  });
}
