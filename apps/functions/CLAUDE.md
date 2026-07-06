# CLAUDE.md — apps/functions/ (Firebase Cloud Functions)

## Contexto
Backend em produção com clientes ativos. Express monolith registrado como uma única Cloud Function V2
rodando no Cloud Run em `southamerica-east1`. Mudanças aqui afetam TODOS os tenants imediatamente após deploy.

## Stack
- Node.js 22
- Firebase Functions V2
- Express (monolith)
- TypeScript → compila para CommonJS em `apps/functions/lib/`
- Firebase Admin SDK

## Estrutura
```
apps/functions/src/
├── index.ts              # Entry point — registra a Cloud Function + todos os crons
├── api/
│   ├── controllers/      # 36 controllers (CRUD + webhooks)
│   ├── routes/           # 24 grupos de rotas
│   ├── middleware/        # Auth verification, rate limiting
│   ├── helpers/           # Helpers de rotas
│   ├── services/          # Lógica de negócio server-side (PDF, transações, etc.)
│   └── security/          # CORS policy, URL/SSRF security
├── ai/                   # Módulo IA Lia (Gemini, Groq, rate limiters, tools)
├── billing/              # Fila de billing + reconciliação de price drift
├── stripe/               # Config do Stripe + stripeWebhook
├── services/             # Email (Resend), Zoom (create-meeting), WhatsApp billing
├── lib/                  # Helpers de negócio (auth, finance, storage, observability, MFA)
├── shared/               # Tipos compartilhados com controllers
├── scripts/              # Scripts de manutenção one-time
├── utils/                # Utilitários gerais
├── checkDueDates.ts, checkManualSubscriptions.ts, markOverdueTransactions.ts,
│   checkStripeSubscriptions.ts, reportWhatsappOverage.ts, applyScheduledPlanChanges.ts,
│   checkPriceChanges.ts, cleanupStorageAndSharedLinks.ts, reconcileAddons.ts,
│   processPayoutRetries.ts, cleanupSecurityAuditEvents.ts, checkInactiveSignups.ts,
│   onWalletCascadeJob.ts            # Crons + triggers (exportados em index.ts)
└── deploymentConfig.ts   # Configuração de deploy (região, memória, timeout, SCHEDULE_OPTIONS)
```

## Projetos Firebase
- `erp-softcode` → dev (`.env.erp-softcode`)
- `erp-softcode-prod` → produção (`.env.erp-softcode-prod`)

## Comandos
```bash
# Build
cd apps/functions && npm run build        # Compila TypeScript → apps/functions/lib/
cd apps/functions && npm run build:watch  # Watch mode para dev

# Dev local
npm run dev:backend  # (na raiz) build:watch + emuladores Firebase

# Deploy
npm run deploy:dev   # (na raiz) → erp-softcode
npm run deploy:prod  # (na raiz) → erp-softcode-prod

# Lint
cd apps/functions && npm run lint
```

## Regras críticas

### Autenticação
- TODA rota protegida valida token Firebase no início via middleware
- Custom claims verificados: `tenantId`, `role`, `masterId`
- Stale claims fallback: middleware cai para user document se claims desatualizados

### Multi-tenancy
- TODA query Firestore filtra por `tenantId`
- IDs validados contra `tenantId` do token (não apenas do body)
- Nunca retornar dados de um tenant para outro

### Billing e Stripe
- Webhook valida assinatura com `stripe.webhooks.constructEvent`
- Deploy em produção de qualquer mudança de billing: revisão manual obrigatória
- Scheduled functions de billing: testar no emulador antes de prod

### Firestore
- Transações para operações multi-documento
- `limit()` em TODA query de listagem
- Novos índices: criar no console Firebase e exportar para `firestore.indexes.json`
- Mudanças de schema: plano de migração antes de qualquer deploy

### Error Observability (collections)
- `error_issues/{fingerprint}` — grouped, deduplicated error issues (Admin SDK writes only; MFA superadmin client reads via dashboard).
- `error_issues/{fingerprint}/occurrences/{id}` — capped sample of recent occurrences; `expiresAt` field for Firestore TTL.
- `error_issues/{fingerprint}/_agg/affected` — capped hashed-id sets backing `affectedUsers`/`affectedTenants`.
- `error_metrics/{YYYYMMDDhh}` — hourly severity/source counters.

**Deploy note:** enable a Firestore **TTL policy** on the `occurrences` collection group, field `expiresAt` (Firebase console → Firestore → TTL). Not expressible in `firestore.indexes.json`.

### Secrets
- Ficam APENAS em `apps/functions/.env.erp-softcode` e `apps/functions/.env.erp-softcode-prod`
- Nunca commitar — arquivos ignorados pelo `.gitignore`
- Usar `apps/functions/.env.example` como referência (sem valores reais)

### Logging
- **Em código novo**: usar `logger` de `../lib/logger` ou `../../lib/logger`
  ```typescript
  import { logger } from "../lib/logger";
  logger.info("Proposta criada", { tenantId, proposalId, uid });
  logger.error("Falha ao enviar WhatsApp", { tenantId, error: err.message });
  ```
