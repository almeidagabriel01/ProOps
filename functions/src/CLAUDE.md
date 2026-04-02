# CLAUDE.md — Crons, Entry Point e Configuracao de Deploy

## Visao geral

`functions/src/index.ts` e o entry point que exporta todas as Cloud Functions V2:

| Exportacao | Tipo | Descricao |
|------------|------|-----------|
| `api` | HTTP (Express) | Monolito Express — todas as rotas REST |
| `stripeWebhook` | HTTP (Express) | Webhook Stripe com verificacao de assinatura |
| `checkManualSubscriptions` | Scheduled | Verificacao diaria de assinaturas manuais |
| `checkDueDates` | Scheduled | Verificacao diaria de vencimentos |
| `checkStripeSubscriptions` | Scheduled | Sync diario de status Stripe |
| `reportWhatsappOverage` | Scheduled | Billing de overage WhatsApp (dia 1 do mes) |
| `cleanupStorageAndSharedLinks` | Scheduled | Limpeza de arquivos e links expirados |

**Global options** aplicadas a todas as funcoes:
```typescript
setGlobalOptions({
  region: "southamerica-east1",
  memory: "1GiB",
});
```

---

## `deploymentConfig.ts`

Centraliza configuracoes de deploy para evitar divergencias entre funcoes.

### `CORS_OPTIONS` (usado pela funcao `api`)

```typescript
{
  cors: true,
  region: "southamerica-east1",
  cpu: 1,
  maxInstances: 10,  // 10 instancias * 80 concurrent = 800 req/s max
  concurrency: 80,   // Max concorrencia V2
}
```

### `SCHEDULE_OPTIONS` (usado pelos crons)

```typescript
{
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  cpu: 1,
  maxInstances: 10,
}
```

Cada cron pode sobrescrever `memory`, `timeoutSeconds` e `schedule` individualmente.

---

## Funcoes agendadas (Scheduled Functions)

### 1. `checkDueDates` — Verificacao de vencimentos

**Arquivo:** `functions/src/checkDueDates.ts`
**Schedule:** `every 24 hours`
**Timeout:** 300 segundos
**Regiao:** `southamerica-east1`

#### O que faz

**Parte 1 — Transacoes pendentes:**
- Query: `status == "pending" AND dueDate <= (hoje + 3 dias)`
- Requer indice composto: `(status ASC, dueDate ASC)`
- Para cada transacao: cria (ou upserta) notificacao de lembrete do tipo `transaction_due_reminder`
- Diferencia parcelas (`isInstallment == true`) de lancamentos avulsos na mensagem
- Diferencia vencidos (`dueDate < hoje`) de proximos ao vencimento

**Parte 2 — Propostas expirando:**
- Query: `status in ["draft", "in_progress", "sent"]` (sem filtro de data — filtragem em memoria)
- Ignora propostas com `validUntil > (hoje + 3 dias)`
- Cria notificacao `proposal_expiring` para cada proposta elegivel

**Parte 3 — Limpeza de sessoes WhatsApp:**
- Remove documentos de `whatsappSessions` com `expiresAt < (agora - 24h)`
- Limite de 200 por execucao (para nao travar o cron)
- Falha nao-fatal: erro e logado mas nao aborta o cron

#### Upsert de notificacoes de vencimento

Notificacoes de vencimento usam IDs estaveis (deterministas):

```
due_{tenantId}_{type}_{resourceField}_{resourceId}
```

Exemplo: `due_abc123_transaction_due_reminder_transactionId_xyz789`

Isso garante que a mesma transacao nao gera multiplas notificacoes a cada execucao — `notificationRef.set(..., { merge: true })` sobrescreve o documento existente com `isRead: false` (reset diario).

#### Indices Firestore necessarios

```json
{
  "collectionGroup": "transactions",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "dueDate", "order": "ASCENDING" }
  ]
}
```

---

### 2. `checkStripeSubscriptions` — Sync diario de assinaturas Stripe

**Arquivo:** `functions/src/checkStripeSubscriptions.ts`
**Schedule:** `every 24 hours`
**Timeout:** 540 segundos (9 minutos)
**Memory:** 512MiB

#### O que faz

