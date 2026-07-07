# Plano: Otimização & Escalabilidade sem Aumento de Custo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o backend/frontend do ProOps para 2 ordens de grandeza de crescimento de tráfego sem aumentar custo fixo: cortar leituras Firestore do hot path, isolar o risco de OOM do Chromium, tornar o rate limiting distribuível por env var, emagrecer o cold start e blindar o custo client-side de Firestore.

**Architecture:** Express monolith (Cloud Function V2 `api`, southamerica-east1) + nova função `pdf` isolada; Firestore multi-tenant; Next.js proxy `/api/backend/[...path]`. Nenhuma infra nova paga — Redis fica preparado mas desligado (ativação = env var).

**Tech Stack:** Node 22, Firebase Functions V2, Express 5, firebase-admin 13, Next.js 16, Jest (functions), Vitest (web), Playwright (e2e).

## Restrições Globais

- **Custo:** nenhuma infra de custo fixo novo. Custo variável pode crescer proporcionalmente a usuários, desde que marginal (ex.: leituras Firestore dentro do free tier atual de 50k/dia).
- **Sem retrabalho:** cada mudança deve ser o estado final da arquitetura, não paliativo (ex.: rate limiters migram para o store plugável — ativar Redis no futuro = 1 env var, zero código).
- **Commits:** 1 commit por task, conventional commits, uma linha, **sem `Co-Authored-By`**. Nunca `git push`. PRs só para `develop`.
- **Testes:** toda task com mudança de comportamento inclui teste no mesmo commit (Jest em `apps/functions/src/**/*.test.ts`, colocado ao lado do arquivo).
- **Build gate por task:** `cd apps/functions && npm run build && npm run lint` verde antes de cada commit. Tasks de frontend: `cd apps/web && npx tsc --noEmit && npm run lint`.
- **Docs:** cada task atualiza os `CLAUDE.md` que ela torna obsoletos, no mesmo commit (regra do repo).
- **Deploy:** ao final de cada fase, `npm run deploy:dev` e validação manual em dev antes de considerar a fase concluída. Deploy em prod é do usuário. Fases 1 e 2 tocam auth/billing ⇒ **risk tier alto**, revisão manual do usuário antes de prod.
- **Env vars novas:** documentar em `apps/functions/.env.example`.

### Decisões tomadas (não re-litigar durante execução)

| Decisão | Racional |
|---|---|
| Redis NÃO é ativado agora | 1–2 instâncias em prod; store memory correto na prática. Preparação (store plugável em todos os limiters) faz parte do plano; ativação futura = `RATE_LIMIT_STORE=redis` + URL/token. |
| `minInstances` NÃO é adicionado | Uptime check no `/api/health` (~7.2k req/dia) já mantém 1 instância quente 24/7 de graça. |
| Lazy-load do `stripe` NÃO entra | 31 call sites síncronos de `getStripe()`; converter para async = risco alto por ~100ms de cold start. Reavaliar só se cold start voltar a doer. |
| Monolito continua com 1GiB | `proxy-image` bufferiza até 5MiB/request com concurrency 80, e o fluxo WhatsApp→PDF ainda renderiza Chromium in-process (raro: só quando cache do bucket falha). Reduzir memória agora = risco de OOM. Gatilho de revisão documentado na Fase 5. |
| Fila (Cloud Tasks) NÃO entra | Únicos candidatos (PDF, e-mail) são resolvidos por função separada e paralelização. Fila sem volume = complexidade grátis. |
| SSE cap do AI chat continua in-memory | Concorrência de conexões é um recurso genuinamente por instância; store distribuído para contagem de conexões abertas é incorreto (leak em crash). Só o limite RPM migra para o store. |
| Trabalho pós-`res.json()` é PROIBIDO no Cloud Run | CPU é estrangulada após a resposta em billing por request. E-mails "fire-and-forget" seriam perdidos. Paralelizar com `Promise.allSettled` ANTES de responder. |

---

## FASE 1 — Hot path de autenticação e notificações

Estado atual por request autenticada: `verifyIdToken(checkRevoked)` + `getUser()` (2 round-trips Auth) + `users/{uid}` lido **2×** (middleware e controller) + `tenants/{tenantId}` (2 caches independentes). Meta: 1 round-trip Auth (comum), 1 leitura `users/{uid}`, 1 cache de tenant.

### Task 1: `AuthContext` carrega o user doc; `resolveUserAndTenant` reutiliza

**Files:**
- Modify: `apps/functions/src/lib/auth-context.ts` (interface `AuthContext` + `resolveAuthContextFromDecodedToken`)
- Modify: `apps/functions/src/lib/auth-helpers.ts` (`resolveUserAndTenant`)
- Test: `apps/functions/src/lib/auth-helpers.test.ts` (criar ou estender existente)
- Docs: `apps/functions/src/lib/CLAUDE.md` (seções auth-context e auth-helpers)

**Interfaces:**
- Produces: `AuthContext.userDoc?: Record<string, unknown> | null` — `null` = doc não existe; `undefined` = não carregado (caller montou claims manualmente). `resolveUserAndTenant(userId, claims)` passa a aceitar `claims.userDoc` com essa semântica.
- Consumes: nada de tasks anteriores.

- [ ] **Step 1: Teste que falha** — em `auth-helpers.test.ts`, mockar `../init` de modo que `db.collection("users").doc(uid).get()` lance se chamado:

```typescript
jest.mock("../init", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => {
          throw new Error("FIRESTORE_SHOULD_NOT_BE_CALLED");
        }),
      })),
    })),
  },
}));

import { resolveUserAndTenant } from "./auth-helpers";

describe("resolveUserAndTenant with preloaded userDoc", () => {
  it("does not re-read users/{uid} when claims.userDoc is provided (MASTER)", async () => {
    const result = await resolveUserAndTenant("uid-1", {
      uid: "uid-1",
      role: "MASTER",
      tenantId: "tenant-1",
      userDoc: { role: "MASTER", tenantId: "tenant-1" },
    });
    expect(result.tenantId).toBe("tenant-1");
    expect(result.isMaster).toBe(true);
    expect(result.userData.role).toBe("MASTER");
  });

  it("throws User not found when userDoc is null (doc inexistente)", async () => {
    await expect(
      resolveUserAndTenant("uid-1", {
        uid: "uid-1",
        role: "MASTER",
        tenantId: "tenant-1",
        userDoc: null,
      }),
    ).rejects.toThrow("User not found");
  });

  it("still detects FORBIDDEN_TENANT_MISMATCH from preloaded doc", async () => {
    await expect(
      resolveUserAndTenant("uid-1", {
        uid: "uid-1",
        role: "MASTER",
        tenantId: "tenant-1",
        userDoc: { role: "MASTER", tenantId: "tenant-OTHER" },
      }),
    ).rejects.toThrow("FORBIDDEN_TENANT_MISMATCH");
  });
});
```

