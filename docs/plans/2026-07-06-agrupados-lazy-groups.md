# Plano: Visão Agrupada com Resumos de Grupo + Lazy Load de Membros

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A aba "Agrupados" de `/transactions` mostra TODOS os grupos do histórico (sem depender do filtro de data) lendo 1 doc-resumo por grupo; os membros (parcelas/ocorrências) só são buscados ao expandir o container, com cache em memória. Avulsos paginam por vencimento com "carregar mais".

**Architecture:** Nova coleção desnormalizada `transaction_groups` (1 doc por grupo), mantida pelo trigger `onTransactionTotals` já existente (recompute-on-write). Frontend consome resumos direto do Firestore (padrão do repo para listas) e busca membros on-demand via queries por groupId já existentes. Cache de membros em `Map` no estado React — **NUNCA cookie** (cookie vai em toda request HTTP e tem ~4KB).

**Tech Stack:** Firebase Functions V2 (trigger Firestore), firebase-admin 13, Next.js 16 + Firebase client SDK 12, Vitest (web) / Jest (functions), `@firebase/rules-unit-testing` (rules).

## Contexto obrigatório (estado atual, pós-commits de 2026-07-06)

- `apps/functions/src/onTransactionTotals.ts` — trigger `onDocumentWritten("transactions/{id}")` que mantém `paidTotal`/`pendingTotal` no próprio doc via `computeTransactionTotals` (`apps/functions/src/lib/transaction-totals.ts`). **Este plano ESTENDE esse trigger** — não criar um segundo trigger na mesma coleção (custo/ordenação).
- `apps/web/src/services/transaction-service.ts` — tem `getTransactionsScoped` (abertos + período + `completeTransactionGroups`), `getInstallmentsByGroupId(groupId, tenantId?)` e `getRecurringByGroupId(groupId, tenantId?)`.
- `apps/web/src/app/transactions/_hooks/useFinancialData.ts` — busca via `getTransactionsScoped(tenant.id, scopePeriod)`; `scopePeriod` deriva dos filtros de data (default mês atual); efeito pré-preenche as datas quando a visão quer histórico.
- `apps/web/src/app/transactions/_hooks/useFinancialFilters.ts` — filtro de status ligado à aba (Lista = `[pending, overdue]`; Agrupados = `[]`), agrupamento em memória via `getGroupedTransactionKey`.
- `apps/web/src/app/transactions/_lib/financial-utils.ts:62` — **chave de agrupamento**: `proposalGroupId` (une entrada+parcelas) > `installmentGroupId`/`recurringGroupId` > avulso. O doc-resumo DEVE espelhar exatamente essa prioridade.
- Regras Firestore: DENY-by-default (`firebase/firestore.rules`); coleção nova exige regra explícita + teste em `tests/firestore-rules/`.
- Índices: `firebase/firestore.indexes.json`; **range query exige direção ASC** no campo do range (lição de 2026-07-06); deploy de índices é `firebase deploy --project dev --only firestore:indexes` (NÃO sai no `deploy:dev`) e o build leva minutos — deployar índices ANTES do frontend.
- Backfill pattern: `apps/functions/src/scripts/backfill-transaction-totals.ts` (idempotente, `npx tsx`, pagina por `__name__`).

## Restrições Globais

- Commits: 1 por task, conventional, uma linha, sem `Co-Authored-By`. Nunca `git push`. Módulo financeiro = risk tier alto (revisão manual antes de prod).
- Build gates: `cd apps/functions && npm run build && npm run lint && npx jest <suites tocadas>`; web: `npx tsc --noEmit && npm run lint && npx vitest run <suites>`.
- Docs no mesmo commit: `apps/functions/CLAUDE.md` (módulo financeiro), `apps/functions/src/CLAUDE.md` (tabela de triggers), `apps/web/src/app/transactions/CLAUDE.md`, `firebase/firestore.rules` comentário.
- Rollout por ambiente: **índices → esperar READY → rules → functions → backfill → frontend**.
- A aba **Lista não muda** — continua no escopo por período atual.

## Modelo de dados: `transaction_groups/{docId}`

`docId` = `groupKey` com `:` trocado por `_` (Firestore não aceita `/`; `:` é válido mas padronizar `_` evita surpresas em URLs): `proposal_{proposalGroupId}` ou `group_{installmentGroupId|recurringGroupId}`.