1. Chama `runStripeSync(LIMIT=200, startAfterId, dryRun=false)` em loop paginado
2. `runStripeSync` (em `stripeHelpers.ts`) itera todos os usuarios com `stripeSubscriptionId`, recupera a subscription no Stripe e compara o status
3. Se houve mudanca de status: atualiza `users/{uid}` e `tenants/{tenantId}` no Firestore
4. Continua paginando ate `hasMore === false`
5. Apos o sync completo: cria ou atualiza notificacao `system` para todos os superadmins

#### Notificacao para superadmins

- `tenantId: "system"` — especial para notificacoes globais de superadmin
- Se nao existir notificacao de sync hoje: cria uma nova
- Se ja existir: atualiza a mais recente e deleta as antigas (evita acumulo)
- Mensagem inclui quantas assinaturas mudaram de status

#### dryRun mode

`syncAllSubscriptions` (endpoint manual) aceita `dryRun: true` — calcula mudancas sem persistir. Util para auditar antes de um sync forcado.

---

### 3. `checkManualSubscriptions` — Assinaturas manuais

**Arquivo:** `functions/src/checkManualSubscriptions.ts`
**Schedule:** `every 24 hours`
**Timeout:** 300 segundos

Assinaturas manuais sao planos pagos fora do Stripe (boleto, PIX manual, etc.) marcados com `isManualSubscription: true` em `users/{uid}`.

#### Ciclo de vida de uma assinatura manual

```
active  ─── currentPeriodEnd expirou ──►  past_due
past_due ─── mais de 7 dias expirado ──►  canceled (planId: "free")
```

**Passo 1 — Active → Past Due:**
- Query: `isManualSubscription == true AND status == "active" AND currentPeriodEnd < agora`
- Batch update: `subscriptionStatus: "past_due"`

**Passo 2 — Past Due → Canceled (grace period 7 dias):**
- Query: `isManualSubscription == true AND status == "past_due" AND currentPeriodEnd < (agora - 7 dias)`
- Batch update: `subscriptionStatus: "canceled"`, `planId: "free"`

---

### 4. `reportWhatsappOverage` — Billing de overage WhatsApp

**Arquivo:** `functions/src/reportWhatsappOverage.ts`
**Schedule:** `0 3 1 * *` — Dia 1 de cada mes as 03:00 BRT
**Timeout:** 300 segundos
**Memory:** 256MiB
**Regiao:** `southamerica-east1`

#### O que faz

Para cada tenant com `whatsappEnabled == true AND whatsappAllowOverage == true`:

1. Le `whatsappUsage/{tenantId}/months/{mesAnterior}` (ex: `2025-03` quando executa em abril)
2. Verifica `overageMessages > 0` e `stripeReported !== true`
3. Reporta ao Stripe via `stripe.billing.meterEvents.create`:
   ```typescript
   {
     event_name: "whatsapp_messages",
     identifier: `${tenantId}:${month}:whatsapp_overage`,  // idempotency key
     payload: {
       value: String(overageMessages),
       stripe_customer_id: tenant.stripeCustomerId,
     }
   }
   ```
4. Atualiza o documento de uso com `stripeReported: true` e `stripeEventId`

**Idempotencia:** O `identifier` garante que o mesmo overage nao seja reportado duas vezes mesmo se o cron rodar mais de uma vez no mesmo mes.

**Saida:** Log com `processed`, `charged`, `skipped`, `errors`.

#### Debug manual

Endpoint `POST /internal/cron/whatsapp-overage-report` replica a logica do cron:

```bash
curl -X POST https://.../api/internal/cron/whatsapp-overage-report \
  -H "x-cron-secret: <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{ "month": "2025-03" }'  # opcional — default: mes anterior
```

O mes pode ser passado via `body.month` ou `query.month`. Formato: `YYYY-MM`.

---

### 5. `cleanupStorageAndSharedLinks`

**Arquivo:** `functions/src/cleanupStorageAndSharedLinks.ts`
**Schedule:** Periodica (ver arquivo)

Remove:
- Arquivos PDF do Firebase Storage que nao tem mais documento Firestore correspondente
- Documentos de shared links expirados (`sharedProposals`, `sharedTransactions`)

---

## `stripeWebhook` — Webhook Stripe

