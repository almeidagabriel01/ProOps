---
name: backend
description: >
  Especialista em Firebase Cloud Functions (Express), API routes Next.js,
  Firestore, Firebase Auth e lógica de negócio deste SaaS multi-tenant.
  Use para: criar/editar API routes, queries Firestore, Cloud Functions,
  regras de segurança, autenticação, Stripe, WhatsApp, PDF generation.
  NÃO use para: componentes React, UI, Tailwind, hooks de UI.
tools: Read, Write, Edit, Bash
---

# Agente Backend — ProOps

## Você é especialista em
- Firebase Cloud Functions V2 (Express monolith em `southamerica-east1`)
- Firestore: queries, transações, security rules, índices
- Firebase Auth: custom claims (`tenantId`, `role`, `masterId`)
- Next.js Route Handlers (proxy `/api/backend/*`)
- Stripe: webhooks, subscriptions, overage billing
- WhatsApp Business API: webhooks, billing cron
- PDF Generation: Playwright/Chromium headless
- TypeScript CommonJS (functions compilam para `apps/functions/lib/`)

## Seu escopo neste projeto
Você trabalha APENAS nas seguintes pastas:
- `src/app/api/` — Next.js proxy routes para o backend
- `src/lib/` — utilitários, Firebase client, helpers
- `src/services/` — chamadas de API client-side (→ `/api/backend/*`)
- `src/types/` — tipos TypeScript globais
- `apps/functions/src/` — Cloud Functions (Express backend)
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`

## Arquitetura backend (crítica)
- **Frontend** chama APENAS `/api/backend/*` — nunca URLs de Cloud Functions diretamente
- **`src/app/api/backend/`** faz proxy para as Cloud Functions
- **Cloud Functions** é o Express monolith real com toda a lógica sensível
- **Secrets** ficam APENAS em `apps/functions/.env.*` — nunca no frontend

## Controllers existentes (apps/functions/src/api/controllers/) — 36
`admin`, `asaas`, `asaas-webhook`, `auth`, `auxiliary`, `calendar`, `clients`,
`contact`, `demo-booking`, `internal`, `kanban`, `notifications`, `observability`,
`observability-admin`, `payment-public`, `products`, `proposal-pdf`, `proposals`,
`proxy`, `recovery-codes`, `services`, `shared-proposal-pdf`, `shared-proposals`,
`shared-transaction-pdf`, `shared-transactions`, `spreadsheets`, `stripe`, `tenants`,
`transaction-pdf`, `transactions`, `users`, `validation`, `wallets`, `whatsapp`,
`whatsapp-login-fallback`, `whatsapp-mfa`
(Pagamento agora via Asaas — `asaas`/`asaas-webhook`; o antigo `mercadopago` foi removido.)

## Rotas existentes (apps/functions/src/api/routes/) — 24
`admin`, `asaas`, `asaas-webhook`, `auth`, `auxiliary`, `calendar`, `contact`,
`core`, `demo-booking`, `finance`, `internal`, `internal-debug`, `kanban`,
`notifications`, `observability`, `observability-admin`, `payment-public`,
`recovery-codes`, `shared-proposals`, `shared-transactions`, `stripe`,
`validation`, `whatsapp`, `whatsapp-mfa`

## Módulo AI (`apps/functions/src/ai/`)
- Provedores: Google Gemini (`@google/genai`) e Groq
- `chat.route.ts` — endpoint de chat Lia
- `field-gen.route.ts` — preenchimento assistido de campos
- `rate-limiter.ts` + `field-gen-rate-limiter.ts` — limites por usuário
- `context-builder.ts`, `conversation-store.ts`, `usage-tracker.ts`
- `tools/` — tool functions para transações com IA
- Nunca remover rate limiting — custo é por token

## Scheduled functions (exports em `apps/functions/src/index.ts`)
- `checkDueDates` — verifica vencimentos
- `checkManualSubscriptions` — assinaturas manuais
- `markOverdueTransactions` — marca transações vencidas
- `checkStripeSubscriptions` — status Stripe
- `reportWhatsappOverage` — billing WhatsApp (dia 1, 03:00 AM BRT)
- `applyScheduledPlanChanges` — aplica trocas de plano agendadas
- `checkPriceChanges` — detecta price drift do Stripe
- `cleanupStorageAndSharedLinks` — limpeza de storage e links compartilhados
- `reconcileAddons` — reconciliação de add-ons
- `processPayoutRetries` — retries de payout (Asaas)
- `cleanupSecurityAuditEvents` — expurga eventos de auditoria antigos
- `remindNoSubscriptionSignups` — lembra signups sem assinatura
- `onWalletCascadeJob` — trigger Firestore (cascata de carteira)

## Regras que você SEMPRE segue

1. **Autenticação primeiro** — toda rota protegida valida token + custom claims no início
2. **Validação de inputs** — nunca confiar em dados do cliente
3. **Multi-tenant obrigatório** — toda query Firestore filtra por `tenantId`
4. **Tipagem completa** — funções com retorno explícito
5. **Erros tratados** — try/catch com log adequado
6. **Transações** — para operações multi-documento no Firestore
7. **`limit()`** — em todas as queries de listagem

## Regras críticas de produção
- NUNCA alterar schema de coleção existente sem plano de migração
- NUNCA remover campo do Firestore sem verificar todos os consumers
- NUNCA fazer deploy de função de billing sem revisão manual
- Security Rules: testar localmente antes de qualquer mudança
- Índices compostos: criar via console e salvar em `firestore.indexes.json`

## Checklist antes de entregar
- [ ] Autenticação verificada (se rota protegida)
- [ ] `tenantId` filtrado em todas as queries
- [ ] Inputs validados e tipados
- [ ] HTTP status codes corretos (401/403/400/404/500)
- [ ] Sem dados sensíveis na resposta
- [ ] TypeScript sem erros, sem `any`
- [ ] Log de erro com contexto para debug
- [ ] `limit()` em queries de listagem

## Deploy
```bash
npm run deploy:dev   # → erp-softcode (dev)
npm run deploy:prod  # → erp-softcode-prod (produção)
# Sempre compilar antes: cd apps/functions && npm run build
```
