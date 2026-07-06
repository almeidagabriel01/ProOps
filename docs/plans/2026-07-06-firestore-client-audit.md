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

### P1 restante — Dashboard ainda baixa transações cruas para os GRÁFICOS
`useDashboardData` usa o summary novo (barato), mas o gráfico mensal de 6 meses precisa de datas efetivas por item (pago → paidDate; pendente → dueDate; extraCosts com datas próprias) — isso não se expressa em aggregation. Correção certa: **rollup mensal desnormalizado** (`tenant_usage/{tenantId}/months/{YYYY-MM}` com receitas/despesas incrementadas pelo mesmo trigger `onTransactionTotals`), padrão que o repo já usa para `proposalsCreated`. Precisa de decisão de produto sobre semântica do gráfico (projeção por dueDate vs realizado). Esforço: ~1 dia. Gatilho: o mesmo (>20k leituras/dia) — o summary já cortou metade do custo do dashboard.

### P2 — Busca client-side exige coleção inteira
`proposals/page.tsx:433` (modo busca) e `client-select.tsx:55` baixam tudo porque Firestore não tem busca textual. `limit()` quebraria a busca. Correção certa: campo normalizado (`searchTokens` array) + query por prefixo, ou busca server-side. Gatilho: tenants com >1k propostas/clientes.

### ✅ RESOLVIDO (2026-07-06) — Lista de transações escopada por período
`useFinancialData` agora usa `getTransactionsScoped`: itens em aberto (sempre completos) + docs do período visível (default mês atual, pré-preenchido nos inputs de data) + grupos completados via chunked `in`. Filtros/busca/agrupamento continuam client-side sobre o escopo, que é sempre visível na UI. Índices novos: `(tenantId, dueDate)` e `(tenantId, installmentGroupId)`. Ainda com full-fetch: fluxos de edição (`useEditTransaction`) e kanban de transações — abaixo.

### P2 — Kanban puxa listas completas
`transaction-kanban-tab.tsx:80`, `proposal-kanban-tab.tsx:86`. Board mostra todos os cards por design — limitar muda produto. Correção: paginação por coluna ou cap com "carregar mais". Decisão de UX antes de código.

### P3 — Variantes paginadas com branch de sort client-side
`proposal-service.ts:272` e `product-service.ts:317` fazem full fetch quando o sort é por campo derivado (primaryEnvironment, stock). Correção: desnormalizar o campo de sort no doc.

### P3 — `wallet-service.ts:215` ledger de carteira sem limite
Cresce com o tempo. Adicionar paginação quando a página de extrato ganhar "carregar mais".

### P3 — `team-management.tsx:80` N+1 de permissões
1 `getDocs` por membro. Times são pequenos (limite de plano ≤2-3 users) — irrelevante hoje.

### Observação de higiene
`services/CLAUDE.md` afirma que services "nunca acessam Firestore diretamente" — está defasado: os services de lista fazem exatamente isso por design (leitura client-side, escrita via backend). Atualizar o doc quando tocar na camada.

### Estabilidade de deps (re-subscribe)
Suspeitas anotadas (não confirmadas como bug): `useFinancialData` re-subscreve se a identidade de `tenant` não for estável; `use-contacts-ctrl`/`proposals`/`products` re-criam `fetchPage` quando `sortConfig` muda de identidade; `useNotifications` tem `scope` (objeto) e `scopeKey` (string) nas mesmas deps. Verificar memoização nos providers antes de mexer.

## Gatilhos de revisão
Leituras Firestore > 20k/dia sustentado → atacar P1. > 40k/dia → P1+P2 urgentes (free tier = 50k/dia).