Nota: o caso MEMBER (busca do master) continua indo ao Firestore — o mock acima lançaria; cobrir MEMBER num `describe` separado com mock que permite apenas o doc do master (guiar-se pelo padrão de mocks já usado nos testes existentes do repo; se não houver, usar `jest.fn()` por caminho como acima).

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/functions && npx jest src/lib/auth-helpers.test.ts`. Esperado: FAIL (userDoc é ignorado hoje e o mock lança `FIRESTORE_SHOULD_NOT_BE_CALLED`).

- [ ] **Step 3: Implementar em `auth-context.ts`** — na interface `AuthContext` (linha ~136), adicionar:

```typescript
  /**
   * Snapshot do doc users/{uid} lido pelo middleware de auth nesta mesma request.
   * null = doc não existe. undefined = não carregado (claims montadas manualmente).
   * Consumido por resolveUserAndTenant para evitar segunda leitura Firestore.
   */
  userDoc?: Record<string, unknown> | null;
```

Em `resolveAuthContextFromDecodedToken`, após `const userSnap = await db.collection("users")...` (linha ~285), o `userData` já existe. No objeto de retorno (linha ~336), adicionar:

```typescript
    userDoc: userSnap.exists ? ((userSnap.data() as Record<string, unknown>) ?? null) : null,
```

- [ ] **Step 4: Implementar em `auth-helpers.ts`** — no tipo do parâmetro `claims` de `resolveUserAndTenant`, adicionar `userDoc?: Record<string, unknown> | null;`. Substituir o bloco das linhas 78-81:

```typescript
  const userRef = db.collection("users").doc(userId);
  let userData: UserDoc;
  if (claims.userDoc !== undefined) {
    if (claims.userDoc === null) throw new Error("User not found");
    userData = claims.userDoc as UserDoc;
  } else {
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("User not found");
    userData = userSnap.data() as UserDoc;
  }
```

O restante da função (mismatch, master resolution) fica intacto — `userData` alimenta a mesma lógica.

**Casos de borda cobertos:** (a) callers que montam claims na mão (WhatsApp bot, testes) → `userDoc === undefined` → fallback lê Firestore como hoje; (b) doc deletado entre middleware e controller → snapshot da mesma request é usado (consistência intra-request é desejável); (c) `userSnap.data()` retornando `undefined` com `exists=true` → coalesce para `null` evita `userData` undefined.

- [ ] **Step 5: Rodar testes + build** — `npx jest src/lib/ && npm run build && npm run lint`. Esperado: PASS.
- [ ] **Step 6: Atualizar `lib/CLAUDE.md`** — documentar `userDoc` no `AuthContext` e o comportamento de reuso em `resolveUserAndTenant`.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "perf(auth): reuse middleware users/{uid} snapshot in resolveUserAndTenant"`

### Task 2: `getUnreadCount` via aggregation `count()` + `markAllAsRead` em lotes

**Files:**
- Modify: `apps/functions/src/api/services/notification.service.ts:166-200`
- Test: `apps/functions/src/api/services/notification.service.test.ts`
- Docs: `apps/functions/src/api/services/CLAUDE.md` (métodos `getUnreadCount`/`markAllAsRead`)

**Interfaces:**
- Produces: mesmas assinaturas públicas (`getUnreadCount(scope): Promise<number>`, `markAllAsRead(scope): Promise<void>`) — contrato externo inalterado.

- [ ] **Step 1: Teste que falha** — mockar a cadeia de query para expor `.count()`:

```typescript
describe("NotificationService.getUnreadCount", () => {
  it("uses count() aggregation instead of fetching documents", async () => {
    const countGet = jest.fn().mockResolvedValue({ data: () => ({ count: 7 }) });
    const query = {
      where: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({ get: countGet })),
      get: jest.fn(() => {
        throw new Error("FULL_FETCH_FORBIDDEN");
      }),
    };
    // injetar query via mock de db.collection().where() conforme padrão do arquivo
    // (buildScopeQuery retorna db.collection("notifications").where("tenantId","==",...))
    const count = await NotificationService.getUnreadCount(scope);
    expect(count).toBe(7);
    expect(query.count).toHaveBeenCalled();
  });
});
```

E para `markAllAsRead`: mock com 401 docs "não lidos" divididos em páginas — asserta que a query recebeu `.limit(400)` e que `batch.commit` foi chamado 2×.

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/api/services/notification.service.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar** — substituir `getUnreadCount` (linhas 166-177):

```typescript
  static async getUnreadCount(scope: NotificationScope): Promise<number> {
    try {
      const snapshot = await this.buildScopeQuery(scope)
        .where("isRead", "==", false)
        .count()
        .get();
      return snapshot.data().count;
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw new Error("Failed to get unread count");
    }
  }
```

Substituir `markAllAsRead` (linhas 179-200):

```typescript
  static async markAllAsRead(scope: NotificationScope): Promise<void> {
    try {
      const batchSize = 400;
      for (;;) {
        const snapshot = await this.buildScopeQuery(scope)
          .where("isRead", "==", false)
          .limit(batchSize)
          .get();
        if (snapshot.empty) break;

        const batch = db.batch();
        const readAt = new Date().toISOString();
        snapshot.docs.forEach((doc) => {
          batch.update(doc.ref, { isRead: true, readAt });
        });
        await batch.commit();

        if (snapshot.size < batchSize) break;
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
      throw new Error("Failed to mark all as read");
    }
  }
```

**Casos de borda:** (a) índice — a query `tenantId == X AND isRead == false` já tem índice composto `(isRead, tenantId, createdAt)` em `firebase/firestore.indexes.json:368` e `count()` usa índices existentes: nenhum índice novo; (b) emulador Firestore suporta `count()` (firebase-tools ≥ 12) — E2E não quebra; (c) custo: `count()` cobra 1 leitura por 1000 docs contados vs N leituras hoje; (d) loop do `markAllAsRead` termina porque cada iteração zera `isRead=false` dos docs processados; falha de `commit` lança e sai pelo catch.

- [ ] **Step 4: Rodar testes + build + lint.** Esperado: PASS.
- [ ] **Step 5: Atualizar `api/services/CLAUDE.md`.**
- [ ] **Step 6: Commit** — `git commit -m "perf(notifications): count() aggregation for unread-count and batched markAllAsRead"`

### Task 3: `getUser()` só quando necessário (claims frescas condicionais)

**Files:**
- Modify: `apps/functions/src/lib/auth-context.ts` (`resolveAuthContextFromDecodedToken` + novo helper puro)
- Test: `apps/functions/src/lib/auth-context.test.ts` (estender o existente, se houver; senão criar)
- Docs: `apps/functions/src/lib/CLAUDE.md`, `apps/functions/src/api/middleware/CLAUDE.md`, `apps/functions/.env.example`

**Interfaces:**
- Produces: helper puro exportado `shouldFetchFreshClaims(input: { tokenRole: string; tokenTenantId: string; mode: string }): boolean`. Env var nova: `AUTH_CLAIMS_FRESHNESS` = `"auto"` (default) | `"always"` (restaura comportamento atual).

**Contexto da decisão:** hoje `getUser()` roda em TODA request para ler claims frescas. Racional original: mudança de claim (ex.: upgrade free→paid via webhook Stripe) refletir sem esperar o token renovar (~1h). O plano preserva esse caso: claims frescas continuam sendo buscadas quando o token diz `role=FREE` (upgrade instantâneo), `SUPERADMIN` (segurança), ou claims incompletas. Para roles pagas estáveis (MASTER/ADMIN/MEMBER/WK com tenantId), o token é confiável — pior caso é um *downgrade* demorar ≤1h, o que já é coberto pelo grace period de billing (7 dias). O mismatch tenant claim×doc continua detectado pela leitura do `users/{uid}` (que permanece).

