import { getCachedIdToken } from "@/lib/observability/identity-token-store";
import { readViewingTenantId } from "@/lib/viewing-tenant-session";
import { normalizeActivityRoute } from "./normalize-route";
import type { ClientActivityType } from "./catalog";

/**
 * Registro da atividade da empresa no navegador, para o painel do super admin
 * acompanhar telas abertas, ações principais e erros
 * (`apps/functions/src/lib/tenant-activity.ts`).
 *
 * Segue o desenho do `client-error-reporter`: junta os eventos e manda em
 * lote, no máximo um a cada 5 segundos, e despeja o que sobrou por
 * `sendBeacon` quando a aba some. A identidade vai como ID token no corpo
 * (o beacon não leva cabeçalho), e o servidor tira dele empresa e papel: este
 * módulo nunca manda `tenantId`.
 *
 * Não registra nada sem login, no "Acessar Painel" do super admin, nem do
 * próprio super admin. Também nunca lança: falha aqui não pode atrapalhar a
 * tela.
 */

const ENDPOINT = "/api/backend/v1/activity/events";
const FLUSH_DEBOUNCE_MS = 5000;
const MAX_BATCH = 25;
/** Teto por aba: tela em laço não vira milhares de documentos. */
export const MAX_EVENTS_PER_TAB = 500;
/** Uma troca de tela logo seguida de outra é redirecionamento, não visita. */
const REDIRECT_COLLAPSE_MS = 800;
/** O mesmo erro repetido conta uma vez por minuto. */
const ERROR_COALESCE_MS = 60_000;
const SESSION_KEY = "proopsActivitySession";
const COUNT_KEY = "proopsActivityCount";

export type ActivityMeta = Record<string, string | number | boolean | undefined>;

interface BufferedEvent {
  type: ClientActivityType;
  route: string | null;
  meta?: Record<string, string | number | boolean>;
  at: number;
}

let buffer: BufferedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersInstalled = false;
let viewerRole: string | null = null;
let lastPageRoute: string | null = null;
let lastPageAt = 0;
const recentErrors = new Map<string, number>();
let memoryCount = 0;
let memorySessionId: string | null = null;

/** Quem está usando a aba. Super admin não é registrado. */
export function setActivityViewer(viewer: { role?: string | null } | null): void {
  viewerRole = viewer?.role ? String(viewer.role).toLowerCase() : null;
}

function canTrack(): boolean {
  if (typeof window === "undefined") return false;
  if (viewerRole === "superadmin") return false;
  try {
    if (readViewingTenantId()) return false;
  } catch {
    // sem storage não há impersonação para conferir
  }
  return true;
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    memorySessionId ??= `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    return memorySessionId;
  }
}

/** Conta o evento contra o teto da aba; devolve false quando o teto já foi. */
function consumeTabQuota(): boolean {
  try {
    const used = Number(sessionStorage.getItem(COUNT_KEY) || "0");
    if (used >= MAX_EVENTS_PER_TAB) return false;
    sessionStorage.setItem(COUNT_KEY, String(used + 1));
    return true;
  } catch {
    if (memoryCount >= MAX_EVENTS_PER_TAB) return false;
    memoryCount += 1;
    return true;
  }
}

function cleanMeta(meta?: ActivityMeta): Record<string, string | number | boolean> | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function send(events: BufferedEvent[], useBeacon: boolean): void {
  const idToken = getCachedIdToken();
  if (!idToken || events.length === 0) return;
  try {
    const body = JSON.stringify({ idToken, sessionId: sessionId(), events });
    if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // best-effort
  }
}

function flush(useBeacon = false): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (buffer.length > 0) {
    send(buffer.splice(0, MAX_BATCH), useBeacon);
  }
}

function installListeners(): void {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}

function enqueue(event: BufferedEvent, options?: { flush?: boolean }): void {
  if (!consumeTabQuota()) return;
  installListeners();
  buffer.push(event);
  if (options?.flush) {
    // A página vai sair em seguida (ex.: checkout do Stripe): o beacon
    // sobrevive à navegação, o fetch com debounce não.
    flush(true);
    return;
  }
  if (buffer.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_DEBOUNCE_MS);
}

/**
 * Registra uma ação. `route` padrão é a tela atual. Erros iguais (mesmo tipo,
 * caminho e status) contam uma vez por minuto.
 */
export function trackActivity(
  type: ClientActivityType,
  options?: { route?: string | null; meta?: ActivityMeta; flush?: boolean },
): void {
  try {
    if (!canTrack()) return;
    const now = Date.now();
    const meta = cleanMeta(options?.meta);
    if (type === "api_error" || type === "client_error") {
      const key = `${type}|${JSON.stringify(meta ?? {})}`;
      const last = recentErrors.get(key);
      if (last !== undefined && now - last < ERROR_COALESCE_MS) return;
      recentErrors.set(key, now);
      if (recentErrors.size > 200) recentErrors.clear();
    }
    const rawRoute = options?.route !== undefined ? options.route : window.location.pathname;
    enqueue({ type, route: normalizeActivityRoute(rawRoute), meta, at: now }, { flush: options?.flush });
  } catch {
    // nunca lança
  }
}

/**
 * Troca de tela. A mesma rota seguida conta uma vez, e uma troca que vem logo
 * depois de outra (redirecionamento) substitui a anterior ainda não enviada.
 */
export function trackPageView(pathname: string): void {
  try {
    if (!canTrack()) return;
    const route = normalizeActivityRoute(pathname);
    if (!route || route === lastPageRoute) return;
    const now = Date.now();
    const last = buffer[buffer.length - 1];
    if (last && last.type === "page_view" && now - lastPageAt < REDIRECT_COLLAPSE_MS) {
      last.route = route;
      last.at = now;
    } else {
      enqueue({ type: "page_view", route, at: now });
    }
    lastPageRoute = route;
    lastPageAt = now;
  } catch {
    // nunca lança
  }
}

// test-only: zera o estado do módulo entre testes
export function __resetActivityTrackerForTest(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  buffer = [];
  viewerRole = null;
  lastPageRoute = null;
  lastPageAt = 0;
  recentErrors.clear();
  memoryCount = 0;
  memorySessionId = null;
}

// test-only: força o envio do que está no buffer
export function __flushActivityForTest(useBeacon = false): void {
  flush(useBeacon);
}
