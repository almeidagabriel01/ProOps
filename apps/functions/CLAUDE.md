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
│   ├── controllers/      # Controllers, um por domínio (CRUD + webhooks)
│   ├── routes/           # Rotas, montadas em api/index.ts
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
├── <cron>.ts / on<Trigger>.ts   # Crons e triggers (lazyExport em index.ts); lista em src/CLAUDE.md
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

# Testes
npm run test:functions              # (na raiz) unitário — não precisa de infra
npm run test:functions:integration  # (na raiz) integração — sobe o emulador sozinho
```

> **Unitário vs integração.** `jest.config.js` ignora `*.integration.test.ts`
> (`testPathIgnorePatterns`); `jest.integration.config.js` roda só eles, em
> série, via `firebase emulators:exec`. Teste que toque o `db` real de
> `src/init.ts` precisa do sufixo `.integration.test.ts`, senão volta a
> quebrar a suíte unitária de quem não tem emulador ligado.
>
> O emulador usa a porta **8080** (`firebase.json`, e os testes de rules a
> fixam). Se ela estiver ocupada por outro projeto, o comando falha com
> "port taken" — libere a porta antes de rodar.

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
- `ai_traces/{id}` — um doc por turno da Lia (`src/ai/trace.ts`): provider, modelo,
  status, tokens, latência e a lista de ferramentas (`{name, ok, ms}`). O
  `usage-tracker` só conta mensagem e token — isto é o que responde "o que a Lia
  fez e o que falhou". **Grava nome de ferramenta, nunca args**; da mensagem e da
  resposta só o tamanho. Args carregam nome de cliente, valor e CPF — o teste
  `src/ai/trace.test.ts` falha se algum desses campos entrar no doc.

**Estado das TTL policies (verificado 2026-08-27 via `gcloud firestore fields ttls list`):**

| Collection group | dev | prod |
|---|---|---|
| `ai_traces` | ✅ habilitada | ✅ habilitada |
| `occurrences` | ❌ não habilitada (e habilitar não resolveria) | ❌ idem |

**A nota de deploy antiga do pipeline de erros está incorreta: habilitar a TTL
em `occurrences` seria um no-op.** A TTL do Firestore só age em campo do tipo
`Timestamp`, e `writeOccurrence` grava `expiresAt` como **string ISO**
(`new Date(...).toISOString()`). Verificado no dado de produção em 2026-08-27:
o campo chega como `stringValue`. A policy ficaria ativa e nunca casaria com
documento nenhum.

Para a TTL funcionar ali, `writeOccurrence` teria que gravar
`Timestamp.fromMillis(...)` (é o que `ai/trace.ts` faz — por isso a TTL de
`ai_traces` funciona), e os docs antigos precisariam de backfill ou seriam
deixados para o cap. **Só que não vale a pena hoje:** `occurrences` tem 36
documentos em produção, e `writeOccurrence` já faz trim por
`OCCURRENCE_SAMPLE_CAP = 50` por fingerprint — o crescimento é limitado por
construção, não ilimitado.

Alternativa, se um dia importar: cron varrendo `expiresAt <= nowIso`, que
funciona com string — é exatamente o que `cleanupSecurityAuditEvents.ts` faz.

`--async` no comando de TTL importa: sem ele o gcloud bloqueia esperando a
operação e estoura timeout. Confirme com `ttls list` (passa por `CREATING`
antes de `ACTIVE`). Não é expressável em `firestore.indexes.json`.

### Trabalho assíncrono depois da resposta (Cloud Run)

**Nunca dispare-e-esqueça um write que precisa acontecer.** O Cloud Run só
aloca CPU enquanto a request está sendo processada — os serviços aqui não têm
`cpu-throttling=false`. Promise ainda pendente quando o handler retorna =
instância congelada e trabalho perdido **em silêncio**: nem o `.catch()` roda,
então não há log de erro para investigar.

```typescript
// ERRADO — perde o write, sem deixar rastro
minhaEscrita().catch((e) => logger.warn("falhou", e));

