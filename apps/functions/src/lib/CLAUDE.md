# functions/src/lib/ — Documentacao dos Helpers

Esta pasta contem os utilitarios de negocio compartilhados por todos os controllers. Os mais criticos sao documentados abaixo.

---

## auth-context.ts

Responsavel por extrair e validar o contexto de autenticacao de uma requisicao HTTP. E a camada de autenticacao mais baixo nivel — o middleware de auth chama esta funcao.

### Fontes de token (em ordem de prioridade)

1. `Authorization: Bearer <token>` — ID token do Firebase
2. Cookie `__session` — session cookie do Firebase (usado pelo Next.js middleware)
3. Cookie `firebase-auth-token` — legado (habilitado por `AUTH_ACCEPT_LEGACY_COOKIE_HINT`, default: `true` em dev, `false` em prod)

### Interface `AuthContext`

```typescript
interface AuthContext {
  uid: string;
  email?: string;
  email_verified?: boolean;
  role: string;              // normalizado para UPPERCASE
  tenantId: string;          // normalizado, string vazia se SUPERADMIN sem tenant
  masterId?: string;
  stripeId?: string;
  isSuperAdmin: boolean;     // role === "SUPERADMIN"
  hasRequiredClaims: boolean;
  userDocTenantId?: string;  // tenantId do doc Firestore (para deteccao de stale claims)
  userDoc?: Record<string, unknown> | null; // snapshot do doc users/{uid} lido pelo middleware nesta request (null = doc nao existe)
  tokenSource: "bearer" | "session_cookie" | "legacy_cookie";
}
```

> **Hot path:** o middleware ja le `users/{uid}` uma vez por request e publica o snapshot em `req.user.userDoc`. `resolveUserAndTenant` reutiliza esse snapshot em vez de reler o doc — nao adicionar novas leituras de `users/{uid}` em controllers; consumir `req.user.userDoc`.

### `resolveAuthContextFromRequest(req, options?)`

Funcao principal. Fluxo:
1. Extrai token da requisicao
2. Verifica via Firebase Admin (`auth.verifyIdToken` ou `auth.verifySessionCookie`, ambos com `checkRevoked=true`)
3. Decide freshness via `shouldFetchFreshClaims` (pura, testavel): busca `userRecord.customClaims` via `getUser()` **apenas quando** o token tem claims incompletas (role/tenant ausentes), role `FREE` (upgrade pago deve refletir imediato) ou `SUPERADMIN` (seguranca). Roles pagas estaveis confiam nas claims do proprio token (pior caso: downgrade demora <=1h ate o refresh — coberto pelo grace period de billing). Env `AUTH_CLAIMS_FRESHNESS=always` restaura o comportamento legado (getUser em toda request)
4. Busca doc `users/{uid}` no Firestore para obter `userDocTenantId` (e publica o snapshot em `userDoc`)
5. Faz fallback: se `role` ausente nas claims, usa `userData.role`; se `tenantId` ausente, usa `userDocTenantId`
6. Detecta `tenantMismatch` (claim vs. doc divergem) → lanca `FORBIDDEN_TENANT_MISMATCH`
7. Se `requireStrictClaims: true` e claims incompletas → lanca erro de claims

### `evaluateAuthContextInvariants(input)` (pura, testavel)

Funcao pura que avalia o conjunto de invariantes de autenticacao:
- `isSuperAdmin`: `role === "SUPERADMIN"`
- `hasRequiredClaims`: `role` presente E (`isSuperAdmin` OU `tenantId` presente)
- `tenantMismatch`: `tenantId` do claim difere do `tenantId` do doc Firestore
- `missingClaimsErrorCode`: so preenchido se `requireStrictClaims: true` e claims incompletas

### `assertPrivilegedContext(context)` (guard)

Lancas erros se `uid`, `role` ou `tenantId` (para nao-superadmin) estiverem ausentes. Usado por rotas que precisam garantir contexto completo.

### `isTenantAdminRole(role)` (predicate)

Retorna `true` para: `"SUPERADMIN"`, `"MASTER"`, `"ADMIN"`, `"WK"`.

