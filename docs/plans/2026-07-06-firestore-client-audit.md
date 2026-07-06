# Auditoria Firestore Client-Side — 2026-07-06

Contexto: as listas (transações, propostas, clientes, produtos) leem Firestore direto do browser via SDK. Em escala, este é o primeiro SKU de custo a estourar. Auditoria completa em `apps/web/src`; abaixo o que foi corrigido agora e o que fica como backlog **com o motivo** (não aplicar `limit()` cego onde quebraria correção).

## Corrigido nesta rodada (commit desta data)

| Achado | Correção |
|---|---|
| `notification-service.ts` — `onSnapshot` da coleção `notifications` do tenant **sem `limit()`**, ativo em TODA página autenticada. Cada mudança re-cobrava a coleção inteira, por aba aberta. | `limit(50)` na query do listener (mesma janela do fallback de polling). Guard de regressão em `services/__tests__/firestore-read-caps.test.ts`. |
| `transactions/[id]/view/page.tsx` — baixava a **coleção inteira** do tenant para achar parcelas de um grupo. | Query direcionada: `getInstallmentsByGroupId` (existente) ou `getRecurringByGroupId` (novo método espelho por `recurringGroupId`). |
| Polling de notificações (fallback 10s) e badge não pausavam em aba oculta. | Ver T14 (guard `visibilitychange`). |

## Backlog priorizado (NÃO corrigido de propósito — precisa de decisão de produto/arquitetura)

### ✅ P1 RESOLVIDO (2026-07-06) — summary financeiro server-side
Implementado: campos desnormalizados `paidTotal`/`pendingTotal` mantidos pelo trigger `onTransactionTotals` (cobre todos os writers, auto-corretivo) + `GET /v1/transactions/summary` com aggregation queries (2 queries, 1 leitura/1000 docs) + frontend `getSummary` consumindo o endpoint. Corta o full-fetch DUPLICADO das páginas de transações e dashboard. **Pré-requisito de rollout em cada ambiente**: deploy do trigger → `npx tsx src/scripts/backfill-transaction-totals.ts` → só então o summary fica exato para docs antigos (aggregation ignora docs sem os campos).

### ✅ RESOLVIDO (2026-07-06) — Dashboard não baixa mais transações cruas
`useDashboardData` trocou `getTransactions` (coleção inteira) pela união dedupada de: `getTransactionsScoped` (mês atual → +12 meses, inclui TODOS os itens em aberto — projeção/alertas não dependem da janela) + `getTransactionsPaidBetween` (pagos NESTE mês por `paidAt` — cobre lançamento antigo pago agora) + `getRecentTransactions(5)`. Semântica dos gráficos preservada (computação client-side idêntica sobre o escopo). Índice novo: `transactions (tenantId, paidAt ASC)`. Caveat documentado: doc legado sem `paidAt` pago neste mês com date/dueDate antigos fica fora do bucket atual — casos raros pré-abril/2025. O rollup mensal desnormalizado segue como evolução futura se o escopo ainda pesar.

### ~~P1 restante~~ (histórico) — Dashboard baixava transações cruas para os GRÁFICOS
`useDashboardData` usa o summary novo (barato), mas o gráfico mensal de 6 meses precisa de datas efetivas por item (pago → paidDate; pendente → dueDate; extraCosts com datas próprias) — isso não se expressa em aggregation. Correção certa: **rollup mensal desnormalizado** (`tenant_usage/{tenantId}/months/{YYYY-MM}` com receitas/despesas incrementadas pelo mesmo trigger `onTransactionTotals`), padrão que o repo já usa para `proposalsCreated`. Precisa de decisão de produto sobre semântica do gráfico (projeção por dueDate vs realizado). Esforço: ~1 dia. Gatilho: o mesmo (>20k leituras/dia) — o summary já cortou metade do custo do dashboard.

### P2 — Busca client-side exige coleção inteira
`proposals/page.tsx:433` (modo busca) e `client-select.tsx:55` baixam tudo porque Firestore não tem busca textual. `limit()` quebraria a busca. Correção certa: campo normalizado (`searchTokens` array) + query por prefixo, ou busca server-side. Gatilho: tenants com >1k propostas/clientes.

### ✅ RESOLVIDO (2026-07-06) — Lista de transações escopada por período
`useFinancialData` agora usa `getTransactionsScoped`: itens em aberto (sempre completos) + docs do período visível (default mês atual, pré-preenchido nos inputs de data) + grupos completados via chunked `in`. Filtros/busca/agrupamento continuam client-side sobre o escopo, que é sempre visível na UI. Índices novos: `(tenantId, dueDate)` e `(tenantId, installmentGroupId)`. Ainda com full-fetch: fluxos de edição (`useEditTransaction`) e kanban de transações — abaixo.

### ✅ RESOLVIDO (2026-07-06) — Aba Agrupados via doc-resumos (`transaction_groups`)
Plano `2026-07-06-agrupados-lazy-groups.md` executado: coleção desnormalizada `transaction_groups` (1 doc por grupo, mantida pelo trigger `onTransactionTotals` + campo `grouped` nos docs), aba Agrupados lê resumos paginados + avulsos paginados (`grouped == false`) e busca membros só ao expandir (cache em memória, stale-while-revalidate). Histórico completo sem depender de filtro de data e sem baixar membros. Rollout dev feito (índices READY → rules → functions → backfill 93 docs/11 grupos → paridade MATCH). **Pendente em prod**: mesma sequência.