// CERTO — a resposta já foi enviada, então não há latência percebida;
// o await só mantém a instância viva até a escrita terminar
try { await minhaEscrita(); } catch (e) { logger.warn("falhou", e); }
```

Descoberto em 2026-08-27 com o `ai_traces`: a Lia respondia normalmente e
nenhum trace era gravado, sem erro nenhum no log. O mesmo padrão estava no
refund de `refundAiMessage` em `ai/chat.route.ts` (perder aquele write cobra do
tenant uma mensagem que falhou) — os dois foram corrigidos juntos. Guard de
regressão: `src/ai/trace.test.ts`, "finish só resolve depois que a escrita
termina".

O sintoma engana porque em produção **às vezes funciona**: com concurrency 80 e
outras requests em voo, a CPU segue alocada e a escrita completa. Em dev
(`maxInstances: 1`, sem tráfego) falha de forma consistente.

### Modulo Fiscal

Ver `src/api/services/fiscal/CLAUDE.md` (Focus NFe, NFS-e nacional x municipal, ambiente, CC-e, recepcao de notas de entrada).

### Integracao com o Google Drive

Ver `src/api/services/drive/CLAUDE.md` (OAuth `drive.file`, pasta do cliente, fila `drive_delivery_jobs`, `invalid_grant`).

### Contas vinculadas (`GET /v1/linked-accounts`)

Resumo, numa chamada só, de toda conta externa ligada à empresa (Google
Agenda, Google Drive, Asaas, Focus NFe) e do WhatsApp do próprio usuário.
Alimenta `/settings/linked-accounts`. Lógica em
`api/services/linked-accounts.service.ts`.

- **Lê os documentos direto**, e não pelos endpoints de status de cada
  integração: aqueles estão atrás do próprio `requirePlanCapability` (402
  quando o plano não inclui), o fiscal é só do master, e a Agenda não marca
  `invalid_grant` em campo nenhum. A rota **não tem gate de plano**: cada item
  informa `plan.availableInPlan`, e um gate fecharia a tela inteira por causa
  de uma integração.
- **Vocabulário único de estado:** `connected | attention | needs_reconnect |
  disconnected | not_in_plan | platform_unavailable`, mais um `notice` neutro
  para etapa em andamento que não é problema (fiscal `registered`, aguardando a
  primeira nota autorizada). `needs_reconnect` é o
  caso em que tentar de novo nunca resolve (token revogado, escopo antigo,
  certificado A1 vencido).
- **Nada sensível sai na resposta**: e-mail, CNPJ, telefone mascarado (4
  últimos dígitos) e estado. O teste afirma que token, `apiKey`, segredo de
  webhook e senha de certificado não aparecem no JSON.
- Fora de `DEMO_READABLE_PREFIXES` de propósito: a conta free leva 402.
- **Integração nova com conta externa entra no serviço também**, senão ela
  fica fora da tela e a pessoa só descobre que a conexão caiu ao precisar dela.

Guards: `api/services/__tests__/linked-accounts.service.test.ts` e
`api/routes/linked-accounts.routes.test.ts`.

### PDF em desenvolvimento (fora do Linux)

Duas barreiras faziam a geracao de PDF — e portanto a entrega no Drive —
falhar SEMPRE numa maquina Windows ou macOS, o que so era visivel quando o
front local apontava para o backend local:

1. **`@sparticuz/chromium` empacota um binario LINUX.** Fora do Linux o
   `executablePath()` aponta para um arquivo inexistente e o launch morre com
   `spawn ...\Temp\chromium ENOENT`. `useServerlessChromium()`
   (`api/services/core-pdf.service.ts`) decide pela plataforma; fora do Linux o
   render usa o Chromium do proprio Playwright. Exige, uma vez:
   ```bash
   cd apps/functions && node node_modules/playwright-core/cli.js install chromium
   ```
   Tem que ser o CLI do `playwright-core` DE LA: `npx playwright install`
   resolve o `@playwright/test` da raiz, que instala outra revisao.
   Guard: `api/services/core-pdf.chromium-platform.test.ts`.
2. **A guarda de SSRF barrava `localhost`**, que em dev e o proprio app. Agora
   loopback e liberado SO quando `FUNCTIONS_EMULATOR === "true"` — variavel que
   o emulador poe e o Cloud Run nunca tem. Faixas RFC-1918 e metadados de cloud
   seguem bloqueados inclusive no emulador: ali o risco nao e a propria
   maquina, e sim credencial de instancia.
   Guard: `api/services/core-pdf.ssrf.test.ts`.

### Plano do tenant: DUAS fontes que podem divergir

O backend resolve o plano por **`tenants/{id}.plan`** (depois `.planTier`, `.tier`,
`.planId`, priceId, dono) em `tenant-plan-policy.ts`. O frontend resolve por
**`users/{uid}.planId`** (`plan-provider.tsx`). **Sao documentos diferentes.**

Os dois passam a ser escritos juntos pelo writer unico
(`syncTenantPlanBillingSnapshot`) desde **2026-05-07 22:51 BRT** (commit `bbfd638d`).
Toda troca de plano ANTERIOR atualizou so o doc do usuario — o do tenant ficou para
tras.

A divergencia foi **inofensiva por meses**, porque ninguem lia `tenants.plan` para
decidir acesso a modulo. Deixou de ser quando `requirePlanCapability` entrou em
`enforce`: o tenant de dev tinha `users.planId = "enterprise"` e
`tenants.plan = "pro"`, entao a tela mostrava Enterprise (com "Notas Fiscais"
listado no plano) e a API devolvia 402 — sem nada, em lugar nenhum, revelando a
contradicao.

- O 402 devolve **`currentPlan`** (o tier que o BACKEND resolveu) alem do
  `requiredPlan`. Sem ele, "plano insuficiente" e "dado desatualizado" produzem a
  mesma resposta, e as duas exigem acoes opostas.
- `npx tsx src/scripts/audit-tenant-plan-drift.ts` lista as divergencias;
  `--apply` corrige adotando o doc do USUARIO como correto. **Conferir a lista
  antes de aplicar**: se algum tenant foi rebaixado de proposito e so o doc do
  tenant foi atualizado, aplicar o promoveria de volta.
- **Nao "consertar" o resolvedor para preferir o tier mais alto.** Isso liberaria
  modulo para quem foi rebaixado. Se um dia unificar, a decisao e sobre QUAL
  documento e autoritativo — e tem implicacao de cobranca nos dois sentidos.

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
- **Coalescência e ordem** (2026-09-25): cada recálculo grava em
  `transaction_group_sync/{groupDocId}` o `readTime` da consulta de membros em
  que se baseou (o MENOR, quando há mais de uma consulta). O evento pula o
  recálculo se esse `readTime` já é posterior à própria escrita (o resumo já a
  contém), e a gravação do resumo é condicional numa transação sobre o doc de
  controle: recálculo de leitura mais velha nunca sobrescreve um mais novo.
  Antes, uma série de N parcelas custava N recálculos de N membros (N²
  leituras) e o último a gravar vencia, mesmo com dado velho. Comparação em
  nanossegundo (`compareTimestamps`): em milissegundo, leitura e escrita no
  mesmo milissegundo se confundiriam.
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

### Numeração da proposta

Dá a cada proposta um código sequencial no formato `0018926SP`: cinco dígitos,
dois do ano e a praça. Nasceu do mesmo cliente da comissão, que já mantém um
acervo em `0018526SP_casa_do_mauricio` e queria saber quantas propostas saem
por ano e por cidade.

- **Nasce DESLIGADA, e é configuração por empresa.** Dígitos, reinício anual e a
  lista de praças ficam em `proposal_counters/{tenantId}` (`allow read, write:
  if false`, Admin SDK only), editáveis em `/settings/proposals` pelo master.
  O formato de um cliente não pode virar regra do produto: quem não liga não
  ganha campo nenhum na proposta nem no nome do arquivo. **Sem gate de plano** —
  numerar documento não é módulo premium.
- **Coleção própria, não um map em `tenants/{id}`.** Aquele doc é lido por
  qualquer membro e está no caminho de autenticação; uma escrita quente a cada
  proposta criada não tem o que fazer ali.
- **O número é alocado DENTRO da transação de criação da proposta**
  (`allocateProposalNumberInTransaction`), com a leitura do contador no bloco
  `=== ALL READS FIRST ===`. Duas criações simultâneas não podem receber o mesmo
  código, e é a transação do Firestore que garante isso.
- **O número é QUEIMADO.** Apagar a proposta não o devolve para a fila, e
  renumerar as seguintes mudaria o identificador de um documento que o cliente
  já recebeu. Buraco na sequência é melhor que código repetido.
- **`nextNumber` é editável de propósito** (quem já numerava fora do ERP
  continua de onde parou) e por isso `saveNumberingConfig` **mescla sobre o
  gravado, dentro de uma transação**: um payload parcial cairia no default
  `nextNumber: 1` e rebobinaria a sequência, fazendo a próxima proposta nascer
  com um código já entregue.
- **O código NÃO inclui o título.** `proposalCode` guarda só `0018926SP`; o nome
  do arquivo é derivado na hora por `buildProposalFileName`, que devolve
  `0018926SP_casa_do_mauricio.pdf`. Guardar o título dentro do código faria uma
  correção de digitação trocar o identificador de uma proposta já enviada.
- **Os campos ficam FORA da allowlist de `updateProposal`.** São escritos só na
  criação; um PUT do cliente não renumera proposta nenhuma.
- **A praça pedida só vale se estiver na lista da empresa**, senão cai na
  padrão. Sigla livre produziria um código que a própria empresa não reconhece.
- **A mesma configuração guarda a validade padrão da proposta**
  (`defaultValidityDays`, 1 a 365, padrão 30). O formulário preenche "Válida
  até" com hoje + esse número na proposta nova, e ela vale mesmo com a
  numeração desligada. Pegou carona neste doc porque o GET já é lido pelo
  formulário e escrito pelo master na mesma tela. A tela só envia o campo
  quando o GET o devolveu: o schema é `.strict()`, e um front publicado antes
  do backend quebraria o salvamento da numeração com 400.
- `GET /v1/proposals/numbering` é liberado a quem enxerga propostas (o
  formulário precisa da lista de praças); `PUT` é só do master. As duas são
  montadas **antes** de `/proposals/:id` em `core.routes.ts` — o Express casa
  por ordem, e `PUT /proposals/numbering` cairia no update com id "numbering".
- **Não aparece no PDF.** O que o cliente descreveu é uma convenção de NOME DE
  ARQUIVO; a capa do PDF é uma superfície com elementos posicionáveis e temas
  próprios, e levar o código para lá é decisão à parte.

Guards: `proposal-numbering.test.ts`, `proposal-numbering.service.test.ts`,
`core.routes.numbering.test.ts`, `tests/firestore-rules/proposal-counters.test.ts`
e `apps/web/src/__tests__/proposal-code-preview.test.ts` (a tela tem uma cópia da
montagem do código para a prévia, e uma divergência prometeria um código
diferente do que a proposta receberia).

### Link de agendamento (`api/services/booking/`)

O cliente escolhe um horário livre no expediente da empresa e PEDE a visita; a
empresa confirma ou recusa. Pro e Enterprise (`bookingLink`).

- **"A confirmar" é um status da Agenda** (`pending` em `calendar_events`). O
  pedido já cria o evento: o horário fica ocupado (ninguém mais pede o mesmo),
  aparece na Agenda com selo próprio e **não vai para o Google Agenda**
  (`syncEventToGoogle` devolve cedo em `pending`). Confirmar vira `scheduled` e
  sincroniza; recusar apaga o evento e libera o horário.
- **Horário livre** = expediente (dias, início e fim, antecedência mínima,
  horizonte) menos os compromissos da Agenda (`computeAvailableSlots`, puro, em
  passos do tamanho da visita: a de 1h vai de hora em hora; sempre em horário de Brasília). Antes de calcular, o link
  puxa as mudanças do Google Agenda (`syncGoogleEventsToLocalCalendar`, com o
  limite de frequência dela), então compromisso marcado só no Google também
  ocupa. A consulta é por `startMs` e olha um dia antes: evento que começou
  antes e continua ocupa.
- **Exceções** (`exceptions` em `booking_settings`): dias inteiros ou faixas de
  um dia em que a empresa não atende. Entram no cálculo como compromisso
  (`busyFromExceptions`), em horário de Brasília. `normalizeExceptions` descarta
  as que já passaram, ordena e dá id estável. O motivo (`note`) é só da empresa:
  a visão pública devolve os horários, nunca as exceções. O campo é opcional no
  PUT (schema estrito), e a tela só o manda quando o GET o devolveu, para um
  front novo não quebrar contra um backend antigo.
- **O pedido roda numa transação travada pelo dia** (`booking_locks`) que
  reconsulta a Agenda: dois clientes no mesmo horário não viram duas visitas.
- **Rota pública** em `/v1/public/booking/:token`, montada ANTES do
  `/v1/public` do formulário de contato (que limitaria abrir o link a 5/min). O
  POST leva `contactFormLimiter` e `verifyTurnstileToken`, e um campo escondido
  (`website`) derruba robô com um "ok" falso. Link desligado, sem plano ou token
  inexistente dão o mesmo 404.
- **O cliente recebe e-mail** na confirmação e na recusa (com o recado e o link
  para escolher outro horário), no template `booking-client.ts`. É o primeiro
  e-mail da plataforma para alguém de fora: o remetente continua sendo a ProOps,
  e o texto diz de qual empresa ele é.
- A empresa é avisada pela central (`booking_requested`, para quem vê a Agenda,
  e-mail ligado por padrão).
- **A página do cliente é `/share/visita/{token}`** no front, sob `/share` para
  herdar o tratamento de página pública. O e-mail de recusa monta esse caminho;
  mudar um lado sem o outro quebra o "escolher outro horário" (guard
  `apps/web/src/__tests__/booking-link-path.test.ts`).
- O tipo de visita padrão muda por nicho (`defaultVisitType` em
  `NICHE_REGISTRY`, `shared/niches.ts`: Medição em persianas, Vistoria técnica
  em segurança, Visita técnica em automação). O front espelha no registro dele
  (`apps/web/src/lib/niches/registry.ts`), só para a demonstração, com paridade
  em `apps/web/src/__tests__/niche-registry-parity.test.ts`.

O evento guarda `bookingRequestId`, e desde 2026-09-27 ele sobrevive a uma
edição na Agenda: a edição regrava o documento sem merge, e os vínculos com
outras telas (este e o da obra, `projectId`) passam por `pickEventLinks`.

Guards: `booking-model.test.ts`, `booking.controller.test.ts`,
`booking.routes.gates.test.ts` e `tests/firestore-rules/booking.test.ts`.

### DRE e categorias de lançamento (`api/services/finance-reports/`)

O DRE sai dos lançamentos, agrupados pela categoria, e cada categoria pertence
a um grupo do DRE escolhido pela empresa. Rotas sob `/v1/transactions` (gate
`financial`, leitura do demo), com a permissão de Lançamentos: ver para ler,
criar para cadastrar categoria, editar para renomear ou mudar o grupo, excluir
para tirar da lista.

- **Grupos** (`DRE_GROUPS`): receita em Receita bruta ou Outras receitas;
  despesa em Impostos e deduções, Custos, Despesas operacionais ou Outras
  despesas. Subtotais: receita líquida, lucro bruto, resultado operacional e
  resultado do período.
- **A lista é um doc por empresa** (`transaction_categories/{tenantId}`, Admin
  SDK only), semeado na primeira leitura com as categorias que os lançamentos
  já usavam (as 5.000 mais recentes, grupo sugerido pelo nome) e as padrão que
  faltarem. `create` e não `set`, para duas abas não semearem duas vezes.
- **O lançamento continua guardando o NOME** da categoria (`category`), e o DRE
  casa pelo nome normalizado (sem acento, caixa ou espaço sobrando). Renomear
  leva o nome novo aos lançamentos do mesmo tipo, em lotes de 400. Nome que não
  está na lista (texto antigo, a "Comissao" automática, categoria excluída) vai
  para o grupo padrão do tipo: receita em Receita bruta, despesa em Despesas
  operacionais. Vazio vira "Sem categoria".
- **Receita de proposta nasce em "Propostas"** (`PROPOSAL_INCOME_CATEGORY`,
  gravada por `buildApprovedProposalTransactionDrafts` e pela entrada criada
  na edição). As que nasceram antes, sem categoria, contam como "Propostas" no
  DRE sem regravar nada (receita com `proposalId`, fora a comissão). A
  sincronização da proposta aprovada **não apaga mais a categoria escolhida à
  mão** numa receita (`syncedTransactionCategory`); a da comissão segue sempre
  "Comissao". Toda lista ganha "Propostas" na primeira leitura
  (`withProposalCategory`), para a empresa poder mudar o grupo dela.
- O grupo sugerido na lista inicial casa sigla de imposto (ISS, DAS, ICMS...)
  só como palavra inteira: "Comissao" contém "iss" e caía em impostos.
- **Caixa (padrão) e competência.** Competência usa a `date` do lançamento,
  pago ou não, com todo custo extra. Caixa usa o `paidAt`, mas **o lançamento
  que já nasce pago não tem `paidAt`** (ele só é gravado quando o status MUDA
  para pago), então a data de caixa é o `paidAt` ou, sem ele, a `date`. Por
  isso o caixa faz duas consultas, por `date` e por `paidAt`, ambas com índice
  que já existia, e junta pelo id. Custo extra herda tipo e categoria e, no
  caixa, conta só se pago, na data de caixa do lançamento.
- **Até 12 meses por consulta**, 10.000 lançamentos por consulta (`truncated`
  avisa se bater no teto). Horário de Brasília (UTC-3) na virada do mês.
- **A conta free lê o DRE e as categorias do tenant de demonstração do nicho
  dela** (`demoTenantIdForNiche`, em `shared/demo-tenant.ts`): as chamadas da API usam o tenant da própria conta,
  que está vazio, e os dados de exemplo já são legíveis por ela pelas rules.
  Escrever continua bloqueado.

Guards: `dre-model.test.ts`, `transaction-categories.test.ts`,
`finance-reports.controller.test.ts` e
`tests/firestore-rules/transaction-categories.test.ts`.

### Link do contador (`api/services/accountant/`)

Leitura sem login do financeiro da empresa, para o contador: DRE (caixa e
competência), lançamentos do período, notas emitidas e notas de entrada, com
o contador escolhendo os meses (até 12 por vez). Um link por empresa, em
`accountant_links/{tenantId}` (Admin SDK only), gerado, trocado e desligado
**só pelo dono e pelos administradores** em `/v1/transactions/accountant-link`
(gate `financial`). Não conta no limite de usuários.

- **Rotas públicas em `/v1/share/accountant/:token`**, montadas antes dos
  `app.use("/v1", ...)` como o portal do cliente, e sempre `no-store`. Token
  inexistente ou empresa sem o financeiro dão 404. Notas emitidas só com
  `fiscal`, notas de entrada só com `fiscalReceiving`.
- **O arquivo da nota** sai por `.../documents/:source/:id?kind=pdf|xml`:
  primeiro a cópia do nosso Storage (a de entrada só existe lá), senão
  redireciona para o endereço do provedor. O tipo vai na **query** porque o
  proxy do Next manda todo caminho terminado em `/pdf` para a função de PDF.
  Confere que a nota é da empresa do link e que está autorizada ou cancelada.
- Os lançamentos são os que têm a data OU o pagamento no período (a união do
  DRE em caixa). Sai o nome da carteira, nunca o id; nada de caminho de
  Storage na resposta.

Guards: `accountant-model.test.ts`, `accountant.service.test.ts` (a fronteira
do token), `accountant.controller.test.ts` e
`tests/firestore-rules/accountant-links.test.ts`.

### Importação por planilha (`api/services/import/`)

`POST /v1/clients/import`, `/v1/products/import` e `/v1/services/import`
(`import.controller.ts`), com até 500 linhas por chamada, já com as colunas
ligadas aos campos pela tela. Mesma permissão de criar do cadastro manual
(`clients` | `products` | `services`, `canCreate`) e mesmos tetos de plano
(`maxClients`; `maxProducts` soma produtos e serviços), conferidos para o
lote inteiro com `incrementBy`.

- **`dryRun`** só valida e marca repetido, para a prévia; sem ele, grava as
  linhas válidas e responde, linha a linha, o que entrou, o que era repetido e
  o que tinha erro. A conta free nunca chega aqui (é POST): a prévia dela é só
  a validação do navegador.
- **Repetido não entra** (decisão do produto): contato com o mesmo CPF/CNPJ,
  e-mail ou telefone (com ou sem 55) de um que já existe ou de uma linha
  anterior da planilha; produto ou serviço com o mesmo nome. Nada que já está
  no ERP é alterado.
- A validação (`import-model.ts`, pura) segue a do cadastro manual: CPF/CNPJ
  pelo dígito verificador, e-mail, preço maior que zero. Número aceita o
  formato de planilha brasileira ("R$ 1.234,50", "12,5%").
- O documento gravado é o mesmo do cadastro manual: `searchTokens` do contato,
  `usage.clients`/`usage.products` no dono e em `companies`, em lotes de 400.
  Contato importado leva `source: "import"`.
- **Categoria e fabricante que vierem na planilha entram na lista da empresa**
  (`options`, `product_categories`/`product_manufacturers`), senão o seletor
  do cadastro não os mostraria.
- **Produto por metro** (`pricingModel: curtain_meter`, estoque em metros) só
  quando a tela manda `allowPerMeter`, e ela manda pelo nicho (cortinas). O
  backend continua sem conhecer o nicho.

Guards: `import-model.test.ts` e `import.controller.test.ts`.

### Portal do cliente (`api/services/client-portal/`)

Uma página por CONTATO, aberta por link fixo e revogável
(`/share/portal/{token}` no front), com as propostas, os pagamentos, a obra e
as notas fiscais dele. Pro e Enterprise (`clientPortal`).

- **Um link por contato**, em `client_portal_links/{tenantId}_{clientId}`
  (Admin SDK only). Criar devolve o existente; "gerar novo" troca o token e o
  anterior para de abrir na hora; desligar apaga o doc. A empresa lê e grava
  por `/v1/client-portal/:clientId/link`, com a permissão de Contatos
  (`clients`: ver para ler o link, editar para criar, trocar ou desligar).
- **Abrir o portal é leitura pura.** Ele não cria link nenhum: cada item leva
  à página pública que já existe (proposta, lançamento, obra), e o link dela só
  é obtido ou criado quando o cliente clica (`POST /v1/share/portal/:token/open`,
  `openPortalItem`). Antes de criar, confere que o item é daquela empresa E
  daquele contato, e que o portal o listaria: rascunho, comissão e obra
  cancelada não abrem por ali.
- **O link do lançamento que a empresa já mandou fica como está.**
  `SharedTransactionService.createShareLink` sobrescreve a validade de um link
  existente (inclusive "sem validade"), então o portal reaproveita o link
  válido e só cria um de 30 dias quando não há ou venceu.
- **Proposta só depois de ir para o cliente:** na coluna Enviada, Aprovada
  ou Recusada (lidas como `isStatusApproved`). Rascunho e "Em aberto" nunca
  aparecem, nem com link gerado. Coluna própria da empresa não diz se a
  proposta já foi enviada, então ali vale o link externo já gerado
  (`shared_proposals` com `purpose` diferente de `system_pdf_render`,
  consultado por `proposalId` em lotes de 30); sem isso, uma empresa que trocou
  a coluna Enviada por colunas próprias teria o portal sempre vazio.
- **O que mais o cliente vê:** receitas do contato sem a comissão (que
  tem o `clientId` do PARCEIRO), obras não canceladas com o avanço pelas
  etapas, e notas AUTORIZADAS com o PDF do Focus (que abre sem login). Só o
  primeiro nome do contato.
- **Token inexistente, empresa sem o plano, ou contato apagado ou de outra
  empresa dão o mesmo 404**, como no agendamento.
- **Rota pública montada em `/v1/share/portal`, antes dos `app.use("/v1", ...)`
  dos links públicos**: sob `/v1/share` ela herda a liberação da autenticação,
  e com prefixo próprio não passa três vezes pelo `publicShareLimiter`. A
  resposta vai com `Cache-Control: no-store`.
- As consultas por contato usam duas igualdades (`tenantId`, `clientId`) sem
  `orderBy`: não pedem índice composto. A ordenação é no código.

Guards: `client-portal-model.test.ts`, `client-portal.service.test.ts` (a
fronteira do contato), `client-portal.controller.test.ts`,
`client-portal.routes.gates.test.ts` e `tests/firestore-rules/client-portal.test.ts`.

### Assistência técnica: equipamentos e ordens de serviço (`api/services/field-service/`)

Equipamentos instalados em cada cliente e a ordem de serviço (OS) que os
atende, executada no celular do técnico e assinada pelo cliente na tela.
Capacidade `fieldService` (Pro e Enterprise; Starter pelo add-on
`field_service`), pageIds `equipment` e `service_orders`. Serve a todos os
nichos: chamado de alarme, manutenção de ar-condicionado, suporte de automação.

- **A OS é do técnico.** Membro sem a permissão de escopo `service_orders_all`
  (não é tela: `scopeOf` em `PERMISSION_PAGES`) só alcança as OS em que está em
  `technicianUids`, e só mexe na execução (`ExecutionUpdateSchema`: checklist,
  peças, relatório). As rules aplicam a mesma regra na leitura; a lista dele
  filtra por `technicianUids` (índice `tenantId` + `technicianUids`). O preset
  "Técnico" da tela de Equipe nasce sem o escopo.
- **Cliente copiado na OS** (nome, telefone, endereço): o técnico não tem acesso
  a Contatos e precisa saber aonde ir.
- **Número sequencial** em `service_order_counters/{tenantId}`, alocado na
  transação que cria a OS. Queimado, como o da proposta.
- **Concluir** (`/complete`) exige a assinatura OU o motivo de não haver uma.
  A assinatura guarda nome, documento, data, IP, navegador e o SHA-256 do
  conteúdo (`signatureContentHash`); a OS concluída trava, e só o master reabre
  (`/reopen`), com o motivo e a assinatura anterior no `reopenLog`.
- **Baixa de estoque idempotente.** A OS guarda o que já tirou
  (`stockApplied`); cada conclusão lança só a diferença (`stockDelta`) num
  movimento de id determinístico, na mesma transação que ajusta o saldo.
  Cancelar devolve tudo. Estoque negativo é avisado na resposta, nunca
  bloqueia. Produto sem `inventoryValue` numérico não ganha movimento.
- **OS que mexeu no estoque não se exclui**: reabra e cancele.
- **Agenda.** OS agendada e aberta tem um evento em `calendar_events` com
  `serviceOrderId` (`calendarEventId` na OS), criado, movido e apagado por
  `syncOrderAgenda`. A data mora no evento: mover na Agenda ou no Google volta
  para a OS por `mirrorOrderScheduleFromEvent`, que ignora evento antigo e OS
  encerrada. O vínculo atravessa a regravação do evento (`pickEventLinks`).
- **Aviso ao técnico** (`service_order_assigned`, direto): quando a OS passa
  para ele ou a data muda; quem fez a mudança não é avisado.
- **Equipamentos da obra** (`POST /v1/equipment/batch`, até 50): a tela da obra
  manda os aparelhos escolhidos da proposta, ligados ao `projectId`.
- **Lançar no financeiro** (`POST /v1/service-orders/:id/transaction`): a OS
  concluída vira receita à vista ou parcelada, com ou sem entrada, montada por
  `buildLaunchPlan` do MESMO jeito que a tela de Novo lançamento (restante
  dividido e arredondado uma vez em centavos, entrada como `downPayment` no
  mesmo grupo), pelo `TransactionService.createTransaction`
  (que confere a permissão de Lançamentos e o saldo da carteira), na categoria
  "Ordens de serviço". O id fica em `transactionId`; uma trava de dois minutos
  (`transactionClaimAt`) impede duas abas de lançarem duas vezes. Pede o
  financeiro no plano (402). A nota de serviço sai pelo lançamento, como
  qualquer outro.
- **Link do cliente e PDF.** Um link por OS (`shareToken` na OS, e
  `shared_service_orders/{token}` com o token como id, Admin SDK only), aberto
  em `GET /v1/share/service-order/:token` (público; token desconhecido, OS
  apagada ou empresa sem o módulo dão 404) e em `/share/os/[token]` no front.
  O PDF (`GET /v1/service-orders/:id/pdf`) imprime essa página com o Chromium
  e guarda o cache em `.../service_orders/{id}/pdf/os.pdf` (fora da cota). Ele
  roda na função `pdf`, que não tem o gate de plano do router: o controller
  confere a capacidade. A visão do cliente não leva IP, navegador, caminho de
  arquivo nem ids de membro.
- Fotos e assinatura sobem pelo backend (`tenants/{t}/service_orders/...`),
  contam no armazenamento do plano.

Guards: `field-service-model.test.ts`, `field-service.controller.test.ts`,
`field-service.routes.gates.test.ts` e `tests/firestore-rules/field-service.test.ts`.

#### Contratos de manutenção (`contract-model.ts`, `contract.service.ts`)

A mensalidade que a empresa cobra todo mês (monitoramento, manutenção,
suporte, PMOC) e as visitas preventivas que o contrato promete. Mesma
capacidade `fieldService`, pageId `contracts`, rotas em `/v1/service-contracts`.

- **Rascunho → ativo → suspenso → encerrado.** O rascunho não cobra. Ativar
  pede a data de início (até 31 dias no passado) e o financeiro no plano
  (402): a primeira cobrança é o primeiro dia de cobrança (1 a 28) a partir do
  início. Só o rascunho se exclui; o resto se encerra.
- **A rotina diária cobra** (`processServiceContracts`, 06:00,
  `contract-billing-run.ts`): cada vencimento que entrou na janela de 10 dias
  vira um lançamento `pending` na categoria "Contratos", com id
  `contract_{id}_{AAAAMM}`, gravado com `create` numa transação que relê o id
  antes e avança `nextBillingDate` junto. Rodar duas vezes não cobra em dobro;
  no máximo 3 meses por execução.
- **Não passa pelo `TransactionService.createTransaction`**, que exige um
  usuário. A mensalidade nasce pendente, então não mexe em saldo.
- **O lançamento não leva `proposalId`** (a sincronização da proposta aprovada
  apagaria lançamento com esse campo que ela mesma não gerou) **nem
  `isRecurring`** (a recorrência do financeiro criaria outra parcela ao pagar).
  O vínculo é `serviceContractId` + `contractPeriod`.
- **Suspender não deixa dívida para trás:** ao retomar, a próxima cobrança é o
  primeiro dia de cobrança a partir de hoje cujo mês ainda não foi cobrado
  (`resumeBillingDate`). Mudar o dia de cobrança de um ativo usa a mesma regra.
- **Perder o módulo ou o financeiro suspende** (`suspendedReason: "plan"`) e
  avisa dono e admins (`service_contract_suspended`); nunca apaga. Retomar
  exige o plano de volta.
- **Visita preventiva:** com o plano de visitas ligado, a OS nasce 7 dias
  antes (`preventive`, agendada às 8h, técnico, aparelhos e o checklist do
  contrato, que a tela preenche com o do nicho), com id
  `contract_{id}_visit_{AAAAMMDD}`, e vai para a Agenda com aviso ao técnico.
  Uma por execução. A OS guarda `contractId`.
- **Proposta:** a linha marcada como mensalidade (`isMonthly`, chave "Mensal"
  na linha, visível com o módulo no plano) fica FORA do total, da entrada e
  das parcelas, e aparece à parte como "+ R$ X/mês" no formulário, no PDF e no
  link. No front toda soma passa por `countsInProposalTotal`
  (`apps/web/src/lib/proposal/monthly-lines.ts`), com um guard que reprova
  arquivo que some `.total` sem ela; no backend, `sumProductTotals` (que a
  edição usa para recalcular o `totalValue`). Na aprovação,
  `resolveContractOnApproval` (nunca derruba a aprovação) cria o rascunho
  `proposal_{proposalId}` com essas linhas e a carteira da proposta (id ou
  nome, senão a padrão), com `create`: aprovar de novo não cria outro.
- **Link de pagamento:** o de qualquer lançamento (compartilhar), que abre o
  Pix e o boleto do Asaas quando a empresa tem pagamento online.
- **Nota da mensalidade** (`contract-invoice.ts`): com `issueNfse` ligado, o
  lançamento que vira pago emite a NFS-e. Quem chama é o `onTransactionTotals`
  (vê toda baixa: webhook do Asaas, edição, baixa em lote), com import sob
  demanda. Trava por lançamento em `contract_invoice_claims/{transactionId}`
  (`create` antes de emitir): a entrega repetida do gatilho não emite de novo,
  e a falha fica para o botão do lançamento. Os itens são as linhas de SERVIÇO
  do catálogo do contrato, levadas ao valor do lançamento
  (`contractInvoiceItems`); `issueFromTransaction` segue esse caminho quando o
  lançamento tem `serviceContractId`. A regra geral de emissão automática
  (`tryAutoIssue`) ignora mensalidade de contrato, senão sairiam duas notas.

Guards: `contract-model.test.ts`, `service-contracts.test.ts` (API e rotina com
Firestore falso), `contract-invoice.test.ts`, os blocos de contrato em
`invoice-issue.auto.test.ts` e `onTransactionTotals.test.ts` e os blocos de contratos em `field-service.routes.gates.test.ts`
e `tests/firestore-rules/field-service.test.ts`.

#### PMOC (`shared/pmoc.ts`)

O PMOC é um contrato do tipo `pmoc` (a tela só oferece o tipo em
climatização), com o campo `pmoc`: responsável técnico, dados do prédio
(nome, endereço, ocupantes, área climatizada, uso) e os itens do plano, cada
um com a frequência (mensal, trimestral, semestral, anual).

- **Os modelos da norma moram em `shared/pmoc.ts`**, puro e sem import, por
  tipo de aparelho (split, VRF, janela) e o do ambiente, que entra sempre.
  Cortina de ar não entra. O front espelha os modelos para montar o plano no
  formulário, com paridade testada. **Os itens precisam da revisão de um
  engenheiro de climatização antes de produção.**
- **Os itens são do contrato**, e não de um modelo por empresa: a tela parte
  do modelo dos aparelhos cobertos e a empresa edita ali, porque cada prédio
  tem o seu plano.
- **Cada visita leva só o que venceu** (`pmocItemsForVisit`): a frequência
  conta a partir da primeira visita (`pmoc.anchorDate`, gravada pela rotina ao
  abrir a primeira OS). A primeira leva tudo; depois, o item entra quando a
  frequência dele vence desde a visita anterior, então nunca passa do prazo,
  mesmo com um intervalo de visitas que não divide a frequência. O id do item
  vai para a OS (`pmoc_<id>`), para o relatório juntar as visitas.
- **Ativar exige o responsável técnico e o plano de visitas ligado.** Contrato
  PMOC sem os dados do PMOC é recusado; trocar o tipo para outro apaga o campo.

Guards: `shared/__tests__/pmoc.test.ts` e o bloco PMOC de
`service-contracts.test.ts`.

#### Responsáveis técnicos do PMOC (`technical-responsible-model.ts`)

O engenheiro ou técnico que assina o PMOC, com a ART. Rotas em
`/v1/technical-responsibles` (mesmo gate `fieldService`), cadastradas **só pelo
dono e pelos administradores** (`isTenantAdminRole`), como as demais
Configurações. Só o nicho de climatização mostra a tela, mas o backend não
conhece nicho.

- **A ART é um PDF de verdade:** data URL `application/pdf` com a assinatura
  `%PDF-`, até 700 KB (o corpo da API tem 1 MB). Vai para
  `tenants/{t}/technical_responsibles/{id}/art.pdf` e conta no armazenamento do
  plano (402 com a cota cheia). O novo substitui o anterior.
- **Não se exclui quem assina um contrato PMOC que não está encerrado**
  (`pmoc.responsibleId`, 409): desative o cadastro.

Guards: `technical-responsibles.test.ts`, o bloco dele em
`field-service.routes.gates.test.ts` e `tests/firestore-rules/field-service.test.ts`.

### Vendedor e metas de vendas

A proposta guarda **`sellerId`/`sellerName`** (quem vendeu: membro da empresa,
padrão quem criou, editável no formulário) e **`approvedAt`** (ISO UTC). O
`approvedAt` é gravado na transição para aprovada e apagado na saída
(`approvalTimestampUpdate`, em `api/services/sales-goals.ts`), na MESMA
escrita do status: por isso `updateProposal` decide a aprovação antes de
gravar. A Lia passa pelo mesmo `updateProposal` (abaixo), e cria proposta com quem
pediu como vendedor. O vendedor é conferido contra a empresa
(`resolveSeller`); um vendedor pedido e inválido recusa com 400. Os três campos
estão em `PDF_IRRELEVANT_PROPOSAL_FIELDS`: não aparecem no PDF.

**Responsável pela venda x vendedor da comissão.** São duas coisas: o
responsável é um MEMBRO (conta na meta); o vendedor da comissão é um CONTATO
(parceiro que recebe). Por isso a tela chama o primeiro de "Responsável pela
venda". O vendedor interno que também ganha comissão é um contato vendedor com
`linkedMemberId` (o membro), validado por `validateMemberLink`
(`api/services/contact-member-link.ts`): o membro precisa ser da empresa e só
liga a um contato. Com a ligação, a comissão dele entra sozinha na proposta
quando ele é o responsável (`applySellerCommission`, no front, em
`lib/contacts/seller-commission.ts`), e sai quando o responsável muda. Arquiteto
e vendedor externo não são tocados. Só nos planos com metas.

Propostas aprovadas antes do campo: `npx tsx src/scripts/backfill-proposal-approved-at.ts`
(dry-run; `--apply` grava), que usa o `updatedAt` como data da aprovação. O
vendedor delas fica vazio de propósito: contam só na meta da empresa.

**A Lia muda status pelo mesmo `updateProposal` da tela**
(`changeProposalStatusAsUser`, em `api/controllers/proposal-status-internal.ts`,
que monta uma request interna com a identidade de quem pediu). Até 2026-09-26
ela gravava o status direto no Firestore, e aprovar pela Lia não gerava os
lançamentos, não criava o projeto, não entregava no Drive e não gravava a data
da aprovação. As regras de transição dela (rascunho -> enviada -> aprovada ou
recusada) seguem em `validateProposalStatusChange`. **Não volte a gravar status
fora do `updateProposal`**: toda consequência da aprovação mora nele.

### Comissão de vendedor e arquiteto

Comissão **espelha o cronograma de pagamento do cliente**: se ele paga 60% de
sinal e o resto em 4x, o parceiro recebe 60% da comissão junto do sinal e o
resto em 4x, nas mesmas datas. `buildCommissionDrafts`
(`api/controllers/proposal-commissions.ts`) não calcula datas por conta própria
— ele espelha, uma a uma, as receitas que
`buildApprovedProposalTransactionDrafts` já produziu, com o valor **proporcional
a cada parcela**. É o que faz "80% à vista e o saldo na entrega" sair certo pela
mesma fórmula, sem caso especial.

Quem recebe são contatos com `types` incluindo `vendedor` ou `arquiteto`; o
percentual vem do cadastro e é gravado em `Proposal.commissions[]`, editável por
proposta.

- **Despesa própria, nunca `extraCosts`.** `getWalletImpacts` aplica ao
  extraCost o **sinal do pai**, então comissão pendurada numa receita
  creditaria a carteira em vez de debitar.
- **Sem `proposalGroupId`.** Com ele as comissões cairiam no doc-resumo de
  `transaction_groups` dos recebíveis e a aba Agrupados somaria receita com
  despesa no mesmo card. Cada parceiro tem `installmentGroupId` próprio
  (`commission_{proposalId}_{contactId}_{role}`).
- **A comissão vira UMA série numerada 1..N**, e não uma cópia do
  `isInstallment` de cada receita. Numa proposta com entrada, a série mista
  (entrada fora, parcelas dentro) quebrava o card de grupo da tela de
  Lançamentos, que só lista os membros marcados como parcela: a comissão da
  entrada sumia da lista e aparecia apenas no total do cabeçalho, que então não
  batia com a soma das linhas visíveis.
- **Comissão única fica avulsa** (`installmentGroupId: null`), em vez de virar
  um grupo de um membro só na aba Agrupados.
- **Nasce sempre `pending`**, mesmo quando a receita nasce paga: ter recebido do
  cliente não significa ter pago o parceiro.
- **A chave do diff sai de `getProposalLinkedTransactionKey`, para draft e para
  doc gravado.** O sync joga em `complexDocs` (e aborta) todo doc com
  `proposalId` que ele não consiga keyar; e derivar a chave duas vezes faria uma
  comissão (que também tem `installmentNumber`) colidir com a parcela de receita
  de mesmo número.
- **Comissão PAGA não é apagada nem alterada pelo sync — lança.** `batch.delete`
  de uma despesa paga não devolve o valor à carteira: o saldo ficaria errado em
  silêncio. Para mexer no percentual, reverta o pagamento antes.
- **O caminho `metadataOnly` pula as comissões:** o `clientId` delas aponta para
  o parceiro, não para o comprador.
- Os campos `isCommission`/`commission*` ficam **fora** de
  `UPDATABLE_TRANSACTION_FIELDS` de propósito: são escritos só pelo sync, e um
  PUT do cliente não consegue marcar um lançamento qualquer como comissão.
  Como aquela whitelist só FILTRA o update, os campos sobrevivem a qualquer
  edição de lançamento.

Relatório mensal: `GET /v1/transactions/commissions?month=YYYY-MM`
(`api/services/commission-report.service.ts`), agrupado por parceiro **em
memória** — `sum()` e `count()` não agrupam por campo, e o volume é de dezenas
de docs por mês. Montado sob `/transactions` para herdar o
`requirePlanCapability("financial")` e o prefixo já presente em
`DEMO_READABLE_PREFIXES`. Índice: `(tenantId, isCommission, dueDate ASC)`, com
`orderBy` explícito. Guards: `proposal-commissions.test.ts`,
`commission-report.service.test.ts`, `commission-report.index.test.ts` e
`finance.routes.commissions.test.ts`.

### Infraestrutura / GCP

- **Cloud Monitoring alerts** — as policies vivem SÓ no GCP (o script
  `scripts/setup-gcp-monitoring.sh` citado antes não existe mais no repo; editar via
  console ou `gcloud monitoring policies update`). Existem em ambos os projetos:
  uptime check no `/api/health`, indisponibilidade (CRITICAL), erros 5xx (ERROR),
  latência p95 (WARNING), pico de instâncias (WARNING), erros por tenant.
  - **`Firestore reads acima do free tier (prod)`** (2026-08-27) — soma de
    `firestore.googleapis.com/document/read_count` > 50.000 numa janela de 24h.
    50k é a cota diária gratuita: o alerta dispara no dia em que a leitura
    deixaria de ser grátis. Baseline medido na criação (30 dias): mediana
    1.666/dia, média 2.293/dia, pico 10.479/dia — o limite fica ~4,8× acima do
    maior pico, então disparo significa mudança real de comportamento.
  - **`Rate limit sem store distribuido (fail-open)`** (2026-08-27) — alerta
    log-based em `ratelimit_store_error_allowing_request`. Filtro obrigatório:
    `resource.type="cloud_run_revision" AND textPayload:"..."`. **É
    `textPayload`, não `jsonPayload`**: `logSecurityEvent` emite
    `console.warn("[SECURITY] " + JSON.stringify(...))`, e o prefixo impede o
    Cloud Logging de fazer o parse para JSON estruturado — diferente do
    `logger` de `lib/logger.ts`, que emite JSON puro e vira `jsonPayload`.
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