- [ ] **Step 1: Teste que falha** — testes do helper puro:

```typescript
import { shouldFetchFreshClaims } from "./auth-context";

describe("shouldFetchFreshClaims", () => {
  const base = { mode: "auto" };
  it("skips getUser for stable paid role with tenant", () => {
    expect(shouldFetchFreshClaims({ ...base, tokenRole: "MASTER", tokenTenantId: "t1" })).toBe(false);
    expect(shouldFetchFreshClaims({ ...base, tokenRole: "MEMBER", tokenTenantId: "t1" })).toBe(false);
  });
  it("fetches when role missing", () => {
    expect(shouldFetchFreshClaims({ ...base, tokenRole: "", tokenTenantId: "t1" })).toBe(true);
  });
  it("fetches when tenant missing for non-superadmin", () => {
    expect(shouldFetchFreshClaims({ ...base, tokenRole: "MASTER", tokenTenantId: "" })).toBe(true);
  });
  it("always fetches for FREE (upgrade must be instant)", () => {
    expect(shouldFetchFreshClaims({ ...base, tokenRole: "FREE", tokenTenantId: "t1" })).toBe(true);
  });
  it("always fetches for SUPERADMIN (security-sensitive)", () => {
    expect(shouldFetchFreshClaims({ ...base, tokenRole: "SUPERADMIN", tokenTenantId: "" })).toBe(true);
  });
  it("mode=always restores legacy behavior", () => {
    expect(shouldFetchFreshClaims({ mode: "always", tokenRole: "MASTER", tokenTenantId: "t1" })).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** Esperado: FAIL (`shouldFetchFreshClaims` não existe).
- [ ] **Step 3: Implementar** — em `auth-context.ts`, exportar o helper:

```typescript
export function shouldFetchFreshClaims(input: {
  tokenRole: string;
  tokenTenantId: string;
  mode: string;
}): boolean {
  if (input.mode === "always") return true;
  const role = normalizeRole(input.tokenRole);
  const tenantId = normalizeTenantId(input.tokenTenantId);
  if (!role) return true;                                // claims incompletas
  if (role === "SUPERADMIN") return true;                // segurança: sempre fresco
  if (role === "FREE") return true;                      // upgrade deve refletir imediato
  if (!tenantId) return true;                            // tenant ausente no token
  return false;                                          // role paga estável: token basta
}

function resolveClaimsFreshnessMode(): string {
  return String(process.env.AUTH_CLAIMS_FRESHNESS || "auto").trim().toLowerCase();
}
```

Em `resolveAuthContextFromDecodedToken`, substituir as linhas 266-283 por:

```typescript
  const tokenRole = normalizeRole(decodedIdToken.role);
  const tokenTenantId = normalizeTenantId(decodedIdToken.tenantId);

  let customClaims: {
    role?: unknown;
    tenantId?: unknown;
    masterId?: unknown;
    stripeId?: unknown;
  } = {};
  let userRecordEmail: string | undefined;

  if (
    shouldFetchFreshClaims({
      tokenRole,
      tokenTenantId,
      mode: resolveClaimsFreshnessMode(),
    })
  ) {
    const userRecord = await auth.getUser(decodedIdToken.uid);
    customClaims = (userRecord.customClaims || {}) as typeof customClaims;
    userRecordEmail = userRecord.email ?? undefined;
  }

  const role = normalizeRole(customClaims.role ?? decodedIdToken.role);
  const tenantId = normalizeTenantId(
    customClaims.tenantId ?? decodedIdToken.tenantId,
  );
  const masterId = normalizeOptionalString(
    customClaims.masterId ?? decodedIdToken.masterId,
  );
  const stripeId = normalizeOptionalString(
    customClaims.stripeId ?? decodedIdToken.stripeId,
  );
```

E na linha do `resolvedEmail` (~297), trocar `normalizeOptionalString(userRecord.email)` por `normalizeOptionalString(userRecordEmail)`.

**Casos de borda:** (a) custom claims **estão** embutidas no ID token JWT — `decodedIdToken.role`/`tenantId` é o mesmo dado que `userRecord.customClaims`, só potencialmente mais velho (≤1h); (b) mudança de role admin→member no meio da sessão: efetiva no refresh do token (≤1h) — aceito e documentado; rotas `/admin` já exigem `privilegedLimiter` + checks de role, e o caminho SUPERADMIN continua sempre fresco; (c) revogação de token continua imediata (`verifyIdToken(token, true)` intocado); (d) `FORBIDDEN_TENANT_MISMATCH` continua funcionando — a leitura do `users/{uid}` permanece; (e) rollback operacional sem deploy: `AUTH_CLAIMS_FRESHNESS=always`; (f) e-mail: para tokens sem `email` (não ocorre no fluxo atual, que é email/senha), `resolvedEmail` fica `undefined` — mesmo comportamento de hoje quando ambos ausentes.

- [ ] **Step 4: Rodar TODOS os testes de functions** (`npx jest`) — os testes existentes de auth (`auth-context`, rotas) devem continuar verdes. Se algum teste asserta chamada incondicional de `getUser`, atualizar o teste com justificativa no diff.
- [ ] **Step 5: Adicionar `AUTH_CLAIMS_FRESHNESS=auto` comentada em `.env.example`; atualizar `lib/CLAUDE.md` e `middleware/CLAUDE.md`** (fluxo de verificação).
- [ ] **Step 6: Build + lint + commit** — `git commit -m "perf(auth): fetch fresh custom claims only when token claims are incomplete, FREE or SUPERADMIN"`

### Task 4: Cache único do doc `tenants/{tenantId}`

**Files:**
- Create: `apps/functions/src/lib/tenant-doc-cache.ts`
- Modify: `apps/functions/src/api/middleware/require-active-subscription.ts` (remove LRU local)
- Modify: `apps/functions/src/lib/tenant-plan-policy.ts` (leitura do doc tenant passa pelo cache; `PLAN_CACHE` de perfil derivado 30s permanece)
- Test: `apps/functions/src/lib/tenant-doc-cache.test.ts`
- Docs: `apps/functions/src/lib/CLAUDE.md`, `apps/functions/src/api/middleware/CLAUDE.md`

**Interfaces:**
- Produces:

```typescript
export type TenantDocState = {
  exists: boolean;
  data: Record<string, unknown> | undefined;
};
export function getTenantDocCached(tenantId: string): Promise<TenantDocState>;
export function invalidateTenantDoc(tenantId: string): void;
```

- Consumes: nada. `invalidateBillingCache(tenantId)` (exportado por require-active-subscription, chamado por `stripe.controller.ts` ×3 e `stripeWebhook.ts` ×4) **mantém o nome** e passa a delegar para `invalidateTenantDoc` — zero mudança nos callers.

- [ ] **Step 1: Teste que falha** — `tenant-doc-cache.test.ts`: mock de `../init` com contador de `get()`; duas chamadas seguidas a `getTenantDocCached("t1")` fazem 1 fetch; após `invalidateTenantDoc("t1")`, novo fetch; TTL: com `jest.useFakeTimers()` avançar 6s e verificar refetch.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `tenant-doc-cache.ts`:**

```typescript
import { LRUCache } from "lru-cache";
import { db } from "../init";

