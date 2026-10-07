/**
 * Espelho do catálogo da atividade das empresas
 * (`apps/functions/src/shared/tenant-activity-catalog.ts`): tipo, categoria e
 * rótulo, que é o que o navegador manda e o painel do super admin mostra.
 * O backend é a fonte; `src/__tests__/activity-catalog-parity.test.ts` falha
 * se as duas cópias divergirem. As regras de `meta` ficam só no servidor.
 */

export const ACTIVITY_CATEGORIES = ["navigation", "action", "funnel", "error"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  navigation: "Navegação",
  action: "Ações",
  funnel: "Jornada",
  error: "Erros",
};

export const TENANT_ACTIVITY_CATALOG = {
  page_view: { category: "navigation", label: "Abriu a tela", client: true },
  session_started: { category: "navigation", label: "Entrou no ERP", client: false },
  session_ended: { category: "navigation", label: "Saiu do ERP", client: false },
  demo_write_blocked: { category: "action", label: "Tentou alterar dados na demonstração", client: true },
  route_blocked: { category: "action", label: "Tela bloqueada", client: true },
  upgrade_prompt_shown: { category: "action", label: "Viu o aviso de plano", client: true },
  onboarding_step_completed: { category: "action", label: "Concluiu um passo do tutorial", client: true },
  onboarding_exited: { category: "action", label: "Saiu do tutorial", client: true },
  team_member_added: { category: "action", label: "Membro adicionado à equipe", client: false },
  signup: { category: "funnel", label: "Criou a conta", client: false },
  upgrade_prompt_clicked: { category: "funnel", label: "Clicou no aviso de plano", client: true },
  subscribe_clicked: { category: "funnel", label: "Clicou em Assinar", client: true },
  checkout_started: { category: "funnel", label: "Abriu o checkout", client: false },
  trial_started: { category: "funnel", label: "Começou o teste grátis", client: false },
  subscribed: { category: "funnel", label: "Assinou", client: false },
  plan_changed: { category: "funnel", label: "Trocou de plano", client: false },
  cancel_scheduled: { category: "funnel", label: "Agendou o cancelamento", client: false },
  subscription_canceled: { category: "funnel", label: "Assinatura encerrada", client: false },
  payment_failed: { category: "funnel", label: "Pagamento falhou", client: false },
  api_error: { category: "error", label: "Erro na API", client: true },
  client_error: { category: "error", label: "Erro na tela", client: true },
} as const satisfies Record<string, { category: ActivityCategory; label: string; client: boolean }>;

export type TenantActivityType = keyof typeof TENANT_ACTIVITY_CATALOG;

/** Tipos que o navegador manda; os demais o servidor grava sozinho. */
export type ClientActivityType = {
  [K in TenantActivityType]: (typeof TENANT_ACTIVITY_CATALOG)[K]["client"] extends true ? K : never;
}[TenantActivityType];

export const TENANT_ACTIVITY_TYPES = Object.keys(TENANT_ACTIVITY_CATALOG) as TenantActivityType[];

export const SUBSCRIBE_CLICK_SOURCES = [
  "landing_pricing",
  "plan_card",
  "demo_banner",
  "upgrade_modal",
  "upgrade_required",
  "subscription_blocked",
  "subscribe_page",
] as const;
export type SubscribeClickSource = (typeof SUBSCRIBE_CLICK_SOURCES)[number];

export const SUBSCRIBE_CLICK_SOURCE_LABELS: Record<SubscribeClickSource, string> = {
  landing_pricing: "página de planos",
  plan_card: "tela de planos do perfil",
  demo_banner: "faixa da demonstração",
  upgrade_modal: "aviso de plano",
  upgrade_required: "tela de recurso bloqueado",
  subscription_blocked: "tela de acesso suspenso",
  subscribe_page: "link de assinatura",
};

export const ROUTE_BLOCKED_REASONS = ["free_tier", "master_only", "permission"] as const;
export type RouteBlockedReason = (typeof ROUTE_BLOCKED_REASONS)[number];

export const ROUTE_BLOCKED_REASON_LABELS: Record<RouteBlockedReason, string> = {
  free_tier: "fora da demonstração",
  master_only: "só o dono da conta",
  permission: "sem permissão",
};

export function isTenantActivityType(value: unknown): value is TenantActivityType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TENANT_ACTIVITY_CATALOG, value);
}