```typescript
export type TransactionGroupSummary = {
  tenantId: string;
  groupKey: string;            // "proposal:{id}" | "group:{id}" — mesmo formato de getGroupedTransactionKey
  kind: "proposal" | "installment" | "recurring";
  type: "income" | "expense";  // do doc âncora
  description: string;         // do âncora (installmentNumber 1, ou menor número, ou 1º por dueDate)
  wallet?: string;
  clientName?: string;
  proposalId?: string;
  memberCount: number;
  paidCount: number;
  total: number;               // Σ paidTotal + pendingTotal dos membros
  paidTotal: number;           // Σ paidTotal
  pendingTotal: number;        // Σ pendingTotal
  nextDueDate: string | null;  // menor dueDate entre membros não-pagos (YYYY-MM-DD)
  firstDueDate: string | null;
  lastDueDate: string | null;
  status: "paid" | "pending" | "overdue"; // paid se paidCount==memberCount; overdue se algum membro overdue; senão pending
  updatedAt: string;           // ISO — do recompute
};
```

Derivação de status `overdue`: membro com `status === "overdue"` OU (`status === "pending"` e `dueDate < hoje`) — reusar a mesma regra de `withDerivedOverdue` do frontend, versão server-side.

---

### Task 1: Lib pura de resumo de grupo (backend)

**Files:**
- Create: `apps/functions/src/lib/transaction-group-summary.ts`
- Test: `apps/functions/src/lib/transaction-group-summary.test.ts`

**Interfaces:**
- Produces:

```typescript
export function resolveGroupKey(data: {
  proposalGroupId?: unknown;
  installmentGroupId?: unknown;
  recurringGroupId?: unknown;
}): string | null; // "proposal:{id}" | "group:{id}" | null (avulso)

export function groupDocIdFromKey(groupKey: string): string; // ":" → "_"

export function computeGroupSummary(
  tenantId: string,
  groupKey: string,
  members: Array<Record<string, unknown>>, // docs crus dos membros
  todayIso: string,                        // injetado p/ testabilidade (YYYY-MM-DD)
): TransactionGroupSummary | null;         // null se members vazio (grupo sumiu → deletar doc)
```

- `computeGroupSummary` usa `computeTransactionTotals` (import de `./transaction-totals`) para `paidTotal`/`pendingTotal` por membro — NUNCA recalcular a semântica de extraCosts aqui.
- Âncora para description/type/wallet/clientName: membro com menor `installmentNumber` >= 1; fallback menor `dueDate`; fallback primeiro.

- [x] **Step 1: teste que falha** — casos mínimos: (a) grupo de proposta com entrada (`proposalGroupId` em todos, entrada `installmentNumber: 0`) → `kind: "proposal"`, memberCount inclui a entrada; (b) parcelamento simples 3x com 1 paga → `paidCount: 1`, `nextDueDate` = dueDate da próxima não-paga, `status: "pending"`; (c) membro pending com dueDate < today → `status: "overdue"`; (d) todas pagas → `status: "paid"`, `nextDueDate: null`; (e) `resolveGroupKey` prioriza proposalGroupId; retorna null p/ avulso; (f) members vazio → null.
- [x] **Step 2: rodar e ver falhar** — `npx jest src/lib/transaction-group-summary.test.ts`
- [x] **Step 3: implementar** (funções puras, sem Firestore)
- [x] **Step 4: verde + build + lint**
- [x] **Step 5: commit** — `feat(finance): pure group summary computation for transaction_groups`

### Task 2: Trigger mantém `transaction_groups` + campo `grouped` no doc

**Files:**
- Modify: `apps/functions/src/onTransactionTotals.ts`
- Test: estender `apps/functions/src/lib/transaction-totals.test.ts` OU novo `apps/functions/src/onTransactionTotals.test.ts` (mock de event/refs)
- Docs: `apps/functions/src/CLAUDE.md` (linha do trigger), `apps/functions/CLAUDE.md` (seção summary)

**Interfaces:**
- Consumes: Task 1 (`resolveGroupKey`, `groupDocIdFromKey`, `computeGroupSummary`).
- Produces: docs em `transaction_groups`; campo booleano **`grouped`** em cada doc de `transactions` (true se pertence a grupo) — habilita a query de avulsos (`where("grouped","==",false)`), já que Firestore não consulta "campo ausente".

