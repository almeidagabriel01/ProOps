# CLAUDE.md — Stripe Controller & Billing

## Arquivo principal
`functions/src/api/controllers/stripe.controller.ts`

## Rotas registradas

| Método | Caminho | Handler | Auth | Descrição |
|--------|---------|---------|------|-----------|
| `GET` | `/stripe/plans` | `getPlans` | Público | Lista planos e add-ons com preços reais do Stripe |
| `POST` | `/stripe/checkout` | `createCheckoutSession` | Admin/FREE owner | Cria sessão de checkout ou troca de plano diretamente |
| `POST` | `/stripe/confirm-checkout` | `confirmCheckoutSession` | Admin/FREE owner | Confirma sessão concluída e persiste assinatura |
| `POST` | `/stripe/preview` | `previewPlanChange` | Admin | Preview de proration para mudança de plano |
| `POST` | `/stripe/checkout-addon` | `createAddonCheckoutSession` | Admin | Cria sessão de checkout para add-on |
| `POST` | `/stripe/cancel` | `cancelAddon` | Admin | Agenda cancelamento de add-on no fim do período |
| `POST` | `/stripe/cancel-subscription` | `cancelSubscription` | Admin | Agenda cancelamento da assinatura principal |
| `POST` | `/stripe/portal` | `createPortalSession` | Admin | Abre Stripe Billing Portal |
| `POST` | `/stripe/sync` | `syncSubscription` | Admin | Sincroniza status do Stripe para o Firestore (usuário atual) |
| `POST` | `/stripe/sync-all` | `syncAllSubscriptions` | SuperAdmin | Sync batch de todas as assinaturas (paginado) |

> As rotas publicas ficam em `publicStripeRoutes` (sem auth middleware). As demais ficam em `stripeRoutes` (protegidas pelo auth middleware aplicado no `core.routes.ts`).

---

## Autenticacao e contexto (`resolveStripeUserContext`)

Toda handler privada chama `resolveStripeUserContext(req)` antes de qualquer operação Stripe. Esta função:

1. Verifica `assertTenantAdminClaim(req)` (role admin ou master)
2. Extrai `userId` e `tenantId` dos custom claims
3. Busca documentos `users/{userId}` e `tenants/{tenantId}` no Firestore
4. Valida que `user.tenantId` (ou `companyId`) bate com o claim — lança `FORBIDDEN_TENANT_MISMATCH` se não bater
5. Resolve `customerId` do Stripe: prioridade `tenant.stripeCustomerId` > `user.stripeId`

Exceção: `createCheckoutSession` e `confirmCheckoutSession` aceitam `allowFreeOwnerCheckout: true`, que permite usuários com `role=FREE` sem `masterId` (dono sem plano ativo).

---

## Planos e precos

### Tiers disponíveis

| Tier | Nome | Trial | Destaques |
|------|------|-------|-----------|
| `starter` | Starter | Nao | 80 propostas, 1 usuario, sem financeiro |
| `pro` | Profissional | 7 dias | Ilimitado, 2 usuarios, financeiro, customizacao |
| `enterprise` | Enterprise | Nao | Tudo ilimitado, Kanban |

### Add-ons compraveis

| ID | Uso |
|----|-----|
| `financial` | Módulo financeiro avulso |
| `pdf_editor_partial` | Editor PDF parcial |
| `pdf_editor_full` | Editor PDF completo |
| `crm` | CRM avulso |
| `whatsapp_addon` | WhatsApp Bot |

Precos sao lidos dinamicamente do Stripe via `getPriceConfig()` de `stripeConfig.ts`. IDs de price ficam em variaveis de ambiente — nunca hardcoded no código.

---

## Criação de checkout (`createCheckoutSession`)

