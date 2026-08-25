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
│   onWalletCascadeJob.ts, onUserSignupNotify.ts   # Crons + triggers (exportados em index.ts)
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

### Modulo Fiscal (Nota Fiscal)

- **Provedor unico: Focus NFe.** Cobre NF-e, NFC-e, NFS-e municipal e NFS-e Nacional no
  mesmo cadastro de empresa. Auth = HTTP Basic com o token no usuario e senha em branco.
- **DOIS niveis de token — confundir os dois quebra a integracao:**
  - **Token da conta** (`FOCUS_NFE_MASTER_TOKEN`, em env): gerencia o cadastro de empresas,
    consulta CNPJ e registra webhooks. **Nunca emite.**
  - **Token da empresa**: devolvido por `POST /v2/empresas` como `token_homologacao` /
    `token_producao`. E ele que assina as notas daquele CNPJ. Fica cifrado em KMS em
    `fiscal_settings` (`focusTokenHomologacaoEnc` / `focusTokenProducaoEnc`) e e lido por
    `getIssuingToken(tenantId, env)`. Isso e uma vantagem no multi-tenant: nenhum bug
    consegue emitir sob o CNPJ de outro tenant.
  - Nao existe token de homologacao no nivel da conta — ele nasce junto com a empresa.
- **Nenhum codigo de dominio importa o SDK do provedor.** Tudo passa pela interface
  `FiscalProvider` (`api/services/fiscal/`); os nomes de campo do Focus vivem so em
  `focus-payload.ts` (saida) e `focus-response.ts` (entrada). Motivo: a Nuvem Fiscal foi
  desativada em 31/07/2026 com 90 dias de aviso.
- **`fiscal_settings/{tenantId}`** — colecao propria com `allow read, write: if false`,
  NAO um map em `tenants/{id}`: aquele doc e legivel por qualquer membro do tenant e o
  Firestore nao tem regra por campo. Guarda CNPJ, IE/IM, regime, serie/numeracao e a senha
  do certificado A1 cifrada em KMS (`FISCAL_SECRET_KMS_*`, chave separada da do Calendar).
- **O certificado A1 (.pfx) nunca e persistido** — sobe uma vez para o provedor, que o
  custodia e valida (senha, titularidade do CNPJ, validade), e sai da memoria.
- **Ambiente default e `homologacao`.** Producao e opt-in por tenant e so depois de uma nota
  de teste autorizada — o status `ready` prova o credenciamento na SEFAZ/prefeitura.
- Emissao e **assincrona**: pre-validacao sincrona no provedor, depois fila. `ref` (nossa)
  e query param obrigatorio, o que da idempotencia de graca.
- **Campos fiscais sao opcionais no cadastro e exigidos na emissao.** Ninguem precisa parar
  para classificar o catalogo inteiro antes de usar o ERP; o gate e `fiscal-readiness.ts`,
  que roda na emissao e lista TODAS as lacunas de uma vez (emitente, cliente, itens).
- **CFOP, CST/CSOSN e unidade comercial NAO ficam no produto** — sao derivados na emissao
  (`natureza-operacao.ts`). CFOP e propriedade da *operacao*: a mesma cortina e 5102 dentro
  do estado e 6102 fora. Guardar no produto forcaria correcao manual em toda venda
  interestadual. CST/CSOSN sai do regime do emitente; a unidade sai do `inventoryUnit`.
- **Webhook do Focus NAO tem cabecalho de autenticacao** (diferente do Asaas, que assina com
  `asaas-access-token`). A propria URL e a credencial: `/webhooks/focus/:tenantId/:secret/:type`,
  com o segredo comparado em tempo constante. Segredo invalido responde **200**, nao 401 — e
  falha permanente, e 401 faria o Focus retentar 5 vezes em 24h a toa.
- **O cron `processInvoiceRetries` (15 min) nao e redundancia, e o unico backstop.** O Focus
  retenta a notificacao em 1min, 30min, 1h, 3h e 24h e depois **nunca mais dispara**. Uma queda
  de entrega nessa janela deixaria a nota presa em `processing` para sempre.
- **A nota nasce de um documento de negocio**, nunca de formulario em branco:
  `POST /v1/fiscal/invoices/from-proposal/:id` e `from-transaction/:id`. Uma proposta
  **mista gera DUAS notas** — NF-e da mercadoria e NFS-e da mao de obra —, separadas por
  `ProposalProduct.itemType`. Faltando qualquer dado fiscal, **nenhuma** e enviada: meia
  venda mista faturada e pior que nenhuma.
- **Botoes e gatilhos automaticos chamam as MESMAS funcoes** (`invoice-issue.service.ts`),
  entao nao existe caminho automatico que pule uma validacao do manual.
- **Gatilhos sao opt-in e best-effort.** `tryAutoIssue` so dispara se
  `autoIssueRule` bater E `status === "ready"`, e **nunca lanca**: o pagamento ja foi
  confirmado e a proposta ja foi aprovada — falhar a nota nao pode desfazer a venda.
  Ganchos: `handlePaymentSuccess` (asaas-webhook) e `syncApprovedProposalTransactions`.
- **DANFE e XML sao espelhados no nosso Storage** (`tenants/{id}/fiscal/{invoiceId}/`) assim
  que a nota e autorizada. Nao e conveniencia: guarda legal de **5 anos + ano corrente**
  (Ajuste SINIEF 07/2005), e depender do link do provedor deixaria o acervo do cliente fora
  do nosso controle. Best-effort e idempotente — falhar nao pode desfazer uma nota valida;
  o cron reencontra e tenta de novo.
