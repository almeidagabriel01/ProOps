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
├── index.ts              # Entry point — registra a Cloud Function principal
├── init.ts               # Inicialização do Firebase Admin
├── api/
│   ├── controllers/      # ~20 controllers CRUD
│   ├── routes/           # 13 grupos de rotas
│   ├── middleware/        # Auth verification, rate limiting
│   ├── helpers/           # Helpers de rotas
│   └── security/          # Security observability
├── lib/                  # Helpers de negócio (auth, billing, storage, etc.)
├── services/             # PDF (Playwright), WhatsApp, proposals, notifications
├── shared/               # Tipos compartilhados com controllers
├── scripts/              # Scripts de manutenção one-time
├── checkDueDates.ts      # Cron: verifica vencimentos
├── checkManualSubscriptions.ts  # Cron: assinaturas manuais
├── checkStripeSubscriptions.ts  # Cron: status Stripe
├── cleanupStorageAndSharedLinks.ts  # Cron: limpeza de storage
├── reportWhatsappOverage.ts     # Cron: billing WhatsApp (dia 1, 03:00 AM)
└── deploymentConfig.ts   # Configuração de deploy (região, memória, timeout)
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
- Erros não tratados em rotas Express são capturados automaticamente pelo global error handler em `api/index.ts` (reporta ao Sentry + loga estruturado).

## Módulo Financeiro: Lançamentos & Carteiras (backend)

### Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/api/services/transaction.service.ts` | TODA lógica de negócio de lançamentos (~1350 linhas) |
| `src/api/controllers/wallets.controller.ts` | CRUD de carteiras |
| `src/lib/finance-helpers.ts` | `resolveWalletRef()`, `addMonths()`, permissões |

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