### Variaveis de ambiente relevantes

| Variavel | Default | Descricao |
|----------|---------|----------|
| `AUTH_ACCEPT_LEGACY_COOKIE_HINT` | `"true"` em dev, `"false"` em prod | Aceita cookie `firebase-auth-token` legado |
| `AUTH_STRICT_CLAIMS_ONLY` | nao definida | Se `"true"`, rejeita tokens sem claims completas (sem fallback para Firestore) |
| `AUTH_CLAIMS_FRESHNESS` | `"auto"` | `auto`: getUser() so para claims incompletas/FREE/SUPERADMIN. `always`: getUser() em toda request (legado) |

---

## auth-helpers.ts

Utilitarios de alto nivel para verificar autorizacao dentro dos controllers. Diferente de `auth-context.ts` (que e chamado pelo middleware), este arquivo e chamado diretamente pelos controllers.

### Interface `UserDoc`

```typescript
interface UserDoc {
  role: string;
  name?: string;
  masterId?: string | null;
  masterID?: string | null;   // legado
  ownerId?: string | null;    // legado
  tenantId?: string;
  companyId?: string;         // legado, sinonimo de tenantId
  planId?: string;
  companyName?: string;
  subscription?: {
    limits: {
      maxProducts: number;
      maxClients?: number;
      maxUsers?: number;
      maxProposals?: number;
    };
    status: string;
  };
  usage?: {
    products: number;
    clients?: number;
    users?: number;
    proposals?: number;
  };
}
```

### `resolveUserAndTenant(userId, claims?)` → `PermissionCheckResult`

Funcao central usada por quase todos os controllers CRUD. Retorna:

```typescript
interface PermissionCheckResult {
  userRef: DocumentReference;
  userData: UserDoc;
  masterRef: DocumentReference;  // ref do doc do "dono" do tenant
  masterData: UserDoc;           // dados do dono (para verificar limites)
  tenantId: string;
  isMaster: boolean;             // role: MASTER | ADMIN | WK
  isSuperAdmin: boolean;         // role: SUPERADMIN
}
```

**Logica de resolucao:**
1. Valida que `claims.uid === userId` (previne spoofing)
2. Normaliza `role` para UPPERCASE, valida presenca
3. Se `claims.userDoc` presente (snapshot do middleware): usa direto, **sem nova leitura** de `users/{uid}`; `userDoc === null` → "User not found". Se ausente (`undefined`): fallback le o doc no Firestore como antes
4. Para membros (nao-master, nao-superadmin): busca `masterId` das claims → doc do master → valida que o master pertence ao mesmo tenant
5. Para masters/superadmin: `masterRef = userRef`, `masterData = userData`
6. Detecta `FORBIDDEN_TENANT_MISMATCH` entre claims e doc Firestore

**Roles considerados `isMaster`:** `MASTER`, `ADMIN`, `WK`

**Uso tipico nos controllers:**
```typescript
const { masterData, masterRef, tenantId, isMaster, isSuperAdmin } =
  await resolveUserAndTenant(userId, req.user);
```

### `checkPermission(userId, permissionDoc, requiredField)` → `boolean`

Verifica uma permissao granular para um membro:

```typescript
// Exemplo:
const canCreate = await checkPermission(userId, "products", "canCreate");
```

Busca `users/{userId}/permissions/{permissionDoc}` e retorna `data[requiredField] === true`. Retorna `false` se o doc nao existir.

**Docs de permissao conhecidos** — a lista canonica vive no frontend, em
`apps/web/src/lib/permissions/pages.ts` (`PERMISSION_PAGES`), que e a MESMA
consumida pelas duas telas da area de Equipe: `dashboard`, `kanban`,
`proposals`, `clients` (+ `customers` legado), `products`, `services`,
`spreadsheets`, `calendar`, `solutions`, `transactions`, `wallet`, `invoices`.