- **Download passa pelo backend**, nunca por link direto: `storage.rules` nega a pasta
  `fiscal/` ao client e `application/xml` nem esta na allowlist de content-type.
- **Lancamento avulso nao emite** — sem proposta vinculada nao ha itens, e o sistema
  falha com `LANCAMENTO_SEM_PROPOSTA` em vez de inventar uma linha.
- **Status nunca regride** (`canApplyStatus`): webhook nao e ordenado e o cron pode correr junto.
  A unica transicao permitida a partir de terminal e autorizada → cancelada.
- **O unico campo que o usuario realmente digita e o NCM** (por produto) e o codigo LC 116 +
  aliquota ISS (por servico). `POST /v1/fiscal/ncm-suggestions` sugere o NCM via Lia
  (Gemini), reaproveitando cota, rate limiter e gate de plano do modulo de IA. A sugestao
  nunca e aplicada sozinha — a classificacao fiscal e responsabilidade do cliente.

### Modulo Fiscal — Notas de ENTRADA (recepcao)

Complementa a emissao e e **independente** dela. Aqui NAO somos o emitente: nao
controlamos numeracao, nao assinamos e nao cancelamos. Recebemos, arquivamos e
permitimos a manifestacao.

- **Opt-in por tenant** via `habilitaManifestacao` (flag `habilita_manifestacao` no cadastro
  da empresa no Focus). Nasce **desligada** porque **cada nota recebida consome uma unidade
  do pacote mensal** — a regra do Focus e "cada nota emitida OU RECEBIDA conta como uma
  unidade". O campo e enviado sempre, inclusive `false`, para o cadastro nao precisar ser
  refeito quando a recepcao for ligada.
- **Sincronizacao incremental por `versao`.** Cada nota recebida tem um campo `versao`, unico
  por CNPJ e incrementado a cada alteracao (cancelamento, carta de correcao). O cursor fica em
  `received_invoice_cursors/{tenantId}` e **so avanca depois da gravacao** — se o processo
  morrer no meio, o proximo ciclo refaz o lote em vez de pular notas.
- `shouldApplyReceivedVersion` recusa versao igual ou menor: aceitar uma menor sobrescreveria
  um cancelamento com o estado anterior e a nota voltaria a parecer valida.
- **Antes da manifestacao a Receita entrega so um RESUMO.** O XML completo — com itens, NCM e
  impostos — so vem depois da **confirmacao**. Nao e limitacao do provedor: e como o fisco
  desenhou, para o destinatario assumir formalmente a operacao antes de ter o documento.
- **Manifestacao nunca e automatica.** Confirmar e declaracao formal perante a Receita;
  desconhecer uma operacao legitima tem consequencia fiscal. So `nao_realizada` exige
  justificativa (15 a 255 caracteres).
- **A sinergia que justifica o modulo:** o NCM — unico campo da emissao sem default e sem
  derivacao — vem nos itens da nota de entrada. A recepcao alimenta o catalogo fiscal que a
  emissao precisa.
- Cron `syncReceivedInvoices` roda **de hora em hora**, nao a cada 15 min como o de emissao:
  nota de entrada nao tem urgencia de segundos, o destinatario tem dias para se manifestar.

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

### Resumos de grupo (`transaction_groups`)

O mesmo trigger `onTransactionTotals` mantém: (a) o campo booleano `grouped`
em cada doc de `transactions` (true se pertence a grupo — habilita a query de
avulsos `where("grouped","==",false)`, já que Firestore não consulta campo
ausente); (b) 1 doc-resumo por grupo em `transaction_groups/{groupDocId}`
(`groupDocId` = groupKey com `:` → `_`, ex: `proposal_p1`, `group_g1`).

- Chave espelha `getGroupedTransactionKey` do frontend: `proposalGroupId` >
  `installmentGroupId`/`recurringGroupId` > avulso (sem doc).
- Cálculo puro em `src/lib/transaction-group-summary.ts`
  (`computeGroupSummary` — usa `computeTransactionTotals` por membro; nunca
  duplicar a semântica de extraCosts).
- Recompute total do grupo a cada write relevante de membro (não increments);
  writes que só tocam campos irrelevantes ao resumo (ou o echo do próprio
  trigger) não geram queries.
- Grupos legados mistos (parte com `proposalGroupId`, parte só
  `installmentGroupId`): promovidos à chave proposal; o doc `group_` é
  deletado.
- Write em `transaction_groups` só via Admin SDK (rules negam client write);
  client lê direto (aba Agrupados).
- Backfill histórico: `npx tsx src/scripts/backfill-transaction-groups.ts`
  (idempotente).

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

- **Cloud Monitoring alerts** — as policies vivem SÓ no GCP (o script
  `scripts/setup-gcp-monitoring.sh` citado antes não existe mais no repo; editar via
  console ou `gcloud monitoring policies update`). Existem em ambos os projetos:
  uptime check no `/api/health`, indisponibilidade (CRITICAL), erros 5xx (ERROR),
  latência p95 (WARNING), pico de instâncias (WARNING).
  - **Latência p95**: filtra APENAS o serviço `api` (`resource.labels.service_name = "api"`),
    threshold 8s, duration 300s. Não remover o filtro de serviço: os crons são serviços
    Cloud Run próprios cuja "latência" = duração do job (checkduedates ~20s diários),
    o que disparava alerta falso-positivo todo dia (corrigido 2026-07-06).
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