Comportamento do trigger (além do que já faz com paidTotal/pendingTotal):
1. `grouped` divergente do computado → incluir no mesmo `update` já existente (não gera write extra).
2. `beforeKey = resolveGroupKey(event.data.before?.data())`, `afterKey = resolveGroupKey(after)`. Para CADA chave não-nula e distinta (cobre criação, edição, **mudança de grupo** e **delete** — no delete `after` não existe mas `beforeKey` recomputa o grupo que perdeu o membro):
   - Query membros: por prefixo — `proposal:` → `where("proposalGroupId","==",id)`; `group:` → duas queries (`installmentGroupId==id` e `recurringGroupId==id`, união).
   - `computeGroupSummary(...)` → `set` no doc `transaction_groups/{groupDocIdFromKey(key)}` (merge total, não parcial); `null` → `delete`.
3. Anti-loop: trigger escreve em OUTRA coleção (`transaction_groups`) — não re-dispara. O update de `grouped`/totais no próprio doc já tem o guard `storedTotalsDiffer` — estender o guard para incluir `grouped`.
4. **Atenção ao early-return atual**: hoje o trigger retorna cedo quando `!afterSnap?.exists` (delete) e quando totais não divergem. O recompute de grupo precisa rodar TAMBÉM nesses caminhos (delete de membro; edição que não muda totais mas muda dueDate/status... status muda totais; dueDate não → recompute mesmo assim). Reestruturar: sempre calcular before/after keys e recomputar grupos; o update de totais continua condicional.

- [x] **Step 1: teste que falha** — fake Firestore em memória (em vez de mock do lib — cobre a integração real); casos: create de membro → set no grupo; delete → recompute do beforeKey; mudança de installmentGroupId → recompute dos DOIS grupos; avulso (sem grupo) → nenhum acesso a transaction_groups; `grouped` gravado corretamente; echo do trigger → sem recompute; grupo legado misto → promovido à chave proposal.
- [x] **Step 2: red** — [x] **Step 3: implementar** — [x] **Step 4: verde + suite `src/lib` + build + lint** (falha pré-existente em error-ingest.service.test.ts não relacionada)
- [x] **Step 5: commit** — `feat(finance): onTransactionTotals maintains transaction_groups summaries and grouped flag`

### Task 3: Backfill de `transaction_groups` + `grouped`

**Files:**
- Create: `apps/functions/src/scripts/backfill-transaction-groups.ts` (seguir `backfill-transaction-totals.ts`)

Lógica: paginar `transactions` por `__name__`; (a) marcar `grouped` onde divergente (batch); (b) acumular `groupKey → tenantId` num Map; ao final, para cada grupo, buscar membros e `computeGroupSummary` → set. Idempotente. Log `processed/updatedGrouped/groupsWritten`.

- [x] **Step 1: implementar** (script one-shot; sem teste automatizado — validação é a execução em dev + Task 7; reusa `recomputeGroup` exportado do trigger — promoção de grupos mistos single-source)
- [x] **Step 2: build + lint + commit** — `feat(finance): backfill script for transaction_groups and grouped flag`

### Task 4: Regras + índices da coleção nova

**Files:**
- Modify: `firebase/firestore.rules` — `transaction_groups`: read para usuário autenticado do mesmo tenant (mesmo padrão da regra de `transactions`; copiar a checagem de claims/tenantId usada lá); write: **negado ao client** (só Admin SDK).
- Modify: `firebase/firestore.indexes.json` — compostos ASC: `(tenantId, nextDueDate)`, `(tenantId, status, nextDueDate)`; para avulsos em `transactions`: `(tenantId, grouped, dueDate)` **ASC** (range/orderBy em dueDate).
- Test: `tests/firestore-rules/transaction-groups.test.ts` — tenant A lê os próprios resumos; tenant A NÃO lê os de B; client não escreve.