### Fluxo se usuario JA TEM assinatura ativa
1. Recupera subscription existente no Stripe
2. Se ja tem o mesmo preco e nao esta cancelando: retorna `success` imediatamente
3. Chama `stripe.subscriptions.update` com `proration_behavior: "always_invoice"` — gera fatura de ajuste na hora
4. Verifica mudanca de ciclo (`monthly <-> yearly`): se diferente, usa `billing_cycle_anchor: "now"` para resetar o periodo
5. Chama `addWhatsAppOverageToSubscription` para garantir o item de overage
6. Atualiza `users/{userId}` e `tenants/{tenantId}` via `updateUserPlan` e `upsertTenantStripeBillingData`

### Fluxo se usuario NAO TEM assinatura (novo checkout)
1. Cria `stripe.customers` se `customerId` ainda nao existe; persiste no Firestore
2. **Trial eligibility** (apenas `planTier === "pro"` e `skipTrial !== true`):
   - `reserveTrialSlot(tenantId)` — Firestore Transaction atomica que seta `trialReservedAt`; evita race condition TOCTOU
   - `hasEmailUsedTrial(email)` — cruza todos os tenants com o mesmo email para bloquear abuso multi-conta
   - Se elegivel, seta `trial_period_days: 7` no `subscription_data`
   - `payment_method_collection: "always"` — cartao sempre obrigatorio mesmo em trial
   - TTL de reserva: 30 minutos (checkout abandonado libera o slot)
3. `success_url: /checkout-success?session_id={CHECKOUT_SESSION_ID}` — frontend chama `confirmCheckoutSession` ao carregar esta página

---

## Confirmação de checkout (`confirmCheckoutSession`)

Chamado pelo frontend apos redirect de sucesso:

1. Recupera sessao do Stripe com `expand: ["subscription"]`
2. Valida `session.status === "complete"` e `payment_status === "paid"` ou `"no_payment_required"` (trial)
3. Valida que `session.metadata.userId` e `session.metadata.tenantId` batem com o token autenticado
4. Chama `markTrialUsed(tenantId)` se status for `"trialing"` — seta `trialUsedAt` e `trialEndsAt`
5. Chama `addWhatsAppOverageToSubscription` para adicionar item de overage
6. Persiste em `users/{userId}` e `tenants/{tenantId}`
7. Retorna `{ success, subscriptionId, planTier, status, trial?, trialEndsAt? }`

---

## Preview de mudança de plano (`previewPlanChange`)

Calcula o custo de proration **sem efetuar cobranças**:

1. Projeta os itens da subscription com o novo `priceId`
2. Chama `stripe.invoices.retrieveUpcoming` com `proration_behavior: "always_invoice"`
3. Retorna `amountDue` (upgrade paga agora), `creditAmount` (downgrade gera credito), dados do cartao atual e proxima data de cobranca

---

## Cancelamento

### Addon (`cancelAddon`)
- `stripe.subscriptions.update(id, { cancel_at_period_end: true })`
- Atualiza `addons/{tenantId}_{addonId}` com `cancelAtPeriodEnd: true` e `cancelScheduledAt`
- Addon permanece ativo ate o fim do periodo pago

### Assinatura principal (`cancelSubscription`)
- Mesma logica: `cancel_at_period_end: true`
- Atualiza `users/{userId}` e `tenants/{tenantId}` com `cancelAtPeriodEnd: true`
- Nao cancela imediatamente — usuario continua com acesso

---

## Webhook Stripe

O webhook esta em `functions/src/stripe/stripeWebhook.ts` (nao neste controller). Responsabilidades:

- Verifica assinatura com `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`
- `rawBody` e preservado pelo Express middleware como `req.rawBody` (Buffer)

### Eventos tratados no webhook

| Evento | Ação no Firestore |
|--------|-------------------|
| `customer.subscription.created` | Sync status inicial em users + tenants |
| `customer.subscription.updated` | Atualiza `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd` |
| `customer.subscription.deleted` | Marca como `canceled`, downgrade para `free` |
| `invoice.payment_succeeded` | Atualiza `subscriptionStatus` para `active` |
| `invoice.payment_failed` | Atualiza para `past_due` |
| `customer.subscription.trial_will_end` | (log) |