**Nunca inventar uma chave aqui.** `checkFinancialPermission` lia um doc
`financial` cravado no codigo que nenhum caminho de escrita jamais criou — a
tela sempre gravou `transactions` e `wallet`. Como membro sem doc e negado, o
modulo financeiro inteiro ficou fechado para membros, sem erro aparente alem de
"Sem permissao financeira.". Guard: `__tests__/finance-permission.test.ts`.

### `hasPagePermission(claims, pageId, action)` → `boolean`

Mesmo gate, com o bypass de administrador do tenant ja aplicado e sem reler
`users/{uid}`: resolve o role pelas claims. Os controllers antigos (products,
services, clients, proposals) seguem com o bloco
`if (!isMaster && !isSuperAdmin) checkPermission(...)` porque ja tem o contexto
resolvido em maos; os padronizados depois (kanban, auxiliares, calendario)
usam este. Guard: `__tests__/has-page-permission.test.ts`.

### `loadPagePermissions(claims)` / `resolvePagePermission(...)`

Le a subcolecao inteira numa consulta, para quem avalia VARIAS paginas na
mesma request — a Lia, que monta a lista de 29 ferramentas por turno. Com
`checkPermission` seriam ~29 leituras.

### `normalizePagePermission(perms)`

Sem `canView`, as outras tres acoes sao zeradas. A cascata existia so no
cliente e a API aceitava `canCreate: true` com `canView: false` — estado que
nenhuma tela produz. Guard: `__tests__/permission-cascade.test.ts`.

---

## billing-helpers.ts

Verificacao de limites de plano de forma **legada** (via `UserDoc`). Usado pelos controllers de clients, products e proposals que ainda nao migraram para `tenant-plan-policy.ts`.

> **Nota arquitetural:** Existe uma duplicidade proposital: `billing-helpers.ts` le limites do `UserDoc` (abordagem antiga), enquanto `tenant-plan-policy.ts` le do doc `tenants/{id}` (abordagem nova). Novos features devem usar `tenant-plan-policy.ts`.

### Limites legados por tier

Os VALORES saem de `shared/plan-capabilities.ts`; so a fonte de leitura
(`UserDoc` em vez do doc do tenant) e que continua legada.

```typescript
// Clientes
LEGACY_LIMITS = { free: 10, starter: 120, pro: -1, enterprise: -1 }

// Usuarios (membros da equipe)
LEGACY_USER_LIMITS = { free: 1, starter: 1, pro: 2, enterprise: -1 }

// Propostas
LEGACY_PROPOSAL_LIMITS = { free: 5, starter: 80, pro: -1, enterprise: -1 }
```

`-1` significa ilimitado.

### `checkClientLimit(masterData)` → `void | throws`

Determina `maxClients` na seguinte ordem de prioridade:
1. `LEGACY_LIMITS[planId]` — tiers conhecidos (free/starter/pro/enterprise)
2. `masterData.subscription.limits.maxClients` — limite customizado no doc
3. Fetch do doc `plans/{planId}` → `features.maxClients`
4. Default: `10` (free)

Lanca `Error(mensagem)` se `currentClients >= maxClients` (para limite >= 0). O caller deve capturar e retornar HTTP 402.

### `checkUserLimit(masterData, masterId)` → `void | throws`

Mesma logica, mas para `maxUsers`. Fallback adicional: se `usage.users === 0`, faz query de contagem real em `users.where("masterId", "==", masterId)` para evitar falso positivo em dados antigos.

### `checkProposalLimit(masterData)` → `void | throws`

Mesma logica para `maxProposals`.

---

## tenant-plan-policy.ts

Sistema moderno de enforecamento de limites de plano. Usado pelo `admin.controller` (criacao de membros) e destinado a novos features. Mais robusto que `billing-helpers.ts`: le do doc `tenants/{id}`, suporta cache, telemetria e modo monitor.

### Tiers e limites

`PLAN_LIMITS_BY_TIER` **deriva** de `shared/plan-capabilities.ts` — nao digite
numero de plano aqui. Ate 2026-09-03 esta era uma de CINCO tabelas
independentes descrevendo os mesmos planos (`LEGACY_*_LIMITS` em
billing-helpers, `planMetadata` no stripe.controller, `TIER_DEFAULT_FEATURES`
no admin.controller e `DEFAULT_PLANS` no front), e elas ja discordavam:
`free.maxProposals` valia 5 aqui e 15 no admin.controller, entao o painel de
billing do superadmin exibia um numero diferente do que bloqueava o tenant.