export type TenantDocState = {
  exists: boolean;
  data: Record<string, unknown> | undefined;
};

const MAX_TENANTS = 500;
const TTL_MS = 5_000; // curto: revogação de acesso por billing deve refletir rápido

const cache = new LRUCache<string, TenantDocState>({ max: MAX_TENANTS, ttl: TTL_MS });

export async function getTenantDocCached(tenantId: string): Promise<TenantDocState> {
  const hit = cache.get(tenantId);
  if (hit) return hit;
  const snap = await db.collection("tenants").doc(tenantId).get();
  const state: TenantDocState = {
    exists: snap.exists,
    data: snap.data() as Record<string, unknown> | undefined,
  };
  cache.set(tenantId, state);
  return state;
}

export function invalidateTenantDoc(tenantId: string): void {
  cache.delete(tenantId);
}
```

- [ ] **Step 4: Migrar `require-active-subscription.ts`** — remover `billingStateCache`/`CachedBillingState`/import de `lru-cache`; o bloco de leitura (linhas 110-138) vira:

```typescript
  let subscriptionStatus = "";
  let pastDueSince: string | null = null;
  try {
    const tenantState = await getTenantDocCached(tenantId);
    if (!tenantState.exists) {
      next();
      return;
    }
    subscriptionStatus = String(tenantState.data?.subscriptionStatus || "").trim().toLowerCase();
    pastDueSince = normalizePastDueSince(tenantState.data?.pastDueSince);
  } catch (err) {
    logger.warn("require_active_subscription: firestore_read_error", {
      tenantId,
      uid: user.uid,
      error: err instanceof Error ? err.message : String(err),
    });
    next();
    return;
  }
```

`invalidateBillingCache` vira delegação (mantém export):

```typescript
export function invalidateBillingCache(tenantId: string): void {
  invalidateTenantDoc(tenantId);
}
```

- [ ] **Step 5: Migrar `tenant-plan-policy.ts`** — localizar a leitura direta `db.collection("tenants").doc(tenantId).get()` (~linha 416) e substituir por `getTenantDocCached(tenantId)` adaptando o acesso a `.exists`/`.data`. O `PLAN_CACHE` (perfil derivado, 30s) permanece como está — ele evita re-derivação (incl. lookups de `plans/{planId}`), enquanto o novo cache evita re-leitura do doc.

**Casos de borda:** (a) invalidação por webhook Stripe agora limpa a fonte única — o `PLAN_CACHE` derivado ainda pode servir tier velho por ≤30s, o que já é o comportamento atual (inalterado); (b) cache negativo (tenant inexistente) por 5s — aceitável, tenant não "passa a existir" em request seguinte de forma que importe; (c) por instância, como hoje — TTL 5s limita a janela de inconsistência entre instâncias.

- [ ] **Step 6: Rodar `npx jest` inteiro + build + lint.** Testes existentes de billing/middleware devem passar.
- [ ] **Step 7: Atualizar docs; commit** — `git commit -m "refactor(billing): single shared 5s tenant-doc cache backing subscription and plan checks"`

**Gate da Fase 1:** `npm run deploy:dev` → smoke manual em dev (login, listar notificações, criar proposta, badge de não-lidas) → checar logs por `AUTH_COMPAT`/erros novos.

---

## FASE 2 — Estabilidade sob pico (PDF, rate limiting plugável, e-mails)

### Task 5: Extrair `createRateLimiter` para módulo reutilizável (sem mudança de comportamento)

**Files:**
- Create: `apps/functions/src/lib/rate-limit/express-limiter.ts`
- Modify: `apps/functions/src/api/index.ts` (linhas 67-189: remover definição local, importar do novo módulo; as ~13 instâncias `createRateLimiter(...)` não mudam)
- Test: `apps/functions/src/lib/rate-limit/express-limiter.test.ts`

**Interfaces:**
- Produces:

```typescript
export function getClientIp(req: express.Request): string;
export function buildRateLimitIdentity(req: express.Request): string; // "ip:uid:tenant"
export function createRateLimiter(options: {
  maxRequests: number;
  windowMs?: number;              // default 60_000
  keyPrefix: string;
  keyResolver?: (req: express.Request) => string;
  onLimit?: (req: express.Request, res: express.Response, decision: RateLimitDecision) => void;
  // default onLimit: Retry-After + 429 {message:"Too many requests"} + eventos de segurança (comportamento atual)
  emulatorBypass?: boolean;       // default true (resolveEffectiveRateLimitMax)
}): express.RequestHandler;
```

- [ ] **Step 1:** Mover o corpo de `createRateLimiter`, `getClientIp`, `buildRateLimitIdentity` e `sanitizeLoggedPath` de `api/index.ts:72-189` para o novo módulo, byte-a-byte, acrescentando apenas os parâmetros `onLimit`/`emulatorBypass` (default = comportamento atual: mesmo JSON 429, mesmos eventos `ratelimit_triggered`, mesmo fail-open com `ratelimit_store_error_allowing_request`). O módulo chama `createRateLimitStore()` internamente (singleton do factory).
- [ ] **Step 2:** `api/index.ts` importa `{ createRateLimiter, getClientIp }` do novo módulo. Nenhuma instância muda de parâmetros. Se `getClientIp`/`sanitizeLoggedPath` forem usados em outros pontos do `api/index.ts`, importar de lá também (verificar com grep antes de apagar).
- [ ] **Step 3: Teste** — usar store memory real: limiter `maxRequests: 2` permite 2 e nega a 3ª com `Retry-After`; `onLimit` custom é chamado com a decision; store que lança ⇒ fail-open (`next()` chamado).
- [ ] **Step 4:** `npx jest && npm run build && npm run lint`. **Commit** — `git commit -m "refactor(rate-limit): extract reusable express limiter with pluggable store"`

### Task 6: Migrar limiters hardcoded (PDF, AI RPM, field-gen) para o store plugável

**Files:**
- Rewrite: `apps/functions/src/api/middleware/pdf-rate-limiter.ts`
- Rewrite: `apps/functions/src/ai/field-gen-rate-limiter.ts`
- Modify: `apps/functions/src/ai/rate-limiter.ts` (só a parte RPM; SSE cap fica)
- Test: estender `express-limiter.test.ts` + testes existentes dos limiters (se houver)
- Docs: `apps/functions/src/api/middleware/CLAUDE.md` (seção pdf-rate-limiter), `.claude/rules/backend.md` NÃO muda (regra "never skip rate limiting" continua satisfeita)

**Interfaces:**
- Consumes: `createRateLimiter` da Task 5.
- Produces: mesmos exports (`pdfRateLimiter`, `fieldGenRateLimiter`, `aiRateLimiter`) — rotas não mudam.

- [ ] **Step 1: `pdf-rate-limiter.ts`** — reescrever preservando contrato externo (429 + `PDF_RATE_LIMIT_EXCEEDED` + `retryAfter`):

```typescript
import { Request, Response } from "express";
import { createRateLimiter } from "../../lib/rate-limit/express-limiter";
import type { RateLimitDecision } from "../../lib/rate-limit/types";