---

## Estrutura de dados no Firestore

### `users/{userId}`

```
stripeId: string                 // Stripe customer ID
stripeSubscriptionId: string     // ID da subscription ativa
subscriptionStatus: string       // active | trialing | past_due | canceled | free
currentPeriodEnd: ISO string     // fim do periodo atual
cancelAtPeriodEnd: boolean
billingInterval: "monthly" | "yearly"
planId: string                   // starter | pro | enterprise | free
trialUsedAt?: ISO string         // setado ao confirmar trial
```

### `tenants/{tenantId}`

```
stripeCustomerId: string
stripeSubscriptionId: string
subscriptionStatus: string
currentPeriodEnd: ISO string
cancelAtPeriodEnd: boolean
cancelScheduledAt?: ISO string
whatsappOverageSubscriptionItemId?: string  // item ID do Stripe para overage metered billing
trialUsedAt?: ISO string
trialReservedAt?: ISO string    // reserva atomica de trial (TTL 30 min)
trialEndsAt?: ISO string
```

### `addons/{tenantId}_{addonId}`

```
tenantId: string
addonType: string               // financial | whatsapp_addon | ...
stripeSubscriptionId: string
status: "active" | "past_due" | "canceled"
cancelAtPeriodEnd: boolean
currentPeriodEnd: ISO string
```

---

## Add-on WhatsApp Overage (metered billing)

Toda subscription ativa inclui automaticamente um item de overage (preco metered) para WhatsApp. Gerenciado via `addWhatsAppOverageToSubscription(subscriptionId)` em `stripeHelpers.ts`:

- Verifica se o item ja existe na subscription
- Se nao existe, adiciona via `stripe.subscriptions.update`
- O `WHATSAPP_OVERAGE_PRICE_ID` e configurado via env var

O billing efetivo de overage e reportado pelo cron `reportWhatsappOverage` (ver `functions/src/CLAUDE.md`).

---

## CORS e origens

`resolveRequestOrigin(req)` determina a origem permitida para URLs de redirect do Stripe Checkout. Regras:

1. `CORS_ALLOWED_ORIGINS` (env, comma-separated) tem prioridade maxima
2. `APP_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_URL`, variacoes Vercel sao adicionadas automaticamente
3. Em dev: `localhost:3000` e sempre permitido
4. Previews Vercel (`*.vercel.app`), `.web.app`, `.firebaseapp.com` sao permitidos por padrao em nao-producao
5. Em producao sem allowlist configurada: lanca erro `FORBIDDEN_CORS_ALLOWLIST_REQUIRED`

---

## Ownership e segurança

`assertSubscriptionOwnership(subscription, tenantId, customerId)`:
- Valida que `subscription.metadata.tenantId === tenantId` (se presente)
- Valida que `subscription.customer === customerId` (se ambos presentes)
- Lanca `FORBIDDEN_STRIPE_OWNERSHIP` se nao bater

Essa funcao previne que um admin de um tenant manipule a subscription de outro tenant mesmo que tenha o ID.

---

## Checklist ao modificar billing

- [ ] Nunca fazer deploy de mudanca de billing em producao sem revisao manual
- [ ] Testar webhook localmente com `stripe listen --forward-to localhost:5001/...`
- [ ] Nao mudar `WHATSAPP_OVERAGE_PRICE_ID` sem migrar os itens de subscription existentes
- [ ] `createCheckoutSession` aceita `allowFreeOwnerCheckout` — nao remover sem rever o fluxo de onboarding
- [ ] Trial: testar `reserveTrialSlot` com requests concorrentes para confirmar que TOCTOU esta protegido
- [ ] `cancel_at_period_end: true` — nunca cancelar imediatamente sem confirmacao explicita do usuario