### Duas metades: limites e capacidades

```typescript
// "quantos ainda posso criar?" — enforceTenantPlanLimit
type PlanLimitFeature =
  | "maxProposalsPerMonth"
  | "maxWallets"
  | "maxUsers"
  | "storageQuotaMB"
  | "maxSpreadsheets"

// "este plano abre este modulo?" — requirePlanCapability
type PlanCapabilityKey =
  | "financial" | "crm" | "fiscal"
  | "pdfEditor" | "customTheme" | "whatsapp" | "calendarSync"
```

A segunda metade **nao existia**. `PlanLimitFeature` era fechado em 5 chaves
numericas, entao modulo novo nao tinha onde declarar seu tier minimo — e foi
assim que fiscal, calendario e Asaas nasceram sem gate nenhum, com
`hasFinancial`/`hasKanban` existindo apenas no `PlanProvider` do frontend.
Uma chamada HTTP direta contornava tudo.

### Cache em memoria

Duas camadas, ambas por instancia do Cloud Run:

1. **Doc tenant compartilhado** (`lib/tenant-doc-cache.ts`, TTL 5s, LRU 500): fonte unica de leitura de `tenants/{tenantId}` usada por `require-active-subscription` (middleware de billing) e por `resolveTenantPlanProfileUncached`. `invalidateBillingCache(tenantId)` (chamado pelos webhooks/controllers Stripe) delega para `invalidateTenantDoc`.
2. **Perfil derivado** (`PLAN_CACHE`, TTL 30s): cacheia o `TenantPlanProfile` ja derivado (tier + limites, incl. lookups de `plans/{planId}`). `clearTenantPlanCache(tenantId)` limpa as DUAS camadas (perfil + doc) — limpar so o perfil re-derivaria de um snapshot velho.

### Resolucao de tier a partir do doc `tenants/{id}`

Tenta na ordem:
1. `tenantData.plan` / `tenantData.planTier` / `tenantData.tier` → tier direto
2. `tenantData.planId` → doc `plans/{planId}` → campo `tier`
3. `tenantData.priceId` / `tenantData.stripePriceId` → mapping de Stripe price IDs → tier
4. Fallback: `buildCompatDefaultTenantPlanProfile` → tier `starter` (emite warning no log)

### `enforceTenantPlanLimit(input)` → `PlanEnforcementDecision`

Funcao principal de enforecamento. Retorna uma decisao estruturada.

```typescript
type PlanEnforcementInput = {
  tenantId: string;
  feature: PlanLimitFeature;
  currentUsage?: number;
  usageKnown?: boolean;
  incrementBy?: number;          // default: 1
  isSuperAdmin?: boolean;
  uid?: string;
  requestId?: string;
  route?: string;
  // Para maxProposalsPerMonth:
  periodStart?: string;
  periodEnd?: string;
  resetAt?: string;
}

type PlanEnforcementDecision = {
  allowed: boolean;
  mode: "off" | "monitor" | "enforce";
  profile: TenantPlanProfile;
  currentUsage: number;
  projectedUsage: number;
  limit: number;
  statusCode?: 402 | 403;
  code?: string;
  message?: string;
  bypassed?: boolean;   // true se superadmin ultrapassou o limite
  wouldBlock?: boolean; // true em modo monitor/off quando teria bloqueado
}
```

**Modo de enforecamento (`TENANT_PLAN_ENFORCEMENT_MODE`):**

| Modo | Comportamento quando limite ultrapassado |
|------|----------------------------------------|
| `enforce` (default) | `allowed: false`, HTTP 402 |
| `monitor` | `allowed: true`, mas `wouldBlock: true`, emite telemetria |
| `off` | `allowed: true`, sem telemetria |

