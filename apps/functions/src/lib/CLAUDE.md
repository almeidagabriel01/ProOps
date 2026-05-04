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
  tokenSource: "bearer" | "session_cookie" | "legacy_cookie";
}
```

### `resolveAuthContextFromRequest(req, options?)`

Funcao principal. Fluxo:
1. Extrai token da requisicao
2. Verifica via Firebase Admin (`auth.verifyIdToken` ou `auth.verifySessionCookie`)
3. Busca `userRecord.customClaims` diretamente (sempre fresco, ignora claims do token para `role`/`tenantId`)
4. Busca doc `users/{uid}` no Firestore para obter `userDocTenantId`
5. Faz fallback: se `role` ausente nas claims, usa `userData.role`; se `tenantId` ausente, usa `userDocTenantId`
6. Detecta `tenantMismatch` (claim vs. doc divergem) → lanca `FORBIDDEN_TENANT_MISMATCH`
7. Se `requireStrictClaims: true` e claims incompletas → lanca erro de claims

> **Importante:** As claims sao lidas de `userRecord.customClaims` (getUser), nao do token JWT. Isso garante que mudancas de claims sao refletidas imediatamente sem esperar o token expirar.

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
3. Para membros (nao-master, nao-superadmin): busca `masterId` das claims → doc do master → valida que o master pertence ao mesmo tenant
4. Para masters/superadmin: `masterRef = userRef`, `masterData = userData`
5. Detecta `FORBIDDEN_TENANT_MISMATCH` entre claims e doc Firestore

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

**Docs de permissao conhecidos:** `products`, `services`, `clients` (novo), `customers` (legado), `proposals`, `transactions`, `kanban`, `calendar`, `notifications`

---

## billing-helpers.ts

Verificacao de limites de plano de forma **legada** (via `UserDoc`). Usado pelos controllers de clients, products e proposals que ainda nao migraram para `tenant-plan-policy.ts`.

> **Nota arquitetural:** Existe uma duplicidade proposital: `billing-helpers.ts` le limites do `UserDoc` (abordagem antiga), enquanto `tenant-plan-policy.ts` le do doc `tenants/{id}` (abordagem nova). Novos features devem usar `tenant-plan-policy.ts`.

### Limites legados por tier

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

```typescript
PLAN_LIMITS_BY_TIER = {
  free:       { maxProposalsPerMonth: 5,  maxWallets: 2,  maxUsers: 1,  storageQuotaMB: 100,  maxSpreadsheets: 5   },
  starter:    { maxProposalsPerMonth: 80, maxWallets: 5,  maxUsers: 1,  storageQuotaMB: 200,  maxSpreadsheets: 25  },
  pro:        { maxProposalsPerMonth: -1, maxWallets: 30, maxUsers: 2,  storageQuotaMB: 2560, maxSpreadsheets: 250 },
  enterprise: { maxProposalsPerMonth: -1, maxWallets: -1, maxUsers: -1, storageQuotaMB: -1,   maxSpreadsheets: -1  },
}
```

`-1` = ilimitado.

### Features gatadas

```typescript
type PlanLimitFeature =
  | "maxProposalsPerMonth"
  | "maxWallets"
  | "maxUsers"
  | "storageQuotaMB"
  | "maxSpreadsheets"
```

### Cache em memoria

O perfil de plano e cacheado em `PLAN_CACHE: Map<tenantId, CachedPlan>` por `TENANT_PLAN_CACHE_TTL_MS` (default: 30s, min: 5s, max: 300s). Cache invalida automaticamente por TTL. Nao persiste entre instances do Cloud Run.

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
Controllers antigos          Controllers novos
(clients, products,          (admin/createMember,
 proposals)                   wallets, spreadsheets)
       |                              |
billing-helpers.ts          tenant-plan-policy.ts
       |                              |
  UserDoc.subscription         tenants/{id}.plan
  UserDoc.usage                tenants/{id}.planId
       |                       tenants/{id}.priceId
  plans/{id}.features               |
                             PLAN_LIMITS_BY_TIER
                                     |
                              Cache em memoria
                              (30s TTL por instance)
```

**Regra:** ao criar novos features com verificacao de limite, usar `tenant-plan-policy.ts`.