- O logger emite JSON com campo `severity` reconhecido pelo GCP Cloud Logging, permitindo filtrar por severity no console.
- Em código existente que usa `console.log/error`, não é necessário migrar — o GCP ainda captura esses logs.
- NUNCA logar tokens, senhas, `FIREBASE_PRIVATE_KEY` ou dados pessoais (CPF, email completo, telefone).
- Erros não tratados em rotas Express são capturados automaticamente pelo global error handler em `api/index.ts` (loga estruturado + alimenta o pipeline de error observability — issues agrupadas no Firestore). Não há Sentry no projeto.

## Módulo Financeiro: Lançamentos & Carteiras (backend)

### Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/api/services/transaction.service.ts` | TODA lógica de negócio de lançamentos (~1800 linhas) |
| `src/api/services/transaction-summary.service.ts` | Summary financeiro via aggregation queries (`GET /v1/transactions/summary`) |
| `src/lib/transaction-totals.ts` | `computeTransactionTotals()` — semântica dos campos desnormalizados `paidTotal`/`pendingTotal` |
| `src/onTransactionTotals.ts` | Trigger que mantém `paidTotal`/`pendingTotal` em todo write de transactions |
| `src/api/controllers/wallets.controller.ts` | CRUD de carteiras |
| `src/lib/finance-helpers.ts` | `resolveWalletRef()`, `addMonths()`, permissões |

### Summary financeiro agregado (paidTotal/pendingTotal)

Cada doc de `transactions` carrega `paidTotal` e `pendingTotal` desnormalizados
(pai entra pelo status do pai; cada extraCost pelo PRÓPRIO status, default
"pending"; overdue conta como pendente). Mantidos pelo trigger
`onTransactionTotals` em qualquer write — **nenhum writer precisa preencher os
campos manualmente**. O endpoint `GET /v1/transactions/summary` soma via
aggregation (2 queries, 1 leitura/1000 docs) — substitui o cálculo no browser
que baixava a coleção inteira. Docs pré-trigger: rodar
`npx tsx src/scripts/backfill-transaction-totals.ts` (idempotente). Índices:
`(tenantId, type, paidTotal)` e `(tenantId, type, pendingTotal)` em
`firestore.indexes.json`.

### Arquitetura de Carteiras (CRÍTICO)

**Saldos são DESNORMALIZADOS** no documento Firestore da carteira (campo `balance`). Não são calculados on-the-fly. Toda operação que afeta saldo usa `FieldValue.increment()` dentro de uma Firestore Transaction atômica.

**Campo `wallet` nas transações** = string que pode ser wallet NAME (dados antigos) ou wallet ID (dados novos após migração de abril/2025). O backend resolve ambos via `resolveWalletRef()` em `finance-helpers.ts` — tenta ID primeiro, depois NAME.

**`resolveWalletRef()`** nunca deve retornar null silenciosamente quando há ajuste de saldo — se retornar null, deve lançar erro (comportamento implementado em abril/2025).

Nomes de carteiras são únicos por tenant (validado no create e update de wallet).

### Lógica de Saldo: getWalletImpacts()

```typescript
// Regra: SÓ afeta saldo se status === "paid" E wallet está definido
if (data.status === "paid" && data.wallet) {
  impact = type === "income" ? +amount : -amount
}
// extraCosts seguem o mesmo sinal do pai
```

Ao atualizar: calcula `oldImpacts` (estado atual no DB) e `newImpacts` (novo estado), aplica o delta. Tudo dentro de `db.runTransaction()`.

### syncExtraCostsStatus()

Quando o status do pai muda, custos extras **alinhados** com o status antigo do pai são sincronizados. Custos extras com status independente (diferente do pai) são preservados.

### Proposta → Transação

`syncApprovedProposalTransactions()` em `proposals.controller.ts` cria transações com `proposalId` + `proposalGroupId` + `installmentGroupId`. Wallet resolvida de `proposal.installmentsWallet` ou `proposal.downPaymentWallet` (fallback: carteira padrão do tenant).

Quando a transação muda de carteira, o campo correspondente na proposta é atualizado de volta (`installmentsWallet` ou `downPaymentWallet`).

**Guard crítico:** transações pagas vinculadas a propostas aprovadas NÃO podem ser revertidas para pendente. Para reverter: primeiro reverter a proposta para rascunho.

### Infraestrutura / GCP

- **Cloud Monitoring alerts** — configurar com o script:
  ```bash
  bash scripts/setup-gcp-monitoring.sh erp-softcode-prod ops@empresa.com
  bash scripts/setup-gcp-monitoring.sh erp-softcode dev@empresa.com
  ```
  Cria: uptime check no `/api/health`, alerta de indisponibilidade (CRITICAL), erros 5xx (ERROR), latência p95 > 8s (WARNING), pico de instâncias (WARNING).
- **GCP Cloud Logging** — filtrar por `severity=ERROR` ou pelo campo `tenantId` nos logs estruturados.

---

## Checklist antes de deploy para prod
- [ ] Testado localmente com `npm run dev:backend`
- [ ] `cd apps/functions && npm run build` sem erros
- [ ] Se mudou billing/Stripe: revisão manual feita
- [ ] Se mudou schema Firestore: migração planejada e testada
- [ ] Se mudou Security Rules: testadas com Firebase Emulator
- [ ] Deploy para dev primeiro: `npm run deploy:dev`
- [ ] Validar comportamento no ambiente dev antes de prod