- [x] **Step 1: teste de rules que falha (coleção sem regra = negado até para o dono)**
- [x] **Step 2: regra + índices** — decisão: ordenação de resumos por `lastDueDate DESC` (inclui grupos 100% pagos — `nextDueDate` null sumiria do orderBy); avulsos por `dueDate DESC`. Índices: `transaction_groups (tenantId ASC, lastDueDate DESC)` e `transactions (tenantId ASC, grouped ASC, dueDate DESC)`. Filtros de status/type/wallet aplicam client-side sobre resumos carregados — sem índice extra por status.
- [x] **Step 3: `npm run test:rules` verde** (121/121)
- [x] **Step 4: commit** — `feat(finance): rules and indexes for transaction_groups`

### Task 5: Service frontend — resumos paginados, avulsos paginados, membros on-demand

**Files:**
- Modify: `apps/web/src/services/transaction-service.ts`
- Test: `apps/web/src/services/__tests__/transaction-groups.test.ts` (mesmo padrão de mocks de `transactions-scoped.test.ts`)

**Interfaces (Produces):**

```typescript
export type TransactionGroupSummary = { /* espelho do tipo backend, + id: string */ };

getGroupSummariesPaginated: async (
  tenantId: string,
  opts: { pageSize?: number; cursor?: QueryDocumentSnapshot | null }, // default 50, orderBy nextDueDate asc (nulls/pagos por último — usar orderBy("nextDueDate") + fallback client)
) => Promise<{ groups: TransactionGroupSummary[]; nextCursor: QueryDocumentSnapshot | null }>;

getStandaloneTransactionsPaginated: async (
  tenantId: string,
  opts: { pageSize?: number; cursor?: QueryDocumentSnapshot | null },
  // where grouped == false, orderBy dueDate desc? — ATENÇÃO: índice da Task 4 é ASC;
  // range/order desc exige índice DESC → decidir ordenação AQUI e alinhar o índice na Task 4.
) => Promise<{ transactions: Transaction[]; nextCursor: QueryDocumentSnapshot | null }>;

getGroupMembers: async (
  tenantId: string,
  groupKey: string, // "proposal:{id}" | "group:{id}"
) => Promise<Transaction[]>; // proposal → where proposalGroupId==; group → união installment/recurring (métodos existentes)
```

- [x] Steps TDD (red → green): paginação com cursor; `getGroupMembers` roteia pela chave (proposal inclui irmãos legados via installmentGroupId); tudo tenant-scoped. Decisão: avulsos ordenam por `date` desc (campo sempre presente; `dueDate` opcional sumiria do orderBy) — índice da Task 4 ajustado para `(tenantId, grouped, date DESC)`.
- [x] **Commit** — `feat(web): transaction group summaries service with paginated standalones and on-demand members`

### Task 6: UI da aba Agrupados consome resumos + expand lazy + cache

**Files:**
- Modify: `apps/web/src/app/transactions/_hooks/useFinancialData.ts` (ou novo hook `useGroupedTransactions.ts` — preferir hook novo, dado o tamanho do existente)
- Modify: componente da visão agrupada (localizar consumo: `_components/transaction-card.tsx` / agrupamento em `useFinancialFilters.ts:307` via `getGroupedTransactionKey`) — **primeiro passo da task é mapear** exatamente quais componentes renderizam containers vs membros expandidos
- Test: Vitest do hook novo (cache hit/miss/invalidação)

Comportamento:
1. Aba Agrupados: fonte = `getGroupSummariesPaginated` + `getStandaloneTransactionsPaginated` ("carregar mais" em cada seção ou intercalado — seguir o layout atual).
2. Expandir grupo: `getGroupMembers` → guarda em `membersCacheRef: Map<groupKey, Transaction[]>`; re-expandir = cache, sem query.
3. **Invalidação**: toda mutação existente no hook (update/delete/status/partial payment) que toque um doc com groupKey → `membersCacheRef.delete(groupKey)` + refetch do resumo daquele grupo (1 doc). Mutations em lote (`updateGroupStatus`, batch) → limpar o cache inteiro (simples e correto).
4. **Consistência eventual**: o resumo é atualizado por trigger (~segundos). Após mutação, aplicar update otimista no resumo local (os handlers otimistas já existem para docs — espelhar no summary) OU refetch com pequeno delay. Decidir na implementação; registrar a escolha no CLAUDE.md.
5. Cards de resumo (topo) na aba Agrupados: derivar de `paidTotal/pendingTotal` dos summaries carregados + avulsos carregados — deixa de depender de todos os membros. Documentar que os cards refletem o que está carregado (mesma semântica atual de "com filtros aplicados").
6. Filtros na aba Agrupados: status/type/wallet aplicam sobre os campos do summary; **busca textual** cobre `description`/`clientName` dos summaries e avulsos carregados — membros não expandidos não são buscados (documentar; é o trade-off do lazy).
7. Aba Lista: intocada (escopo por período).

