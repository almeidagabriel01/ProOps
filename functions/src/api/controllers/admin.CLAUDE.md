# admin.controller.ts — Documentacao

Controller responsavel por operacoes administrativas: gestao de membros da equipe, billing de tenants, credenciais, planos, criacao/exclusao de tenants, clonagem de dados e billing de WhatsApp. Quase toda operacao exige role `SUPERADMIN` ou `isTenantAdminClaim`.

## Arquivo fonte

`functions/src/api/controllers/admin.controller.ts` (~1750 linhas)

## Rotas (admin.routes.ts)

Prefixo montado em `/admin` pelo Express principal.

| Metodo | Path | Handler | Auth minima |
|--------|------|---------|-------------|
| `GET` | `/admin/tenants/billing` | `getAllTenantsBilling` | SUPERADMIN |
| `POST` | `/admin/members` | `createMember` | SUPERADMIN ou isTenantAdmin |
| `PUT` | `/admin/members/permissions` | `updatePermissions` | SUPERADMIN ou isTenantAdmin |
| `PUT` | `/admin/members/:id` | `updateMember` | SUPERADMIN ou isTenantAdmin |
| `DELETE` | `/admin/members/:id` | `deleteMember` | SUPERADMIN ou isTenantAdmin |
| `POST` | `/admin/credentials` | `updateCredentials` | SUPERADMIN |
| `PUT` | `/admin/users/:userId/plan` | `updateUserPlan` | SUPERADMIN |
| `PUT` | `/admin/users/:userId/subscription` | `updateUserSubscription` | SUPERADMIN |
| `POST` | `/admin/tenants` | `createTenant` | SUPERADMIN |
| `POST` | `/admin/tenants/copy-data` | `copyTenantData` | SUPERADMIN |
| `DELETE` | `/admin/tenants/:tenantId` | `deleteTenant` | SUPERADMIN |
| `POST` | `/admin/test-whatsapp-billing` | `testWhatsAppBilling` | SUPERADMIN |

> **Atencao de rota:** `PUT /admin/members/permissions` deve vir ANTES de `PUT /admin/members/:id` no arquivo de rotas para evitar que "permissions" seja interpretado como `:id`.

---

## Funcoes auxiliares exportadas

Essas funcoes sao reutilizadas por outros controllers (especialmente `users.controller.ts`).

### `normalizePhoneNumber(value)`

Delega para `normalizeBrazilPhoneNumber` de `lib/contact-validation`. Retorna string normalizada (E.164 sem `+`), ou string vazia se invalido.

### `upsertPhoneNumberIndexTx(transaction, params)`

Gerencia o indice global `phoneNumberIndex/{phoneNumber}` dentro de uma Firestore Transaction.

```typescript
params: {
  userId: string;
  tenantId: string;
  newPhoneNumber?: unknown;
  previousPhoneNumber?: unknown;
  now: FirebaseFirestore.Timestamp;
}
```

- Se `newPhoneNumber` ja esta indexado para outro `userId`, lanca `Error("PHONE_ALREADY_LINKED")` — o caller deve capturar e retornar HTTP 409.
- Se `previousPhoneNumber` difere do novo, remove a entrada antiga (somente se `userId` bate).
- **Ordem obrigatoria dentro da transacao:** todos os `transaction.get()` antes de qualquer `transaction.set/update/delete`.

---

## Endpoints detalhados

### `createMember` — POST /admin/members

Cria um usuario membro da equipe com role `MEMBER`.

**Validacoes:**
- `name` com >= 2 caracteres
- `email` validado via `validateEmailForSignup` (normaliza lowercase, rejeita dominios descartaveis)
- `phoneNumber` opcional — se presente, deve passar `validateBrazilMobilePhone`
- Requer `isSuperAdmin` ou `isTenantAdminClaim`