**Arquivo:** `functions/src/stripe/stripeWebhook.ts`

Funcao HTTP separada (nao faz parte do monolito `api`):

- Recebe eventos do Stripe em `POST /stripeWebhook`
- Verifica assinatura com `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
- `rawBody` deve ser o Buffer bruto — o Express middleware preserva em `req.rawBody`
- Processa eventos e atualiza Firestore
- Retorna 200 para eventos ignorados tambem (Stripe nao deve retentar eventos desconhecidos)

---

## Estrutura de colecoes Firestore por modulo

| Colecao | Modulo | Descricao |
|---------|--------|-----------|
| `users/{uid}` | Auth/Billing | Dados do usuario, status de assinatura |
| `tenants/{tenantId}` | Multi-tenant | Dados do tenant, config WhatsApp, billing |
| `notifications` | Notifications | Notificacoes de todos os tipos |
| `notification_due_toast_claims/{id}` | Notifications | Claim diario de toast (idempotente) |
| `addons/{tenantId}_{addonId}` | Billing | Status de add-ons |
| `phoneNumberIndex/{phone}` | WhatsApp | Mapeamento telefone → usuario |
| `whatsappSessions/{phone}` | WhatsApp | Sessoes de conversa (TTL 10 min) |
| `whatsappRateLimit/{phone}` | WhatsApp | Rate limit por minuto/dia |
| `whatsappUsage/{tenantId}/months/{YYYY-MM}` | WhatsApp | Uso mensal e overage |
| `whatsappLogs` | WhatsApp | Audit trail de acoes do bot |
| `proposals/{proposalId}` | Propostas | Propostas (com `pdf.storagePath` e `pdfGenerationLock`) |
| `transactions/{transactionId}` | Financeiro | Lancamentos financeiros |
| `wallets/{walletId}` | Financeiro | Carteiras com saldo desnormalizado |
| `sharedProposals/{token}` | Share Links | Links publicos de propostas |
| `sharedTransactions/{token}` | Share Links | Links publicos de lancamentos |

---

## Configuracao de recursos por funcao

| Funcao | CPU | Memory | Max Instances | Concurrency | Timeout |
|--------|-----|--------|---------------|-------------|---------|
| `api` | 1 | 1GiB | 10 | 80 | default (60s) |
| `stripeWebhook` | 1 | 1GiB | 10 | - | default |
| `checkDueDates` | 1 | 1GiB | 10 | - | 300s |
| `checkStripeSubscriptions` | 1 | 512MiB | 10 | - | 540s |
| `checkManualSubscriptions` | 1 | 1GiB | 10 | - | 300s |
| `reportWhatsappOverage` | 1 | 256MiB | 10 (via SCHEDULE_OPTIONS) | - | 300s |
| `cleanupStorageAndSharedLinks` | 1 | 1GiB | 10 | - | - |

> `memory: "1GiB"` aplicado via `setGlobalOptions` — funcoes podem sobrescrever individualmente.

---

## Regras criticas para funcoes agendadas

- **Nunca fazer deploy de mudanca em `reportWhatsappOverage` sem revisao manual** — funcao que gera cobrancas reais
- Testar crons com Firebase Emulators antes de deploiar em producao
- A funcao `reportWhatsappOverage` usa `identifier` como chave de idempotencia — a key inclui `tenantId:month:whatsapp_overage`, o que garante que executar duas vezes no mesmo mes nao cobra duas vezes
- `checkManualSubscriptions` nao notifica o usuario sobre mudancas de status — considerar se e necessario adicionar notificacao ao downgrade para `free`
- `checkDueDates` faz upsert com `isRead: false` sempre — se o usuario marcou a notificacao como lida, ela volta como nao lida no dia seguinte (comportamento intencional: e um lembrete diario)

---

## Comandos de deploy

```bash
# Compilar TypeScript
cd functions && npm run build

# Deploy para dev
npm run deploy:dev    # na raiz do projeto

# Deploy para prod
npm run deploy:prod   # na raiz do projeto

# Testar cron manualmente (webhook de debug)
curl -X POST https://southamerica-east1-erp-softcode.cloudfunctions.net/api/internal/cron/whatsapp-overage-report \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"month": "2025-03"}'
```