### ✅ RESOLVIDO (2026-07-06) — Dashboard baixava TODAS as propostas e TODOS os clientes
`useDashboardData` agora usa aggregation `count()` para stats de proposta (sets de status derivados das colunas do kanban, `in` chunked de 30), total de clientes e novos-no-mês (createdAt misto Timestamp/string → 2 counts somados), + `getRecentProposals(5)` com orderBy/limit. De (N propostas + M clientes) leituras por abertura para ~8 counts + 5 docs. Guard: `services/__tests__/dashboard-counts.test.ts`.

### ✅ RESOLVIDO (2026-07-06) — Cron `checkDueDates` varria propostas globais sem filtro/limit
Query de propostas ganhou `where("validUntil","<=",...)` (docs sem validUntil já eram ignorados em memória — equivalente) + índice `(status, validUntil)`; ambas as queries do cron agora paginam por cursor em lotes de 400 (padrão markOverdueTransactions). Memória constante independente do tamanho da base.

### ✅ RESOLVIDO (2026-07-06) — `viewerInfo` de share links crescia sem bound
`recordView` (shared-proposal/shared-transactions) trocou `arrayUnion` por transação que mantém as últimas 50 entradas + `viewCount` (increment). Antes, link público muito acessado inflaria o doc até o limite de 1 MB e os writes de view passariam a falhar.

### ✅ RESOLVIDO (2026-07-06) — Stripe SDK no cold start do monólito
`stripeConfig.getStripe()` agora faz `require("stripe")` lazy; importadores usam `import type`. SDKs de IA (`@google/genai`, `groq-sdk`) verificados: já eram lazy (dynamic import nos handlers).

### ✅ RESOLVIDO (2026-07-06) — Calendário: leitura de integração por GET + fallback sem limit
`getGoogleIntegration` ganhou cache negativo por tenant (TTL 5 min, só o "não tem integração" — o registro real é sempre relido; invalidado no callback OAuth de conexão). `listCalendarEventsWithTenantFallback` (caminho degradado) ganhou `limit(1500)`.

### ✅ RESOLVIDO (2026-07-06) — `whatsappLogs` com TTL
Writes agora incluem `expiresAt` (180 dias). **Pendente de config manual**: habilitar TTL policy no console (Firestore → TTL → coleção `whatsappLogs`, campo `expiresAt`) em dev e prod — não expressável em firestore.indexes.json.

### ✅ RESOLVIDO (2026-07-06) — Kanban puxava listas completas
`kanban-board-service.ts`: 30 cards por coluna via query por status (`in` [colId, mappedStatus]) + "Carregar mais" com cursor + contagem real do header via `getCountFromServer`. Propostas ordenam por `createdAt desc`, transações por `date desc` (índice novo `transactions (tenantId, status, date DESC)`). Drag ajusta contagens otimisticamente com rollback. Guard: `__tests__/kanban-board-service.test.ts`.

### ✅ RESOLVIDO (2026-07-06) — Sort por campo derivado com full fetch
Propostas: `primarySystem`/`primaryEnvironment` desnormalizados no doc (`computeProposalSortFields` no save do frontend + validação/persistência no controller + `backfill-proposal-sort-fields.ts`; sem sistemas → "") — `getProposalsPaginated` usa orderBy direto (índices já existiam). Produtos: sort por `stock`/`inventoryValue` usa orderBy("stock") (controller já normalizava; `backfill-product-stock.ts` cobriu o legado; índice já existia).

### ✅ RESOLVIDO (2026-07-06) — Busca client-side exigia coleção inteira
`searchTokens` (prefixos normalizados sem acento, ≥2 chars, cap 150) gravados pelo backend em proposals (title+clientName) e clients (name+email+phone) — todos os writers cobertos, incl. clientes auto-criados (`contacts.service`). Web: `searchProposals`/`searchClients` com `array-contains` na primeira palavra + refino client-side multi-palavra + limit. Backfill: `backfill-search-tokens.ts`. Sem índice composto extra (equality + array-contains).

### ✅ RESOLVIDO (2026-07-06) — Ledger de carteira sem limite
`getWalletTransactions` agora ordena server-side (`createdAt desc` — sempre Timestamp nos writers) com `limit(200)`. Índice novo: `wallet_transactions (tenantId, walletId, createdAt DESC)`. "Carregar mais" no extrato fica como evolução se 200 não bastar.

### ✅ RESOLVIDO (2026-07-06) — `team-management.tsx` N+1 de permissões
Leituras de permissões dos membros paralelizadas com `Promise.all` (eram sequenciais, 1 roundtrip por membro).

### Observação de higiene
`services/CLAUDE.md` afirma que services "nunca acessam Firestore diretamente" — está defasado: os services de lista fazem exatamente isso por design (leitura client-side, escrita via backend). Atualizar o doc quando tocar na camada.

### Estabilidade de deps (re-subscribe)
Suspeitas anotadas (não confirmadas como bug): `useFinancialData` re-subscreve se a identidade de `tenant` não for estável; `use-contacts-ctrl`/`proposals`/`products` re-criam `fetchPage` quando `sortConfig` muda de identidade; `useNotifications` tem `scope` (objeto) e `scopeKey` (string) nas mesmas deps. Verificar memoização nos providers antes de mexer.

## Gatilhos de revisão
Leituras Firestore > 20k/dia sustentado → atacar P1. > 40k/dia → P1+P2 urgentes (free tier = 50k/dia).