function deriveKey(req: Request): string {
  const uid = req.user?.uid;
  if (uid) return `uid:${uid}`;
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";
  return `ip:${rawIp}`;
}

function onPdfLimit(_req: Request, res: Response, decision: RateLimitDecision): void {
  res.setHeader("Retry-After", String(decision.retryAfterSeconds));
  res.status(429).json({
    code: "PDF_RATE_LIMIT_EXCEEDED",
    message: "Muitas requisições de PDF. Aguarde alguns instantes e tente novamente.",
    retryAfter: decision.retryAfterSeconds,
  });
}

export const pdfRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
  keyPrefix: "pdf",
  keyResolver: deriveKey,
  onLimit: onPdfLimit,
  emulatorBypass: false, // PDF nunca teve bypass em emulador; E2E depende do 429
});
```

- [ ] **Step 2: `field-gen-rate-limiter.ts`** — mesma técnica: `maxRequests: 30, windowMs: 60*60_000, keyPrefix: "ai-fieldgen", keyResolver: (req)=>String(req.user?.uid||"anon")`, `onLimit` com body `AI_RATE_LIMIT_EXCEEDED` + `retryAfterSeconds` (formato atual do arquivo). Preservar o comportamento "sem uid → next()" com um wrapper: se `!req.user?.uid || !req.user?.tenantId` → `next()` direto (rota devolve 401 depois).
- [ ] **Step 3: `ai/rate-limiter.ts`** — separar: RPM (20/min por uid) vira `createRateLimiter({maxRequests:20, windowMs:60_000, keyPrefix:"ai-chat", keyResolver: uid, onLimit: body AI_RATE_LIMIT_EXCEEDED})`; o bloco SSE (contagem de conexões por tenant, linhas 66-94) permanece in-memory intacto com comentário explicando por quê. Compor os dois num único `aiRateLimiter` para não mudar `chat.route.ts`.
- [ ] **Step 4: Nota semântica no diff:** janela muda de deslizante (timestamps) para janela fixa (INCR/contador). Com limites/minuto isso é equivalente na prática; documentar no CLAUDE.md.
- [ ] **Step 5: Testes:** PDF: 5 passam / 6ª = 429 com `code: PDF_RATE_LIMIT_EXCEEDED`; field-gen sem uid → passa; AI: 21ª = 429. Rodar `npx jest`, build, lint.
- [ ] **Step 6: Commit** — `git commit -m "refactor(rate-limit): pdf/ai/field-gen limiters on pluggable store (redis-ready via env)"`

**Resultado estratégico:** a partir daqui, **todos** os limiters HTTP do monolito respeitam `RATE_LIMIT_STORE=redis` + `UPSTASH_REDIS_REST_URL/TOKEN`. Ativação futura = env vars + redeploy, zero código.

### Task 7: Função Cloud separada para PDF (`pdf`) + roteamento no proxy

**Files:**
- Create: `apps/functions/src/pdfApp.ts`
- Modify: `apps/functions/src/index.ts` (export `pdf`)
- Modify: `apps/functions/src/deploymentConfig.ts` (novo `PDF_OPTIONS`)
- Modify: `apps/web/src/lib/server-api-upstream.ts` (upstreams do `pdf`)
- Modify: `apps/web/src/app/api/backend/[...path]/route.ts` (rotear paths de PDF para a função `pdf`)
- Test: `apps/functions/src/pdfApp.test.ts` (montagem de rotas) + `apps/web/src/lib/__tests__/server-api-upstream.test.ts` (se existir padrão, senão criar em `apps/web/src/lib/`)
- Docs: `apps/functions/src/CLAUDE.md` (tabela de funções + config), `apps/functions/src/api/services/CLAUDE.md` (arquitetura PDF), `apps/functions/CLAUDE.md`

**Interfaces:**
- Produces: função HTTP `pdf` com as 4 rotas de PDF (`GET /v1/share/:token/pdf`, `GET /v1/share/transaction/:token/pdf`, `GET /v1/proposals/:id/pdf`, `GET /v1/transactions/:id/pdf`), mesma semântica de auth do monolito. Config isolada: `concurrency: 2` ⇒ no máximo 2 Chromium por instância de 1GiB (OOM eliminado por construção).
- As rotas de PDF do monolito **permanecem montadas** (mesmos arquivos de rota, custo zero) como fallback durante a transição e para o fluxo WhatsApp interno.

- [ ] **Step 1: `deploymentConfig.ts`** — adicionar:

```typescript
/**
 * PDF rendering function. Isolated from the API monolith so headless Chromium
 * memory spikes cannot OOM request-serving instances. concurrency 2 caps
 * simultaneous Chromium processes per 1GiB instance.
 */
export const PDF_OPTIONS: HttpsOptions = {
  cors: true,
  region: "southamerica-east1",
  timeoutSeconds: 90,
  cpu: 1,
  maxInstances: IS_DEV ? 1 : 5,
  concurrency: 2,
  memory: "1GiB",
};
```

- [ ] **Step 2: `pdfApp.ts`** — Express mínimo reaproveitando middlewares existentes:

```typescript
import express from "express";
import cors from "cors";
import { validateFirebaseIdToken } from "./api/middleware/auth";
import { pdfRateLimiter } from "./api/middleware/pdf-rate-limiter";
import { downloadSharedProposalPdf } from "./api/controllers/shared-proposal-pdf.controller";
import { downloadSharedTransactionPdf } from "./api/controllers/shared-transaction-pdf.controller";
import { downloadProposalPdf } from "./api/controllers/proposal-pdf.controller";
import { downloadTransactionPdf } from "./api/controllers/transaction-pdf.controller";

export const pdfApp = express();
pdfApp.use(cors({ origin: true })); // proxy Next.js é o único caller esperado; CORS liberal é aceitável em GET de binário autenticado
pdfApp.use(express.json({ limit: "1mb" }));

// Públicas (token do share link É a auth) — mesmas do monolito
pdfApp.get("/v1/share/:token/pdf", pdfRateLimiter, downloadSharedProposalPdf);
pdfApp.get("/v1/share/transaction/:token/pdf", pdfRateLimiter, downloadSharedTransactionPdf);

// Autenticadas
pdfApp.use(validateFirebaseIdToken);
pdfApp.get("/v1/proposals/:id/pdf", pdfRateLimiter, downloadProposalPdf);
pdfApp.get("/v1/transactions/:id/pdf", pdfRateLimiter, downloadTransactionPdf);
```

> Nomes exatos dos handlers: confirmar nos arquivos `api/routes/{core,finance,shared-proposals,shared-transactions}.routes.ts` (linhas 53, 42, 18, 10) e importar os mesmos símbolos. Se a política de CORS do monolito (`resolveAllowedCorsOrigins`) for exigida pelos testes de segurança, replicar o delegate do `api/index.ts` em vez de `origin: true`.

- [ ] **Step 3: `src/index.ts`** — exportar:

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { PDF_OPTIONS } from "./deploymentConfig";
import { pdfApp } from "./pdfApp";
export const pdf = onRequest(PDF_OPTIONS, pdfApp);
```

(Seguir o padrão de export usado por `api` em `./api/index.ts` — se `api` exporta o `onRequest` de dentro do módulo, fazer igual num `pdf.ts` dedicado.)