**SuperAdmin bypass:**
Se `isSuperAdmin: true` E `TENANT_PLAN_SUPERADMIN_BYPASS !== "false"`, a decisao retorna `allowed: true` com `bypassed: true` mesmo quando o limite seria ultrapassado. Um evento de auditoria e gravado.

**Caso especial `maxProposalsPerMonth` com `usageKnown: false`:**
Se o uso mensal nao pode ser determinado (query falhou), retorna `allowed: true` com codigo `MONTHLY_USAGE_UNAVAILABLE` — fail-open para evitar bloqueio indevido.

**Verificacao de status de assinatura (`TENANT_PLAN_ENFORCE_SUBSCRIPTION_STATUS`):**
Se habilitado (default: `false`), tambem verifica se `subscriptionStatus` e `past_due` com grace period expirado. Grace period configuravel via `TENANT_PLAN_PAST_DUE_GRACE_DAYS` (default: 7 dias).

**Uso tipico:**
```typescript
const decision = await enforceTenantPlanLimit({
  tenantId,
  feature: "maxUsers",
  currentUsage: usersUsage,
  uid: loggedUserId,
  requestId: req.requestId,
  route: req.path,
  isSuperAdmin,
});
if (!decision.allowed) {
  return res.status(decision.statusCode || 402).json({
    message: decision.message,
    code: decision.code,
  });
}
```

### Funcoes de leitura de uso

| Funcao | Colecao consultada | Campo contado |
|--------|-------------------|---------------|
| `getTenantUsersUsage(tenantId)` | `users` | `role === "MEMBER"` |
| `getTenantWalletsUsage(tenantId)` | `wallets` | todos com `tenantId` |
| `getTenantSpreadsheetsUsage(tenantId)` | `spreadsheets` | todos com `tenantId` |
| `getTenantStorageUsageMb(tenantId)` | `tenants`, `companies` | campo `usage.storageMB` |
| `getTenantMonthlyProposalsUsage(tenantId, baseDate?)` | `tenant_usage/{id}/months/{YYYY-MM}` ou `proposals` | ver abaixo |

**`getTenantMonthlyProposalsUsage`:** Tenta primeiro ler do agregado pre-calculado em `tenant_usage/{tenantId}/months/{YYYY-MM}` (campo `proposalsCreated`). Se nao existir ou o valor for invalido, faz query de contagem direto em `proposals` com filtro de `createdAt` no periodo. Se ambos falharem, retorna `reliable: false`.

### Funcoes de periodo mensal

- `buildMonthlyPeriodWindowUtc(baseDate?)` → `{ startDate, endDate, periodStart, periodEnd, resetAt }` em UTC
- `buildMonthlyPeriodKeyUtc(baseDate?)` → string `"YYYY-MM"` para usar como ID de documento

### Telemetria

Toda decisao de bloqueio, bypass ou `would_block` emite:
- Log estruturado via `logSecurityEvent` (visivel no GCP Cloud Logging)
- Contador em `security_metrics` via `incrementSecurityCounter`
- Evento de auditoria em `security_audit_events` via `writeSecurityAuditEvent`

Funcoes de telemetria podem ser substituidas em testes via `setTenantPlanTelemetryForTest`.

### Variaveis de ambiente relevantes

| Variavel | Default | Descricao |
|----------|---------|----------|
| `TENANT_PLAN_ENFORCEMENT_MODE` | `"enforce"` | `"off"`, `"monitor"` ou `"enforce"` |
| `TENANT_PLAN_SUPERADMIN_BYPASS` | `"true"` | Superadmin ignora limites |
| `TENANT_PLAN_ENFORCE_SUBSCRIPTION_STATUS` | `"false"` | Bloquear tenants `past_due` |
| `TENANT_PLAN_PAST_DUE_GRACE_DAYS` | `"7"` | Dias de graca apos `past_due` |
| `TENANT_PLAN_CACHE_TTL_MS` | `"30000"` | TTL do cache de plano (5000-300000ms) |

---

## admin-helpers.ts

Utilitarios simples sem dependencias de Firebase.

### `generateRandomPassword(length = 16)` → `string`