**Resolucao do masterId:**
- Se `isSuperAdmin` e `input.targetMasterId` presente → usa esse masterId
- Caso contrario → usa o uid do usuario logado

**Limite de plano:**
Usa `enforceTenantPlanLimit({ feature: "maxUsers" })` via `tenant-plan-policy.ts`. Retorna 402 se limite atingido (superadmin bypassa).

**Fluxo atomico:**
1. Cria usuario no Firebase Auth com senha (gerada aleatorialmente se nao fornecida)
2. Seta custom claims: `{ role: "MEMBER", masterId, tenantId, companyId }`
3. Roda `db.runTransaction`:
   - Atualiza indice de telefone (`upsertPhoneNumberIndexTx`)
   - Cria doc em `users/{memberId}`
   - Cria docs de permissoes em `users/{memberId}/permissions/{pageId}` para cada entrada de `input.permissions`
   - Incrementa `usage.users` no master e na company
4. Se a transacao falhar: faz rollback deletando o usuario do Firebase Auth

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "phoneNumber": "string (opcional)",
  "password": "string (opcional - gerado se ausente)",
  "permissions": { "pageId": { "canView": true, "canCreate": false, ... } },
  "targetMasterId": "string (opcional, apenas superadmin)"
}
```

**Respostas:**
- `201` `{ success: true, memberId, message }`
- `400` nome/email/telefone invalido
- `403` sem permissao
- `402` limite de plano atingido
- `409` email ja cadastrado ou telefone ja vinculado
- `412` tenantId nao encontrado no master

---

### `updateMember` — PUT /admin/members/:id

Atualiza nome, email, senha e telefone de um membro.

**Guards:**
- `isSuperAdmin` ou `isTenantAdminClaim`
- Se nao for superadmin: `memberData.masterId` deve bater com o uid logado

**Atualizacoes:**
- Firebase Auth: email, password (min 6 chars), displayName
- Firestore: nome, email, telefone (com atualizacao do phoneNumberIndex via transacao)
- Telefone validado antes de qualquer escrita

**Respostas:**
- `200` `{ success: true, message }`
- `403` permissao negada
- `404` membro nao encontrado
- `409` email ou telefone ja em uso

---

### `deleteMember` — DELETE /admin/members/:id

Remove membro da equipe.

**Guards:**
- `isSuperAdmin` ou (`isTenantAdminClaim` E `memberData.masterId === loggedUserId`)

**Fluxo atomico:**
1. Deleta usuario do Firebase Auth (tolerante a `auth/user-not-found`)
2. Roda `db.runTransaction`:
   - Deleta doc `users/{id}`
   - Remove entrada de `phoneNumberIndex` se pertencia ao usuario
   - Decrementa `usage.users` no master e na company

---

### `updatePermissions` — PUT /admin/members/permissions

Atualiza permissoes granulares de um membro.

**Dois modos de operacao:**

**Modo single** (`body.mode === "single"`): atualiza um unico campo de permissao (`body.key = value`) num documento especifico (`body.pageId`). Faz merge, preservando outros campos.

**Modo bulk** (default): recebe `body.permissions` como objeto `{ pageId: { canView, canCreate, canEdit, canDelete } }` e usa `db.batch()` para escrever todos.

**Guards:** `isSuperAdmin` ou (`isTenantAdminClaim` E `memberData.masterId === loggedUserId`)

**Body (bulk):**
```json
{
  "memberId": "string",
  "permissions": {
    "products": { "canView": true, "canCreate": true, "canEdit": false, "canDelete": false },
    "clients": { "canView": true, "canCreate": false, "canEdit": false, "canDelete": false }
  }
}
```

**Body (single):**
```json
{
  "memberId": "string",
  "mode": "single",
  "pageId": "products",
  "key": "canCreate",
  "value": true
}
```

---

### `getAllTenantsBilling` — GET /admin/tenants/billing

Lista todos os tenants com dados de billing para o painel de administracao.

**Guard:** somente `SUPERADMIN`.

**Estrategia de busca (otimizada):**
1. Busca todos os users com `role in ["MASTER", "admin", "ADMIN", "master", "free"]`
2. Coleta `tenantIds` e `planIds` unicos
3. Faz batch fetch de todos os docs `tenants/{id}` de uma vez com `db.getAll()`
4. Faz batch fetch de todos os docs `plans/{id}` de uma vez

**Normalizacao de plano:**
- Tiers conhecidos: `free`, `starter`, `pro`, `enterprise`
- Se `planId` for um document ID (nao um tier), resolve via `planTierMap` retornado do batch de plans
- Status derivado por `deriveTenantStatus()`: considera `cancelAtPeriodEnd`, `currentPeriodEnd`, `subscriptionStatus`

**Resposta:**
```json
[
  {
    "tenant": { "id", "name", "slug", "createdAt", "logoUrl", "primaryColor", "niche", "whatsappEnabled" },
    "admin": { "id", "name", "email", "phoneNumber", "subscriptionStatus", "currentPeriodEnd", "subscription" },
    "planName": "Pro",
    "planId": "pro",
    "subscriptionStatus": "active",
    "usage": { "users": 2, "proposals": 45, "clients": 30, "products": 12 }
  }
]
```

---

### `updateCredentials` — POST /admin/credentials

Altera email, senha ou telefone de qualquer usuario (somente SUPERADMIN).

**Body:**
```json
{
  "userId": "string",
  "email": "string (opcional)",
  "password": "string (opcional, min 6 chars)",
  "phoneNumber": "string (opcional)"
}
```

Atualiza Firebase Auth e Firestore. Se `phoneNumber` presente, roda transacao para atualizar `phoneNumberIndex`.

---

### `updateUserPlan` — PUT /admin/users/:userId/plan

Altera `planId` do usuario diretamente no Firestore (somente SUPERADMIN). Nao interage com Stripe.

**Body:** `{ "planId": "string" }`

---

### `updateUserSubscription` — PUT /admin/users/:userId/subscription

Altera campos de assinatura do usuario (somente SUPERADMIN).

**Campos permitidos:** `subscriptionStatus`, `currentPeriodEnd`, `isManualSubscription`

---

### `createTenant` — POST /admin/tenants

Cria uma nova empresa com usuario administrador. Somente SUPERADMIN.

**Validacoes:**
- `name` >= 2 chars, `adminName` >= 2 chars
- `adminEmail` validado por `validateEmailForSignup`
- `adminPassword` >= 6 chars
- Email nao pode existir no Firebase Auth

**Fluxo:**
1. Cria usuario no Firebase Auth com role `ADMIN`
2. Seta custom claims: `{ role: "ADMIN", tenantId }`
3. Roda `db.runTransaction`:
   - Cria `tenants/{tenantId}` com campos de configuracao
   - Cria `companies/{tenantId}` (doc de compatibilidade/legacy)
   - Cria `users/{adminUid}` com dados do admin
   - Indexa telefone em `phoneNumberIndex` se fornecido
4. Se qualquer etapa falhar: rollback deleta o usuario do Firebase Auth

**Body:**
```json
{
  "name": "string",
  "slug": "string (opcional)",
  "primaryColor": "#3b82f6",
  "logoUrl": "string",
  "niche": "string",
  "whatsappEnabled": false,
  "adminName": "string",
  "adminEmail": "string",
  "adminPassword": "string",
  "adminPhoneNumber": "string (opcional)",
  "planId": "free",
  "subscriptionStatus": "active",
  "currentPeriodEnd": "string ISO (opcional)"
}
```

**Resposta:** `201 { success, tenantId, adminUserId, message }`

---

### `deleteTenant` — DELETE /admin/tenants/:tenantId

Remove uma empresa e TODOS os seus dados. Operacao irreversivel. Somente SUPERADMIN.

**Sequencia de delecao:**
1. Busca todos os users com `tenantId` ou `companyId` igual ao tenantId
2. Para cada user:
   - Deleta subcollection `users/{uid}/permissions` em batches de 400
   - Remove entrada de `phoneNumberIndex`
   - Deleta do Firebase Auth (tolerante a `auth/user-not-found`)
   - Deleta doc `users/{uid}`
3. Deleta todas as colecoes tenant-scoped em batches:
   `products`, `services`, `proposals`, `custom_options`, `custom_fields`, `options`, `clients`, `transactions`, `wallets`, `wallet_transactions`, `notifications`, `addons`, `purchased_addons`, `spreadsheets`, `proposal_templates`, `sistemas`, `ambientes`
4. Deleta `companies/{tenantId}` e `tenants/{tenantId}`

> **Aviso:** Nao deleta arquivos do Firebase Storage. Use `cleanupStorageAndSharedLinks` para isso.

---

### `copyTenantData` — POST /admin/tenants/copy-data

Copia dados de catalogo (produtos, servicos, ambientes, sistemas) de um tenant para outro. Somente SUPERADMIN. Usado para onboarding de novos clientes com template de outro tenant.

**Body:** `{ "sourceTenantId": "string", "targetTenantId": "string" }`

**Colecoes copiadas:** `products`, `services`, `ambientes`, `sistemas`

**Fluxo:**
1. Limpa dados pre-existentes no `targetTenantId` (idempotente)
2. Copia `products`, `services`, `ambientes` em batches de 500
   - Mantem dicionario `oldId -> newId` para remapeamento
   - Clona imagens do Storage: copia de `tenants/{sourceTenantId}/{folder}/` para `tenants/{targetTenantId}/{folder}/{newEntityId}/`
3. Copia `sistemas` remapeando referencias internas:
   - `ambientes[].ambienteId` → novo ID via dicionario
   - `ambientes[].products[].productId` → novo ID via dicionario
   - `availableAmbienteIds[]` → novos IDs
   - `ambienteIds[]` (legacy) → novos IDs
   - `defaultProducts[].productId` → novos IDs

**Resposta:**
```json
{
  "success": true,
  "totalCopied": 42,
  "imageCloneStats": { "copied": 5, "reused": 3, "failed": 0 }
}
```

---

### `testWhatsAppBilling` — POST /admin/test-whatsapp-billing

Dispara manualmente o billing de overage de WhatsApp para um tenant especifico. Para debugging e testes. Somente SUPERADMIN.

**Body:** `{ "tenantId": "string", "month": "string" }`

Delega para `reportWhatsAppOverage(tenantId, month)` de `services/whatsappBilling`.

---

## Multi-tenancy

- Operacoes de membros: superadmin pode operar em qualquer tenant via `targetMasterId`
- Quando superadmin opera em tenant alheio, o controller busca o owner do tenant (user sem `masterId`) para atualizar `usage.*` corretamente
- `usage.users` e `usage.clients` e `usage.products` sao desnormalizados tanto no doc do master quanto no doc `companies/{tenantId}`

## Colecoes afetadas

| Colecao | Operacoes |
|---------|----------|
| `users` | create, update, delete |
| `users/{id}/permissions` | create, update, delete |
| `tenants` | create, delete |
| `companies` | create (espelho do tenant), delete |
| `phoneNumberIndex` | upsert, delete |
| `plans` | read (batch fetch para billing) |

## Dependencias importantes

- `lib/contact-validation` — `validateEmailForSignup`, `validateBrazilMobilePhone`, `normalizeBrazilPhoneNumber`
- `lib/tenant-plan-policy` — `enforceTenantPlanLimit`, `getTenantUsersUsage`
- `lib/request-auth` — `isSuperAdminClaim`, `isTenantAdminClaim`
- `services/whatsappBilling` — `reportWhatsAppOverage`
