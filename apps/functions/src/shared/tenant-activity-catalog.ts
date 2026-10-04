/**
 * Catálogo da atividade das empresas: o que um usuário de empresa fez dentro
 * do ERP, para o super admin acompanhar (`tenant_activity`).
 *
 * Fonte única, pura e sem import. O front espelha tipo, categoria e rótulo em
 * `apps/web/src/lib/activity/catalog.ts`, e
 * `apps/web/src/__tests__/activity-catalog-parity.test.ts` mantém os dois
 * iguais.
 *
 * PRIVACIDADE: cada tipo declara as únicas chaves de `meta` que aceita, e o
 * servidor descarta o resto. Nunca entra aqui texto digitado, rótulo de botão,
 * mensagem de erro, stack ou query string: a coleção responde "o que a pessoa
 * tentou fazer", não "o que ela escreveu".
 */

export const ACTIVITY_CATEGORIES = ["navigation", "action", "funnel", "error"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const SUBSCRIBE_CLICK_SOURCES = [
  "landing_pricing",
  "plan_card",
  "demo_banner",
  "upgrade_modal",
  "upgrade_required",
  "subscription_blocked",
  "subscribe_page",
] as const;

export const ROUTE_BLOCKED_REASONS = ["free_tier", "master_only", "permission"] as const;
export const UPGRADE_PROMPT_SURFACES = ["modal", "page"] as const;
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export const CHECKOUT_KINDS = ["new", "plan_change"] as const;

export type ActivityMetaField =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "string"; pattern: RegExp; max: number }
  | { kind: "int"; min: number; max: number }
  | { kind: "bool" };

const PLAN_TIER: ActivityMetaField = { kind: "string", pattern: /^[a-z0-9_-]{1,32}$/, max: 32 };
const INTERVAL: ActivityMetaField = { kind: "enum", values: BILLING_INTERVALS };
const API_PATH: ActivityMetaField = { kind: "string", pattern: /^\/[A-Za-z0-9/_\-[\].]*$/, max: 120 };
const FEATURE: ActivityMetaField = { kind: "string", pattern: /^[A-Za-z0-9_.-]{1,60}$/, max: 60 };
const STEP_ID: ActivityMetaField = { kind: "string", pattern: /^[a-z0-9_/-]{1,60}$/, max: 60 };

export interface ActivityTypeDefinition {
  category: ActivityCategory;
  label: string;
  /** O navegador pode mandar este tipo. Os demais só o servidor grava. */
  client: boolean;
  meta: Readonly<Record<string, ActivityMetaField>>;
}

export const TENANT_ACTIVITY_CATALOG = {
  page_view: { category: "navigation", label: "Abriu a tela", client: true, meta: {} },
  session_started: { category: "navigation", label: "Entrou no ERP", client: false, meta: {} },

  demo_write_blocked: {
    category: "action",
    label: "Tentou alterar dados na demonstração",
    client: true,
    meta: { method: { kind: "enum", values: HTTP_METHODS }, path: API_PATH },
  },
  route_blocked: {
    category: "action",
    label: "Tela bloqueada",
    client: true,
    meta: {
      reason: { kind: "enum", values: ROUTE_BLOCKED_REASONS },
      target: API_PATH,
    },
  },
  upgrade_prompt_shown: {
    category: "action",
    label: "Viu o aviso de plano",
    client: true,
    meta: { feature: FEATURE, surface: { kind: "enum", values: UPGRADE_PROMPT_SURFACES } },
  },
  onboarding_step_completed: {
    category: "action",
    label: "Concluiu um passo do tutorial",
    client: true,
    meta: { stepId: STEP_ID },
  },
  onboarding_exited: {
    category: "action",
    label: "Saiu do tutorial",
    client: true,
    meta: { stepId: STEP_ID },
  },
  team_member_added: { category: "action", label: "Membro adicionado à equipe", client: false, meta: {} },

  signup: { category: "funnel", label: "Criou a conta", client: false, meta: {} },
  upgrade_prompt_clicked: {
    category: "funnel",
    label: "Clicou no aviso de plano",
    client: true,
    meta: { feature: FEATURE, surface: { kind: "enum", values: UPGRADE_PROMPT_SURFACES } },
  },
  subscribe_clicked: {
    category: "funnel",
    label: "Clicou em Assinar",
    client: true,
    meta: {
      source: { kind: "enum", values: SUBSCRIBE_CLICK_SOURCES },
      plan: PLAN_TIER,
      interval: INTERVAL,
      skipTrial: { kind: "bool" },
    },
  },
  checkout_started: {
    category: "funnel",
    label: "Abriu o checkout",
    client: false,
    meta: {
      plan: PLAN_TIER,
      interval: INTERVAL,
      trial: { kind: "bool" },
      kind: { kind: "enum", values: CHECKOUT_KINDS },
    },
  },
  trial_started: {
    category: "funnel",
    label: "Começou o teste grátis",
    client: false,
    meta: { plan: PLAN_TIER, interval: INTERVAL },
  },
  subscribed: {
    category: "funnel",
    label: "Assinou",
    client: false,
    meta: { plan: PLAN_TIER, interval: INTERVAL },
  },
  plan_changed: {
    category: "funnel",
    label: "Trocou de plano",
    client: false,
    meta: { from: PLAN_TIER, to: PLAN_TIER },
  },
  cancel_scheduled: {
    category: "funnel",
    label: "Agendou o cancelamento",
    client: false,
    meta: { plan: PLAN_TIER },
  },
  subscription_canceled: {
    category: "funnel",
    label: "Assinatura encerrada",
    client: false,
    meta: { from: PLAN_TIER },
  },
  payment_failed: { category: "funnel", label: "Pagamento falhou", client: false, meta: {} },

  api_error: {
    category: "error",
    label: "Erro na API",
    client: true,
    meta: {
      method: { kind: "enum", values: HTTP_METHODS },
      path: API_PATH,
      status: { kind: "int", min: 0, max: 599 },
      code: { kind: "string", pattern: /^[A-Z0-9_]{2,64}$/, max: 64 },
    },
  },
  client_error: {
    category: "error",
    label: "Erro na tela",
    client: true,
    meta: { errorType: { kind: "string", pattern: /^[A-Za-z0-9_$.]{1,60}$/, max: 60 } },
  },
} as const satisfies Record<string, ActivityTypeDefinition>;

export type TenantActivityType = keyof typeof TENANT_ACTIVITY_CATALOG;

export const TENANT_ACTIVITY_TYPES = Object.keys(TENANT_ACTIVITY_CATALOG) as TenantActivityType[];

export function isTenantActivityType(value: unknown): value is TenantActivityType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TENANT_ACTIVITY_CATALOG, value);
}

export function getActivityDefinition(type: TenantActivityType): ActivityTypeDefinition {
  return TENANT_ACTIVITY_CATALOG[type];
}

export function activityTypesOfCategory(category: ActivityCategory): TenantActivityType[] {
  return TENANT_ACTIVITY_TYPES.filter((type) => TENANT_ACTIVITY_CATALOG[type].category === category);
}