Gera senha aleatoria com chars: `a-z`, `A-Z`, `0-9`, `!@#$%^&*`. Usado pelo `createMember` quando senha nao e fornecida pelo administrador.

### `isValidEmail(email)` → `boolean`

Validacao basica de formato de email via regex. **Prefira `validateEmailForSignup` de `contact-validation.ts`** para validacao completa (normaliza, rejeita dominios descartaveis).

### `canManageTeam(role?)` → `boolean`

Retorna `true` para roles: `MASTER`, `ADMIN`, `SUPERADMIN`, `WK`.

---

## Relacao entre os sistemas de billing

```
                    shared/plan-capabilities.ts
                      (PLAN_CATALOG — fonte unica)
                                 |
        +------------------------+------------------------+
        |                        |                        |
  limites numericos       capacidades              projecao publica
        |                        |               (buildPublicPlanFeatures)
tenant-plan-policy.ts   lib/tenant-capabilities.ts          |
  PLAN_LIMITS_BY_TIER     tier + add-ons ativos     GET /v1/stripe/plans
        |                        |                          |
enforceTenantPlanLimit   requirePlanCapability       PlanProvider (front)
  (402 PLAN_LIMIT_*)     (402 PLAN_CAPABILITY_       hasFinancial/hasKanban/
        |                     REQUIRED)              hasFiscal + landing/PlanCard
  billing-helpers.ts            |
  (LEGACY_*, via UserDoc)  ai/tools/index.ts
                           (ferramentas da Lia)
```

**Regras:**
- Limite numerico novo: `enforceTenantPlanLimit`.
- **Modulo novo: declare a capacidade em `PLAN_CATALOG` e monte
  `requirePlanCapability` na rota.** Sem isso ele nasce aberto para todo
  assinante, que foi o que aconteceu com fiscal, calendario e Asaas.
- Nunca digite valor de plano fora de `plan-capabilities.ts`. O guard
  `src/shared/__tests__/plan-capabilities.test.ts` (backend) e
  `apps/web/src/__tests__/plan-capabilities-parity.test.ts` (front) falham se
  alguma copia andar sozinha.

### requirePlanCapability (`api/middleware/require-plan-capability.ts`)

Montado por PREFIXO nas rotas, nunca `router.use(mw)` sem path: todos os
routers sao montados em `app.use("/v1", ...)`, entao um `use()` sem path
aplicaria o gate a API inteira.

| Rota | Capacidade |
|---|---|
| `/v1/transactions`, `/v1/wallets` | `financial` |
| `/v1/kanban-statuses` | `crm` |
| `/v1/fiscal/*` | `fiscal` |
| `/v1/asaas/*` | `financial` (segue o financeiro; payout vive sobre lancamentos) |
| `/v1/calendar/google/*` | `calendarSync` (a agenda interna fica em todos os planos) |

`TENANT_PLAN_CAPABILITY_MODE` (`off` | `monitor` | `enforce`, **default
`monitor`**) e proprio, separado de `TENANT_PLAN_ENFORCEMENT_MODE`: os limites
numericos ja rodam em `enforce` ha tempo, enquanto este gate foi ligado sobre
rotas que estavam abertas. Um interruptor comum obrigaria a escolher entre
afrouxar limites que funcionam e bloquear modulo sem medir antes quem depende
dele. Em `monitor` emite `plan_capability_would_block`.

Falha de resolucao **libera** a request (`plan_capability_resolution_failed`):
nao pode tirar de um cliente pagante um modulo que ele contratou.

### lib/tenant-capabilities.ts

`resolveTenantCapabilities(tenantId)` = capacidades do tier **+ add-ons
comprados**, com a mesma janela de graca de 7 dias em `past_due` que o front
aplica. Porta para o backend a regra que so existia em
`apps/web/src/services/addon-service.ts` — enquanto ela viveu so no front, um
Starter que PAGOU o add-on financeiro via a tela abrir e era recusado pela Lia,
que lia o tier e ignorava a compra. Cache LRU de 30s, invalidado junto com
`clearTenantPlanCache` via `registerPlanCacheClearListener`.