- [x] Steps: mapear componentes → TDD do hook → integrar → `tsc + lint + vitest run` completos (520 testes verdes)
  - Decisões de implementação: representative sintético do resumo alimenta o `TransactionCard` existente (id = `anchorTransactionId`; novos campos `anchorAmount`/`anchorInstallmentGroupId` no doc-resumo); `forceExpandable` no card; consistência eventual via `refresh()` agendado 1,5s pós-mutação; refresh revalida membros cacheados no lugar (stale-while-revalidate); heurística de entrada órfã não se aplica na fonte nova (documentado).
- [x] **Commit** — `feat(web): grouped view reads group summaries with lazy member loading and in-memory cache`

### Task 7: Deploy dev + validação E2E manual

- [x] Índices: `firebase deploy --project dev --only firestore:indexes` → **READY confirmado** (poll gcloud até CREATING vazio)
- [x] Rules: `firebase deploy --project dev --only firestore:rules`
- [x] Functions: `firebase deploy --project dev --only functions`
- [x] Backfill: executado em dev — processed=93, updatedGrouped=93, groupsWritten=11
- [x] Verificação de paridade: script temporário rodado em dev — **PARITY: MATCH** (11 grupos + flag `grouped` em 93 docs)
- [ ] Manual (usuário): Agrupados mostra TODOS os grupos sem filtro de data; expandir carrega membros; editar parcela atualiza container (~2s do trigger); criar/deletar parcelamento cria/remove container; conta `lyft@gmail.com` é o caso de teste conhecido
- [x] Atualizar `docs/plans/2026-07-06-firestore-client-audit.md` (kanban/dashboard seguem pendentes; grouped resolvido)
- [ ] Rollout prod (após validação manual): índices → READY → rules → functions → backfill

## Decisões já tomadas (não re-litigar)

| Decisão | Racional |
|---|---|
| Cache de membros em memória (Map/React), NÃO cookie/localStorage | Cookie viaja em toda request e tem 4KB; membros são dados por sessão de página |
| Estender `onTransactionTotals`, não criar 2º trigger | 2 triggers na mesma coleção = 2 cold paths, ordenação não garantida entre eles |
| Client lê `transaction_groups` direto do Firestore | Padrão do repo para listas (services client-side); write só Admin SDK via rules |
| Campo `grouped` desnormalizado em `transactions` | Firestore não consulta ausência de campo; necessário para paginar avulsos |
| Recompute total do grupo a cada write de membro (não increment) | Grupos ≤120 docs; recompute é barato, idempotente e imune a corrida de increments |
| Aba Lista permanece com escopo por período | Já resolvida; este plano só muda a fonte da aba Agrupados |

## Riscos e casos de borda (verificar na execução)

- Grupo de proposta com `proposalGroupId` só em parte dos docs (dados legados): membros com `installmentGroupId` igual mas sem `proposalGroupId` cairiam em DOIS summaries. Backfill deve detectar interseção (mesmo doc elegível a `proposal:` e `group:`) e o `resolveGroupKey` (prioridade proposal) garante 1 chave por DOC — mas membros do MESMO grupo lógico podem divergir de chave entre si. Mitigação: no backfill, se um `installmentGroupId` tem QUALQUER membro com `proposalGroupId`, promover o grupo inteiro à chave proposal (log dos casos).
- `orderBy(nextDueDate)` exclui docs com `nextDueDate: null` (grupos 100% pagos) — decidir: segunda query `where nextDueDate == null` paginada, ou ordenar por `lastDueDate`. Definir na Task 5 e alinhar índice na Task 4.
- Trigger em rajada (aprovação de proposta cria N parcelas em batch) → N recomputes do mesmo grupo; inócuo (idempotente), mas se custo incomodar, debounce não é trivial em triggers — aceitar.
- E2E existentes de transações (`tests/e2e`) podem assertar o comportamento antigo da aba Agrupados — rodar e ajustar os specs afetados no mesmo commit da Task 6.
