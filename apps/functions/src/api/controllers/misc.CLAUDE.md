# CLAUDE.md — Controllers Diversos (Calendar, Kanban, Validation, Auxiliary, Spreadsheets)

Documentação dos controllers e rotas de funcionalidades auxiliares do backend.

## Índice

- [Calendar](#calendar)
- [Kanban](#kanban)
- [Validation](#validation)
- [Auxiliary](#auxiliary)
- [Spreadsheets](#spreadsheets)
- [Helpers de Rota](#helpers-de-rota)
- [Storage](#storage)
- [Contact Validation](#contact-validation)

---

## Calendar

### Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `controllers/calendar.controller.ts` | Lógica de calendário local + sync com Google Calendar |
| `routes/calendar.routes.ts` | Definição de rotas públicas e protegidas |

### Rotas

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/v1/calendar/google/callback` | Pública | Callback OAuth Google Calendar |
| `GET` | `/v1/calendar/google/auth-url` | Protegida | Gera URL de autorização OAuth |
| `GET` | `/v1/calendar/google/status` | Protegida | Retorna status da integração Google |
| `DELETE` | `/v1/calendar/google/status` | Protegida | Desconecta integração Google |
| `GET` | `/v1/calendar/events` | Protegida | Lista eventos do calendário |
| `POST` | `/v1/calendar/events` | Protegida | Cria evento |
| `PUT` | `/v1/calendar/events/:id` | Protegida | Atualiza evento |
| `DELETE` | `/v1/calendar/events/:id` | Protegida | Remove evento |

O callback OAuth (`/v1/calendar/google/callback`) é público pois o Google redireciona para ele sem um token Firebase — o estado (`state` param) é validado internamente.

### Coleções Firestore

| Coleção | Conteúdo |
|---------|----------|
| `calendar_events` | Eventos de calendário do tenant |
| `calendar_integrations` | Configuração OAuth do Google Calendar (1 doc por tenant, ID = tenantId) |
| `calendar_oauth_states` | Estados temporários do fluxo OAuth (TTL: 15 minutos) |

### Estrutura de Documento de Evento (`CalendarEventDocument`)

```typescript
{
  tenantId: string;
  ownerUserId: string;        // uid do dono do evento
  createdByUserId: string;
  updatedByUserId: string;
  title: string;
  description: string | null;
  location: string | null;
  status: "scheduled" | "completed" | "canceled";
  color: string;              // hex (#2563eb por padrão)
  isAllDay: boolean;
  startsAt: string | null;    // ISO datetime (se não for all-day)
  endsAt: string | null;
  startDate: string | null;   // YYYY-MM-DD (se for all-day)
  endDate: string | null;
  startMs: number;            // timestamp para ordenação/query
  endMs: number;
  googleSync: GoogleSyncMetadata;
  createdAt: string;
  updatedAt: string;
}
```

### Estrutura de Integração Google (`GoogleCalendarIntegrationDocument`)

```typescript
{
  tenantId: string;
  provider: "google";
  enabled: boolean;
  connectedEmail: string | null;
  calendarId: string;         // "primary" ou ID específico do calendário
  refreshToken: string;       // armazenado em texto plano no Firestore
  scopes: string[];
  connectedByUserId?: string | null;
  uid?: string;               // legado — usar connectedByUserId
  createdAt: string;
  updatedAt: string;
  lastSuccessfulSyncAt?: string | null;
  lastInboundSyncAt?: string | null;
  lastSyncError?: string | null;
}
```

**Nota de segurança:** O `refreshToken` é armazenado em texto plano no Firestore. O acesso é protegido pelas Firestore Security Rules (apenas backend via Admin SDK consegue ler). Não logar o refreshToken.

### Fluxo OAuth Google Calendar

```
1. Tenant admin chama GET /v1/calendar/google/auth-url
   → gera estado aleatório com crypto.randomBytes(32)
   → persiste estado em calendar_oauth_states (TTL 15 min)
   → retorna URL de autorização Google

2. Usuário autoriza no Google
   → Google redireciona para GET /v1/calendar/google/callback?code=...&state=...

3. Callback (rota pública):
   → valida state contra calendar_oauth_states (previne CSRF)
   → troca code por { access_token, refresh_token } via OAuth2
   → persiste integração em calendar_integrations/{tenantId}
   → redireciona para frontend /calendar?googleCalendar=connected

4. Uso subsequente:
   → cria OAuth2Client com refresh_token armazenado
   → Google SDK renova o access_token automaticamente quando necessário
```

### Sincronização Bidirecional Google Calendar

**Outbound (local → Google):** ao criar/atualizar/deletar um evento local com Google Calendar conectado, `syncEventToGoogle()` é chamado automaticamente. O evento é criado/atualizado/deletado no Google. A metadata de sync é armazenada em `event.googleSync`.

**Inbound (Google → local):** ao listar eventos (`GET /v1/calendar/events`), `syncGoogleEventsToLocalCalendar()` é executado se a última sincronização foi há mais de 15 segundos (`GOOGLE_INBOUND_SYNC_MIN_INTERVAL_MS`). Busca eventos do Google no mesmo range de datas e upserta localmente.

**Resolução de integração (`getGoogleIntegration()`):**
1. Tenta buscar diretamente por `calendar_integrations/{tenantId}` (formato novo)
2. Se não encontrar, faz query por `tenantId + provider + enabled` (formato legado)
3. Se encontrar legado, migra automaticamente para o formato novo (doc ID = tenantId) e deleta o legado

**Escopos OAuth solicitados:**
```
https://www.googleapis.com/auth/calendar.events.owned
https://www.googleapis.com/auth/userinfo.email
```

### Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `GOOGLE_CALENDAR_CLIENT_ID` | Sim (se sync habilitado) | Client ID OAuth 2.0 |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Sim (se sync habilitado) | Client Secret OAuth 2.0 |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Não | Override da URI de callback (padrão: derivado da request) |

### Habilitação da Feature

Controlado por `isGoogleCalendarSyncEnabled()` em `lib/google-calendar-feature.ts`. Se desabilitado, endpoints de sync retornam silenciosamente sem erro (o controller verifica antes de qualquer operação Google).

### Permissões

- Qualquer usuário autenticado do tenant pode criar/ver/editar/deletar eventos
- Somente `isTenantAdminRole` pode conectar/desconectar Google Calendar (`getGoogleCalendarAuthUrl`, `disconnectGoogleCalendar`)

### Validações de Input

| Campo | Validação |
|-------|-----------|
| `status` | `"scheduled"` \| `"completed"` \| `"canceled"` (throw `INVALID_STATUS`) |
| `color` | Hex `#RRGGBB` obrigatório (throw `INVALID_COLOR`) |
| `isAllDay: true` | `startDate` e `endDate` no formato `YYYY-MM-DD` |
| `isAllDay: false` | `startsAt` e `endsAt` como ISO datetime parseável |
| `endsAt/endDate` | Deve ser posterior a `startsAt/startDate` |

---

## Kanban

### Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `controllers/kanban.controller.ts` | CRUD de colunas do Kanban |
| `routes/kanban.routes.ts` | Definição de rotas |

### Rotas (todas protegidas sob `/v1`)

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/v1/kanban-statuses` | Cria coluna |
| `PUT` | `/v1/kanban-statuses/reorder` | Reordena colunas (batch) |
| `PUT` | `/v1/kanban-statuses/:id` | Atualiza coluna |
| `DELETE` | `/v1/kanban-statuses/:id` | Remove coluna |

**Atenção:** a rota `PUT /reorder` é registrada **antes** de `PUT /:id` para evitar que `"reorder"` seja interpretado como um ID.

### Coleção Firestore

`kanban_statuses` — cada documento representa uma coluna do Kanban de propostas.

```typescript
{
  tenantId: string;
  label: string;                    // max 40 chars
  color: string;                    // hex #RRGGBB
  order: number;                    // posição da coluna (>= 0)
  category: "open" | "won" | "lost";
  mappedStatus?: "draft" | "in_progress" | "sent" | "approved" | "rejected" | null;
  createdAt: string;
  updatedAt: string;
}
```

### Limites e Validações

| Regra | Valor |
|-------|-------|
| Máximo de colunas por tenant | 20 |
| Tamanho máximo do `label` | 40 caracteres |
| Formato de `color` | `#RRGGBB` (regex `/^#[0-9a-fA-F]{6}$/`) |
| Valores válidos de `category` | `"open"`, `"won"`, `"lost"` |
| Valores válidos de `mappedStatus` | `"draft"`, `"in_progress"`, `"sent"`, `"approved"`, `"rejected"` |

A verificação do limite de 20 colunas usa `collection.count().get()` — operação eficiente que não baixa documentos.

### Reordenação

`PUT /v1/kanban-statuses/reorder` recebe `{ statusIds: string[] }`. Atualiza o campo `order` de cada documento (0, 1, 2...) em uma única `db.batch()`. Não valida ownership individual de cada ID — apenas `tenantId` no nível do middleware de auth. **Cuidado:** um atacante com token válido poderia passar IDs de outros tenants; o batch faria update sem verificar. Para produção com alto risco, adicionar validação de tenant por ID.

### Isolamento Multi-Tenant

Verificação de tenant feita diretamente: `doc.data()?.tenantId !== tenantId` → 403.

---

## Validation

### Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `controllers/validation.controller.ts` | Pré-validação de contato para cadastro |
| `routes/validation.routes.ts` | Rota pública de validação |

### Rotas

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/v1/validation/contact` | Pública | Valida email e/ou telefone antes do cadastro |

### Comportamento

Recebe `{ email?, phoneNumber? }` — ao menos um deve estar presente.

**Validação de Email:**
1. Sintaxe via regex RFC-5321 simplificado
2. Comprimento máximo: 254 chars
3. Labels do domínio: max 63 chars cada
4. TLD mínimo: 2 chars
5. Resolução DNS do domínio (MX, A, AAAA) com timeout de 2.5s por resolve
6. Cache de resultados DNS por 10 minutos (`domainValidationCache`)
7. Verifica no Firebase Auth se o email já está cadastrado (`auth.getUserByEmail()`)

**Validação de Telefone:**
1. Normalização: remove não-dígitos, adiciona DDI `55` se ausente, adiciona `9` se celular de 8 dígitos sem o `9`
2. Formato final esperado: `55` + DDD válido + `9` + 8 dígitos = 13 dígitos
3. Verifica DDD contra lista de DDDs válidos brasileiros
4. Rejeita sequências repetidas (ex: `99999999999`)
5. Rejeita números de teste conhecidos
6. Verifica na coleção `phoneNumberIndex` se o telefone já está cadastrado

**Resposta:**

```typescript
{
  success: true,
  email?: {
    valid: boolean;
    exists: boolean;       // true se já cadastrado no Firebase Auth
    normalized?: string;   // email normalizado (lowercase)
    reason?: string;       // motivo da invalidade
  },
  phoneNumber?: {
    valid: boolean;
    exists: boolean;       // true se já na coleção phoneNumberIndex
    normalized?: string;   // formato E.164 sem "+"
    reason?: string;
  }
}
```

### Por que é Pública

Esta rota é usada na tela de cadastro **antes** de o usuário ter um token Firebase. Está protegida pelo rate limiter `publicGeneralLimiter` (300 req/min por IP).

---

## Auxiliary

### Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `controllers/auxiliary.controller.ts` | CRUD genérico para entidades auxiliares |
| `routes/auxiliary.routes.ts` | Rotas agrupadas por entidade |

### Rotas (todas protegidas sob `/v1/aux`)

| Método | Path | Coleção Firestore | Campos Obrigatórios |
|--------|------|-------------------|---------------------|
| `POST` | `/v1/aux/ambientes` | `ambientes` | `name` |
| `PUT` | `/v1/aux/ambientes/:id` | `ambientes` | - |
| `DELETE` | `/v1/aux/ambientes/:id` | `ambientes` | - |
| `POST` | `/v1/aux/sistemas` | `sistemas` | `name` |
| `PUT` | `/v1/aux/sistemas/:id` | `sistemas` | - |
| `DELETE` | `/v1/aux/sistemas/:id` | `sistemas` | - |
| `POST` | `/v1/aux/custom-fields` | `customFields` | `label`, `type` |
| `PUT` | `/v1/aux/custom-fields/:id` | `customFields` | - |
| `DELETE` | `/v1/aux/custom-fields/:id` | `customFields` | - |
| `POST` | `/v1/aux/options` | `options` | `label` |
| `PUT` | `/v1/aux/options/:id` | `options` | - |
| `DELETE` | `/v1/aux/options/:id` | `options` | - |
| `POST` | `/v1/aux/proposal-templates` | `proposalTemplates` | `name`, `content` |
| `PUT` | `/v1/aux/proposal-templates/:id` | `proposalTemplates` | - |
| `DELETE` | `/v1/aux/proposal-templates/:id` | `proposalTemplates` | - |

### Arquitetura do Controller

O controller usa três handlers genéricos (`handleCreate`, `handleUpdate`, `handleDelete`) que recebem o nome da coleção como parâmetro. Isso elimina duplicação de código para operações CRUD simples.

**handleCreate:**
- Valida campos obrigatórios (aceita string não vazia, ou valor non-null/undefined)
- Resolve `tenantId` via `resolveUserAndTenant()` (stale claims fallback incluído)
- Super-admin pode passar `targetTenantId` no body para criar em outro tenant
- Strips campos protegidos antes de salvar: `id`, `tenantId`, `targetTenantId`, `createdAt`, `updatedAt` — evita que o cliente injete esses campos
- Adiciona `tenantId`, `createdAt`, `updatedAt` via Firestore Timestamp (server-side)

**handleUpdate:**
- Verifica existência do documento e ownership por tenant
- Super-admin pode atualizar documentos de qualquer tenant
- Strips campos protegidos: `id`, `tenantId`, `targetTenantId`, `createdAt`
- Atualiza `updatedAt` via Timestamp server-side

**handleDelete:**
- Verifica existência e ownership por tenant
- Super-admin pode deletar documentos de qualquer tenant

### Isolamento Multi-Tenant

Dupla verificação:
1. `resolveUserAndTenant()` resolve e valida o `tenantId` do usuário autenticado
2. `doc.data()?.tenantId !== tenantId` → 403 (exceto super-admin)

### Mapeamento de Erros

```typescript
function mapAuxiliaryError(error): { status, message } {
  // FORBIDDEN_* ou AUTH_CLAIMS_MISSING_* → 403
  // outros → 500
}
```

---

## Spreadsheets

### Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `controllers/spreadsheets.controller.ts` | CRUD de planilhas com controle de plano |

### Rotas (protegidas, definidas em `routes/core.routes.ts` ou `finance.routes.ts`)

As rotas de spreadsheets são registradas em outro arquivo de rotas — verificar onde `createSpreadsheet`, `updateSpreadsheet`, `deleteSpreadsheet` são importados.

### Coleção Firestore

`spreadsheets` — cada documento é uma planilha do tenant.

```typescript
{
  tenantId: string;
  name: string;                // "Planilha" por padrão
  dataJson: string;            // JSON serializado dos dados da planilha
  data: null;                  // legado — campo antigo, setado para null na migração
  dataFormat: string;          // "univer" (padrão) — formato do editor
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdById: string;         // uid do criador
}
```

### Integração com UniverJS

O campo `dataJson` armazena o estado serializado do editor **UniverJS** (biblioteca de planilhas open-source). O `dataFormat: "univer"` identifica o formato para o frontend saber como renderizar/parsear o dado.

### Limites de Plano (Plan Enforcement)

Dois limites são verificados via `enforceTenantPlanLimit()` de `lib/tenant-plan-policy.ts`:

**No Create:**
1. `maxSpreadsheets` — conta o total de planilhas do tenant
2. `storageQuotaMB` — estima o tamanho do `dataJson` em MB e verifica se a quota total seria excedida

**No Update:**
- `storageQuotaMB` — calcula o delta entre o tamanho atual e o novo `dataJson`. Só verifica se houver aumento positivo (`deltaMb > 0`)

Ambos retornam HTTP 402 se o limite for atingido, com `code: "PLAN_LIMIT_EXCEEDED"`.

### Estimativa de Tamanho

```typescript
function getEstimatedStorageIncreaseMb(input): number {
  // Usa Buffer.byteLength(json, "utf8") para calcular bytes reais (não chars)
  // Mínimo retornado: 1 MB (previne falsos negativos em payloads pequenos)
}
```

### Migração de Campo `data` → `dataJson`

Documentos antigos usavam o campo `data` (objeto Firestore). Novos documentos usam `dataJson` (string). No update, se `data` existir no documento atual, é serializado para string antes do cálculo de delta:

```typescript
const currentDataJson =
  typeof existingData?.dataJson === "string"
    ? existingData.dataJson
    : JSON.stringify(existingData?.data || {});
```

Ao salvar o update com novo `dataJson`, o campo antigo `data` é setado para `null`.

### Super-Admin Override

Super-admin pode criar planilha para outro tenant passando `targetTenantId` no body. O plan enforcement usa o `targetTenantId` (não o tenant do usuário super-admin).

---

## Helpers de Rota

### `api/helpers/notification-scope.ts`

Resolução do escopo de notificações para o controller de notificações.

```typescript
type NotificationScope =
  | { kind: "system" }         // notificações globais (apenas super-admin)
  | { kind: "tenant"; tenantId: string }  // notificações de um tenant
```

**`resolveNotificationScopeFromRequest(userId, claims, input)`:**

| Input | Super-admin? | Resultado |
|-------|-------------|-----------|
| `scopeKind: "system"` | Sim | `{ kind: "system" }` |
| `scopeKind: "system"` | Não | Lança `FORBIDDEN_NOTIFICATION_SCOPE` |
| `scopeKind: "tenant"` | Qualquer | `{ kind: "tenant", tenantId }` |
| `targetTenantId` diferente do próprio | Não | Lança `FORBIDDEN_NOTIFICATION_SCOPE` |
| Nenhum scope | Super-admin | `{ kind: "system" }` |
| Nenhum scope | Usuário normal | `{ kind: "tenant", tenantId: do usuário }` |

### `api/helpers/transaction-validation.ts`

**`CreateTransactionDTO`** — interface de DTO para criação de transações. Documenta todos os campos aceitos pelo `transaction.service.ts`.

**`validateTransactionData()`** — validação básica de campos obrigatórios (`description`, `amount`, `date`, `type`, `status`). Nota: a validação atual é minimal e o service tem validações adicionais próprias.

---

## Storage

### `lib/storage-helpers.ts`

**`deleteProductImages(images, tenantId?)`:**

Deleta arquivos de imagens de produtos no Firebase Storage. Suporta:
- Caminhos diretos (`tenants/...`)
- URLs `firebasestorage.googleapis.com` (extrai o path via regex + `decodeURIComponent`)
- URLs `firebasestorage.app` (mesmo pattern)
- URLs `storage.googleapis.com` (extrai após o bucket)

Ignora:
- Strings `data:...` (imagens base64 inline — não estão no Storage)
- Caminhos de outros tenants (loga WARN e pula — proteção cross-tenant)
- Erros 404 (arquivo já deletado — silencioso)

### `lib/storage-gc.ts` — Garbage Collection Queue

Sistema de fila para deletar arquivos do Storage quando a deleção direta falha (ex: timeout, erro transitório).

**Coleção Firestore:** `storage_gc_queue`

**`enqueueStorageGcPath(options)`:**
- Usa transação Firestore para evitar duplicatas (doc ID = SHA-256 do path)
- Se o item já existe na fila, incrementa `attempts` em vez de criar duplicata
- Valida o path: deve começar com `tenants/`, sem `..`, max 1024 chars

**`processStorageGcQueue(maxItems?)`:**
- Processa até `maxItems` itens com `status: "pending"` (padrão: 300)
- Usa `bucket.file(path).delete({ ignoreNotFound: true })` — não falha se já deletado
- Após `MAX_STORAGE_GC_ATTEMPTS` (8) falhas: move para `status: "dead_letter"`
- Retorna `{ processed, deleted, failed, deadLettered }`

Chamado pelo scheduled function `cleanupStorageAndSharedLinks.ts`.

**Razões válidas para enqueue (`StorageGcReason`):**

| Razão | Quando |
|-------|--------|
| `proposal_update_attachment_cleanup_failed` | Falha ao limpar anexo antigo durante update de proposta |
| `proposal_delete_cleanup_failed` | Falha ao limpar anexos durante deleção de proposta |

---

## Contact Validation (`lib/contact-validation.ts`)

Biblioteca de validação de contatos usada por `validation.controller.ts` e outros controllers que precisam validar dados de clientes.

### Funções Exportadas

| Função | Síncrona? | Descrição |
|--------|-----------|-----------|
| `normalizeEmail(value)` | Sim | Lowercase + trim |
| `isValidEmailSyntax(value)` | Sim | RFC-5321 simplificado (regex) |
| `hasResolvableEmailDomain(email)` | Não (DNS) | MX/A/AAAA com cache 10min |
| `validateEmailForSignup(value)` | Não | Sintaxe + DNS |
| `normalizeBrazilPhoneNumber(value)` | Sim | Normaliza para E.164 sem `+` |
| `validateBrazilMobilePhone(value)` | Sim | Valida formato BR celular |

### Cache de DNS

`domainValidationCache` (Map em memória) armazena resultados de resolução DNS por 10 minutos por domínio. Reduz latência e carga em DNS recursivo para validações repetidas do mesmo domínio.

### Normalização de Telefone BR

```
Entrada: "11 9 8765-4321"  → Saída: "5511987654321"
Entrada: "11 8765-4321"    → Saída: "5511987654321" (add 9 para celular 8-dígitos)
Entrada: "+55 11 9 8765-4321" → Saída: "5511987654321"
```

Formato final: `55` (DDI) + 2 dígitos DDD + `9` + 8 dígitos = 13 dígitos total.