- [ ] **Step 4: `server-api-upstream.ts`** — derivar upstream do PDF a partir do da API:

```typescript
export function derivePdfUpstream(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/api$/, "/pdf");
}
```

E acrescentar as 4 variantes (`local`, `local-test`, `dev`, `prod`) de `/pdf` ao `ALLOWED_UPSTREAMS`.

- [ ] **Step 5: `route.ts` do proxy** — já existe `const isPdfRequest = path[path.length - 1] === "pdf"` (linha 98). Em `buildUpstreamUrl`, quando `isPdfRequest`, usar `derivePdfUpstream(baseUrl)`. Passar `isPdfRequest` para a função (mudar assinatura para receber o flag ou calcular lá dentro com o mesmo predicado).
- [ ] **Step 6: Casos de borda:**
  - Fluxo WhatsApp (`whatsapp.pdf.ts`) continua chamando `getOrGenerateProposalPdfBuffer` **in-process no monolito** — decisão registrada: é raro (só cache miss do bucket), o lock Firestore serializa, e o monolito mantém 1GiB. NÃO alterar.
  - Lock de geração é Firestore-transacional ⇒ funciona entre monolito e função `pdf` sem mudança.
  - Cache é o Storage bucket ⇒ compartilhado entre as duas funções.
  - Emulador: a função `pdf` aparece em `http://127.0.0.1:5001/<proj>/southamerica-east1/pdf` — o `derivePdfUpstream` cobre porque o base local também termina em `/api`.
  - `path[path.length-1]==="pdf"` casa exatamente as 4 rotas; nenhuma outra rota do backend termina em `/pdf` (verificar com `grep -rn "/pdf" apps/functions/src/api/routes/` — já mapeado: 4 ocorrências).
  - Primeira request pós-deploy paga cold start da função nova (~segundos) — aceitável para PDF (operação já é lenta); uptime check NÃO cobre a função `pdf` (scale-to-zero = custo idle zero; trade-off aceito).
- [ ] **Step 7: Testes** — `pdfApp.test.ts` com supertest (se disponível no repo; senão, testar a tabela de rotas do app Express): rotas públicas respondem sem Bearer (mock dos controllers), autenticadas devolvem 401 sem token. Teste do `derivePdfUpstream` (4 casos). Rodar `npx jest`, builds e lints de functions **e** web (`cd apps/web && npx tsc --noEmit && npm run lint`).
- [ ] **Step 8: Validação em dev** — `npm run deploy:dev`; baixar 1 PDF de proposta autenticado e 1 compartilhado apontando o front de dev para o proxy; conferir no console que a função `pdf` atendeu (logs) e o monolito não abriu Chromium.
- [ ] **Step 9: Commit** — `git commit -m "feat(pdf): dedicated cloud function for pdf rendering, isolating chromium from the api monolith"`

### Task 8: Demo-booking — e-mails em paralelo + timeout no Zoom

**Files:**
- Modify: `apps/functions/src/api/controllers/demo-booking.controller.ts:231-252`
- Modify: `apps/functions/src/services/zoom/create-meeting.ts` (timeout nos 2 fetches)
- Test: `apps/functions/src/api/controllers/demo-booking.controller.test.ts` (estender se existir; senão criar para o trecho de e-mails) e/ou `apps/functions/src/services/zoom/create-meeting.test.ts`

- [ ] **Step 1: Controller** — substituir os dois `await sendEmail(...)` sequenciais (linhas 231-252) por:

```typescript
  const internal = renderDemoBookingInternalEmail(emailData);
  const confirm = renderDemoBookingConfirmationEmail(emailData);
  const results = await Promise.allSettled([
    sendEmail({
      to: "gestao@proops.com.br",
      subject: internal.subject,
      html: internal.html,
      replyTo: data.email,
      type: "demo_booking_internal",
    }),
    sendEmail({
      to: data.email,
      subject: confirm.subject,
      html: confirm.html,
      type: "demo_booking_confirmation",
    }),
  ]);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      logger.error("demo-booking sendEmail failed", {
        which: i === 0 ? "internal" : "confirmation",
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
```

(Não responder antes do `allSettled` — CPU pós-resposta é estrangulada no Cloud Run.)

- [ ] **Step 2: Zoom** — em `create-meeting.ts`, adicionar `signal: AbortSignal.timeout(5_000)` aos dois `fetch` (token OAuth e create). No catch existente (que já devolve `null` → fallback Jitsi), incluir o caso de abort. Ler o arquivo antes; preservar o contrato `Promise<string | null>`.
- [ ] **Step 3: Testes** — mock de `sendEmail`: 1º rejeita, 2º resolve ⇒ resposta continua 200 e ambos foram disparados (chamados antes de qualquer `await` um do outro). Zoom: fetch que nunca resolve + fake timers ⇒ retorna `null` em ~5s.
- [ ] **Step 4: Build + lint + commit** — `git commit -m "perf(demo-booking): parallel emails and 5s zoom timeout"`

**Gate da Fase 2:** deploy dev + smoke: agendar demo em dev (e-mails chegam), PDF autenticado + compartilhado ok, chat Lia responde, limite de PDF devolve 429 na 6ª tentativa.

---

## FASE 3 — Cold start e dívida de dependências

### Task 9: `@google/generative-ai` vira type-only (SchemaType local)

**Files:**
- Create: `apps/functions/src/ai/tools/schema-types.ts`
- Modify: `apps/functions/src/ai/tools/definitions.ts:1` (troca import de valor)
- Modify: `apps/functions/package.json` (mover `@google/generative-ai` para devDependencies)
- Test: `apps/functions/src/ai/tools/schema-types.test.ts`

**Interfaces:**
- Produces: `schema-types.ts`:

```typescript
/**
 * Runtime-local replica of @google/generative-ai's SchemaType enum.
 * Values are identical (lowercase JSON-schema type names); typed as the SDK
 * enum via a type-only reference so downstream FunctionDeclaration typings
 * keep working, but the SDK module is never loaded at runtime (cold-start win).
 */
export const SchemaType = {
  STRING: "string",
  NUMBER: "number",
  INTEGER: "integer",
  BOOLEAN: "boolean",
  ARRAY: "array",
  OBJECT: "object",
} as unknown as typeof import("@google/generative-ai").SchemaType;
```

- [ ] **Step 1: Teste que falha** — asserta igualdade runtime com o pacote real (roda em dev onde o pacote existe) e que `definitions.ts` não carrega o SDK:

```typescript
import { SchemaType as LocalSchemaType } from "./schema-types";

describe("local SchemaType replica", () => {
  it("matches the SDK enum values", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SchemaType: SdkSchemaType } = require("@google/generative-ai");
    expect({ ...LocalSchemaType }).toEqual({ ...SdkSchemaType });
  });

  it("definitions module does not require the SDK at runtime", () => {
    jest.resetModules();
    require("./definitions");
    const loaded = Object.keys(require.cache).some((p) =>
      p.includes("@google/generative-ai"),
    );
    expect(loaded).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** (segundo teste falha: definitions importa o SDK como valor).
- [ ] **Step 3: Implementar** — criar `schema-types.ts`; em `definitions.ts:1`: `import { SchemaType } from "./schema-types";` + `import type { FunctionDeclaration } from "@google/generative-ai";`. Verificar com `grep -rn "from \"@google/generative-ai\"" apps/functions/src` que TODOS os demais imports são `import type` (relatório de auditoria: chat.route.ts:2 `FunctionDeclarationsTool` é type-annotation → converter para `import type`; gemini/groq providers idem se houver).
- [ ] **Step 4:** mover `"@google/generative-ai": "^0.24.1"` de `dependencies` para `devDependencies` em `apps/functions/package.json` + `npm install`.
- [ ] **Step 5:** `npx jest src/ai/ && npm run build && npm run lint`. Smoke: `npm run dev:backend` e uma chamada ao chat Lia no emulador.
- [ ] **Step 6: Commit** — `git commit -m "perf(ai): drop @google/generative-ai from runtime (type-only), local SchemaType replica"`

### Task 10: Lazy-load dos providers AI (`@google/genai`, `groq-sdk`)

**Files:**
- Modify: `apps/functions/src/ai/chat.route.ts:15` (import dinâmico de `createAiProvider`/`createGroqFallbackProvider`)
- Modify: `apps/functions/src/ai/field-gen.route.ts:2` (import dinâmico de `@google/genai`)
- Test: `apps/functions/src/ai/ai-lazy-load.test.ts` (padrão de `calendar.controller.lazy-load.test.ts`)

- [ ] **Step 1: Teste que falha:**

```typescript
describe("AI SDK lazy loading", () => {
  it("mounting AI routes does not load @google/genai or groq-sdk", () => {
    jest.resetModules();
    require("./chat.route");
    require("./field-gen.route");
    const loaded = Object.keys(require.cache);
    expect(loaded.some((p) => p.includes("@google/genai"))).toBe(false);
    expect(loaded.some((p) => p.includes("groq-sdk"))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: `chat.route.ts`** — trocar linha 15 por `import type { ToolFeedback } from "./providers/index";` e, dentro do handler (antes do primeiro uso, uma vez por request):

```typescript
const { createAiProvider, createGroqFallbackProvider } = await import("./providers/index");
```

(O `import()` é cacheado pelo Node após a primeira chamada — custo só na primeira request de AI da instância.) Verificar demais imports de `providers/` no arquivo e converter os de tipo para `import type`.

- [ ] **Step 4: `field-gen.route.ts`** — mesmo padrão para `@google/genai` (mover a construção do client para dentro do handler com `await import("@google/genai")`, memoizado em variável de módulo `let genaiModulePromise` como no calendar controller).
- [ ] **Step 5: Verificar cadeia com o teste; conferir que `ai/index.ts`, `tools/index.ts`, `model-router.ts`, `usage-tracker.ts` não importam SDKs por valor** (`grep -rn "@google/genai\|groq-sdk" apps/functions/src/ai --include="*.ts" | grep -v "import type" | grep -v test`).
- [ ] **Step 6:** `npx jest src/ai/` + build + lint + smoke no emulador (chat + gerar campo). **Commit** — `git commit -m "perf(ai): lazy-load gemini and groq sdks off the cold-start path"`

### Task 11: `googleapis` → `@googleapis/calendar`

**Files:**
- Modify: `apps/functions/src/api/controllers/calendar.controller.ts` (import dinâmico muda de módulo)
- Modify: `apps/functions/package.json` (remove `googleapis`, adiciona `@googleapis/calendar`)
- Test: atualizar `apps/functions/src/api/controllers/calendar.controller.lazy-load.test.ts` (nome do módulo)

- [ ] **Step 1:** Ler `calendar.controller.ts` inteiro e mapear usos do objeto `google` (ex.: `google.auth.OAuth2`, `google.calendar({version:"v3", auth})`).
- [ ] **Step 2:** `npm uninstall googleapis && npm install @googleapis/calendar` (em `apps/functions`).
- [ ] **Step 3:** Trocar o import dinâmico memoizado:

```typescript
// antes: const { google } = await import("googleapis");
const calendarApi = await import("@googleapis/calendar");
// OAuth2: new calendarApi.auth.OAuth2(clientId, clientSecret, redirectUri)
// client:  calendarApi.calendar({ version: "v3", auth: oauth2Client })
```

O pacote scoped exporta `calendar()` e `auth` (google-auth-library) com a MESMA superfície usada; tipos `calendar_v3` disponíveis via `import type { calendar_v3 } from "@googleapis/calendar"`. Ajustar cada uso mapeado no Step 1.

- [ ] **Step 4:** Atualizar o teste de lazy-load para assertar que nem `@googleapis/calendar` nem `google-auth-library` entram no require.cache ao montar rotas.
- [ ] **Step 5:** Build + lint + smoke do fluxo de calendar no emulador (conectar Google Calendar exige OAuth real — validar em dev deploy: listar eventos de uma conta conectada). **Commit** — `git commit -m "perf(deps): replace googleapis metapackage with @googleapis/calendar"`

### Task 12: Remover `@mercadopago/sdk-react` (morto)

**Files:**
- Modify: `apps/functions/package.json`

- [ ] **Step 1:** Confirmar zero imports: `grep -rn "mercadopago/sdk-react" apps/functions/src` → vazio (já verificado em 2026-07-06).
- [ ] **Step 2:** `cd apps/functions && npm uninstall @mercadopago/sdk-react`
- [ ] **Step 3:** `npm run build && npm run lint && npx jest`. **Commit** — `git commit -m "chore(deps): remove unused @mercadopago/sdk-react from functions"`

**Gate da Fase 3:** deploy dev; medir cold start no log (`Function execution took...` da primeira request) antes/depois e registrar no PR.

---

## FASE 4 — Custo Firestore client-side (onde a escala realmente dói)

As listas (transações, propostas, clientes...) leem Firestore direto do browser. Com N usuários, este é o primeiro SKU a estourar o free tier — nada do backend acima toca isso.

### Task 13: Auditoria sistemática das queries client-side

**Files:**
- Create: `docs/plans/2026-07-06-firestore-client-audit.md` (achados)
- Modify: hooks apontados pela auditoria (`apps/web/src/hooks/**`)
- Test: Vitest nos hooks alterados (`apps/web/src/**/__tests__/*.test.ts`)

- [ ] **Step 1: Enumerar** — rodar e tabular resultados:

```bash
# listeners em tempo real (cada mudança re-cobra leitura em cada aba aberta)
grep -rn "onSnapshot" apps/web/src --include="*.ts*" | grep -v test
# queries sem limit na mesma expressão/arquivo
grep -rn "getDocs\|collection(" apps/web/src/hooks --include="*.ts*" | grep -v test
grep -rLn "limit(" $(grep -rl "getDocs" apps/web/src/hooks --include="*.ts*")
# polling de backend
grep -rn "setInterval\|refetchInterval\|unread-count" apps/web/src --include="*.ts*" | grep -v test
```

- [ ] **Step 2: Classificar cada achado** pela matriz:

| Padrão encontrado | Ação |
|---|---|
| `getDocs` de coleção inteira sem `limit()` | Adicionar `limit(N)` + paginação `startAfter` (template abaixo) |
| `onSnapshot` em lista grande onde tempo-real não é requisito de produto | Trocar por `getDocs` + refetch manual/on-focus |
| `onSnapshot` legítimo (ex.: status de proposta aberta) | Manter, mas escopar com `where` + `limit` |
| Re-mount refazendo query (dep array instável) | Estabilizar deps/memoizar query |
| Polling com `setInterval` sem pausa em aba oculta | Adicionar guarda `document.visibilityState` (template na Task 14) |

Template de paginação (padrão do repo — hooks consomem services):

```typescript
const PAGE_SIZE = 50;
const baseQuery = query(
  collection(db, "transactions"),
  where("tenantId", "==", tenantId),
  orderBy("dueDate", "desc"),
  limit(PAGE_SIZE),
);
const nextPage = (cursor: QueryDocumentSnapshot) =>
  query(baseQuery, startAfter(cursor));
```

- [ ] **Step 3: Aplicar correções** — um commit por hook/domínio corrigido, com teste Vitest do comportamento paginado (mock do Firestore client como nos testes existentes de hooks). **Escopo mínimo obrigatório:** hooks de transações, propostas e clientes (as 3 listas principais); demais achados registrados no doc de auditoria com prioridade.
- [ ] **Step 4:** `npm run test:web && cd apps/web && npx tsc --noEmit && npm run lint`. Commits: `perf(web): paginate <domínio> firestore reads`

### Task 14: Polling de notificações economiza quando a aba está oculta

**Files:**
- Modify: hook de notificações (localizar com `grep -rn "unread-count" apps/web/src --include="*.ts*"`)
- Test: Vitest do hook

- [ ] **Step 1:** Ler o hook; identificar o intervalo de polling do `GET /v1/notifications/unread-count`.
- [ ] **Step 2:** Envolver o tick com guarda de visibilidade (padrão):

```typescript
useEffect(() => {
  const tick = () => {
    if (document.visibilityState !== "visible") return; // aba oculta: não polla
    void refreshUnreadCount();
  };
  const id = setInterval(tick, POLL_INTERVAL_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") void refreshUnreadCount();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}, [refreshUnreadCount]);
```

- [ ] **Step 3:** Teste: com `document.visibilityState` mockado como `hidden`, timer dispara e fetch NÃO é chamado; ao voltar a `visible`, refetch imediato.
- [ ] **Step 4:** test:web + tsc + lint. **Commit** — `git commit -m "perf(web): pause notification polling on hidden tabs"`

**Gate da Fase 4:** comparar leituras Firestore/dia no Cloud Monitoring uma semana após deploy (baseline registrado em 2026-07-06: 45–4.400/dia).

---

## FASE 5 — Guard rails e runbook de escala

### Task 15: Documento de gatilhos + runbook Redis + design do sharded counter

**Files:**
- Create: `docs/scalability-runbook.md`
- Modify: `apps/functions/.env.example` (bloco Redis comentado)
- Modify: `apps/functions/src/api/services/CLAUDE.md` (nota sobre hotspot de carteira)

- [ ] **Step 1: `docs/scalability-runbook.md`** com o conteúdo:
  - **Gatilhos de revisão** (medidos no Cloud Monitoring, projeto `erp-softcode-prod`):
    | Métrica | Limiar | Ação |
    |---|---|---|
    | `run.googleapis.com/container/instance_count` (api, pico sustentado) | ≥ 3 por 7 dias | Ativar Redis: `RATE_LIMIT_STORE=redis` + `UPSTASH_REDIS_REST_URL/TOKEN` (free tier 500k cmds/mês) + redeploy |
    | `firestore.googleapis.com/document/read_count` | > 40k/dia | Reauditar Fase 4; revisar novos hooks |
    | Latência p95 do `api` | > 2s sustentado | Perfilar hot path; revisar `AUTH_CLAIMS_FRESHNESS` |
    | Memória p99 do `api` | > 80% | NÃO reduzir; investigar proxy-image/WhatsApp-PDF |
    | Memória p99 do `api` | < 40% por 30 dias E fluxo WhatsApp-PDF migrado | Candidato a reduzir monolito para 512MiB |
    | Erros `SLOT_TAKEN`/contention em `wallets` | reclamações ou p95 de criação de transação > 3s | Implementar sharded counter (design abaixo) |
  - **Runbook Redis** (passo a passo: criar DB Upstash região `sa-east-1`, envs, deploy dev, validar header `Retry-After` consistente entre instâncias, deploy prod).
  - **Design futuro — sharded wallet balance** (NÃO implementar agora): `wallets/{id}/shards/{0..N}` com `FieldValue.increment`, saldo = soma dos shards via `getAll`, N=5 inicial; migração: script de backfill + flag por tenant. Registrado para nunca ser "descoberto" às pressas.
  - **Baseline 2026-07-06** (para comparação futura): instâncias pico 1–2; ~7,2k req/dia no `api` (dominado por uptime check); leituras Firestore 45–4.4k/dia.
- [ ] **Step 2: `.env.example`** — adicionar bloco comentado:

```bash
# Rate limiting distribuído (ativar quando instâncias sustentadas >= 3; ver docs/scalability-runbook.md)
# RATE_LIMIT_STORE=redis
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
# Freshness de claims no middleware de auth: auto (default) | always (legado, 1 getUser por request)
# AUTH_CLAIMS_FRESHNESS=auto
```

- [ ] **Step 3: Commit** — `git commit -m "docs: scalability runbook with triggers, redis activation and sharded-wallet design"`

### Task 16: Alerta de orçamento GCP (opcional, requer billing account)

- [ ] **Step 1:** `gcloud billing accounts list` → obter `ACCOUNT_ID`.
- [ ] **Step 2:**

```bash
gcloud billing budgets create \
  --billing-account=ACCOUNT_ID \
  --display-name="ProOps prod - alerta mensal" \
  --budget-amount=100BRL \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --filter-projects=projects/erp-softcode-prod
```

(E-mail de alerta vai para os billing admins por padrão.) Se a conta de billing não estiver acessível pela CLI do usuário logado, registrar no runbook como pendência manual via console.

---

## Ordem de execução e dependências

```
Fase 1: T1 → T3 (mesmo arquivo, sequencial) ; T2 e T4 independentes
Fase 2: T5 → T6 → T7 ; T8 independente
Fase 3: T9 → T10 (mesmos arquivos AI) ; T11, T12 independentes
Fase 4: T13 → T14
Fase 5: T15, T16 a qualquer momento após Fase 2
```

## Self-review (executado na escrita)

- Cobertura vs. objetivo declarado: hot path ✔ (T1-T4), OOM/PDF ✔ (T7), rate limit redis-ready ✔ (T5-T6), cold start ✔ (T9-T12), custo client-side ✔ (T13-T14), gatilhos ✔ (T15-T16), e-mails/Zoom ✔ (T8).
- Fora de escopo com racional registrado: lazy stripe (31 call sites), fila, minInstances, Redis ligado, redução de memória do monolito, sharded counter (design-only).
- Consistência de tipos entre tasks: `userDoc?: Record<string, unknown> | null` (T1) é o mesmo tipo consumido em auth-helpers; `RateLimitDecision` (T5/T6) vem de `lib/rate-limit/types.ts` existente; `derivePdfUpstream` (T7) definido e usado na mesma task.
