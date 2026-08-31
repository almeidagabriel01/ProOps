# CLAUDE.md — src/app/transactions/ (Módulo Financeiro)

> Leia esta seção inteira antes de tocar em qualquer arquivo desta pasta.

## Arquivos principais (frontend)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `_hooks/useFinancialData.ts` | Estado central: transactions, wallets, filtros, optimistic updates |

## Escopo de leitura por período (2026-07-06) — só aba Lista

A página NÃO baixa mais a coleção inteira. `useFinancialData` busca via
`TransactionService.getTransactionsScoped(tenantId, {start, end})`:

- **Itens em aberto** (pending/overdue) — sempre completos, independente do período;
- **Docs do período visível** (range em `dueDate` E em `date`, união dedupada);
- **Grupos completados** (`completeTransactionGroups`) — parcela no período traz as irmãs.

Período = filtros de data da UI; sem filtro, mês atual. Quando o usuário quer
histórico NA LISTA (status "todos" ou incluindo pagos) sem datas definidas, o
hook **pré-preenche o mês atual nos inputs** — o escopo carregado fica sempre
explícito na UI. Trocar as datas refaz a query. A aba Agrupados NÃO usa esse
escopo (ver abaixo) e não pré-preenche datas.

## Aba Agrupados: resumos de grupo + membros lazy (2026-07-06)

A aba Agrupados mostra TODOS os grupos do histórico lendo **1 doc-resumo por
grupo** da coleção `transaction_groups` (mantida pelo trigger backend
`onTransactionTotals`) + **avulsos paginados** (`grouped == false`, por `date`
desc) — independente do filtro de data.

- `_hooks/useGroupedTransactions.ts` — resumos+avulsos paginados ("carregar
  mais" quando a página local esgota), membros on-demand com **cache em Map em
  memória** (NUNCA cookie/localStorage), `refresh()` com
  stale-while-revalidate (revalida membros cacheados no lugar, sem piscar).
- `_components/grouped-transactions-view.tsx` — renderiza `TransactionCard`
  com representative **sintético** derivado do resumo (id = `anchorTransactionId`
  real → links/ações funcionam colapsado; `forceExpandable` habilita o chevron
  antes de os membros carregarem). Expandir chama `ensureMembers(groupKey)`.
- **Consistência eventual**: resumos são recomputados pelo trigger
  (~segundos). Mutações na aba agendam `grouped.refresh()` com delay de 1,5s
  (`scheduleGroupedRefresh` em page.tsx) — decisão registrada aqui; não trocar
  por polling nem por refresh imediato (o trigger ainda não recomputou).
- **Filtros** aplicam client-side sobre os campos do resumo
  (status/type/wallet/busca em description+clientName; datas por interseção
  `[firstDueDate, lastDueDate]`). Busca NÃO cobre membros não expandidos —
  trade-off documentado do lazy load.
- **Cards de resumo** na aba derivam de `paidTotal`/`pendingTotal` dos
  resumos+avulsos carregados (`groupedSummary` em page.tsx) — refletem o que
  está carregado.
- Heurística de "entrada órfã" (avulso casado a grupo por descrição/data) NÃO
  se aplica nesta fonte — entrada órfã aparece como avulso.
- Testes: `_hooks/__tests__/useGroupedTransactions.test.ts`,
  `services/__tests__/transaction-groups.test.ts`.

Os cards de resumo continuam sendo o memo FILTRADO client-side (sobre o
escopo); o summary GLOBAL (dashboard) vem de `GET /v1/transactions/summary`
(aggregation server-side). Não reintroduzir `getTransactions(tenantId)` sem
escopo nesta página — guard de regressão em
`services/__tests__/transactions-scoped.test.ts`.

## Editor: entrada órfã escopada por dia (2026-08-27)

A auditoria de 06/07/2026 corrigiu as PÁGINAS, mas `useEditTransaction`
continuou chamando `getTransactions(tenantId)` em 4 pontos. Abrir a edição de
uma recorrência baixava a coleção inteira do tenant **duas vezes** (uma para
achar as irmãs do grupo, outra para a heurística de entrada órfã) — num tenant
com 5.000 lançamentos, ~10.000 leituras por abertura de modal, crescendo com o
histórico para sempre.

- **Irmãs do grupo** → `getRecurringByGroupId` (já existia; índice
  `tenantId,recurringGroupId,installmentNumber` já existia).
- **Entrada órfã** → `getTransactionsOnDay(tenantId, anchorDayOf(anchor))`.
  A heurística casa por `dateOnly(date || dueDate)` dos dois lados, então todo
  candidato possível está no mesmo dia da âncora. A busca é a união de duas
  queries de faixa de um dia (`date` e `dueDate`), com `\uf8ff` no limite
  superior para cobrir tanto `"YYYY-MM-DD"` quanto o sufixo `THH:mm:ss` legado.
  Índices `tenantId,date` e `tenantId,dueDate` já existiam — **nenhum índice
  novo**.
- Âncora sem `date` e sem `dueDate` pula a busca (a heurística aceitaria
  qualquer data; varrer o tenant por dado corrompido não paga). Cai no mesmo
  caminho de "não achou exatamente 1 candidato" que já existia.

Guard de varredura em `services/__tests__/firestore-read-caps.test.ts`: falha
se QUALQUER arquivo fora da allowlist chamar
`TransactionService.getTransactions(`. Teste de unidade não pega reincidência —
o problema não é a função existir, é alguém chamá-la numa tela nova.

**Allowlist atual: `app/wallets/_components/wallet-history-dialog.tsx`.**
Esse não pode ser escopado ingenuamente: um extra-cost carrega carteira **e**
status próprios, independentes do lançamento pai, então tanto
`where("wallet","in",[...])` quanto `where("status","==","paid")` derrubam
silenciosamente entradas do histórico financeiro. O fix correto (campo
desnormalizado `walletsInvolved` mantido no backend + backfill) está em
`.claude/rules/scaling-roadmap.md`.

**Filtro de status é ligado à aba, sem persistência** (spec 2026-07-06):
Lista (byDueDate) SEMPRE entra com `[pending, overdue]` — mesmo que o usuário
tenha desativado antes de trocar de aba; Agrupados SEMPRE entra limpo (todos).
Mudanças do usuário valem só enquanto permanece na aba. Não reintroduzir
persistência em localStorage (as chaves `transactions:filterStatus*` legadas
são removidas no mount). Testes: `_hooks/__tests__/useFinancialFilters.test.ts`.
| `_hooks/useEditTransaction.ts` | Carrega e submete edição de lançamento/grupo |
| `_hooks/useTransactionForm.ts` | Criação de lançamentos |
| `_components/transaction-card.tsx` | Exibe lançamentos em cards agrupados |
| `_components/transaction-filters.tsx` | Filtros da listagem |
| `src/components/features/wallet-select.tsx` | Seletor de carteira (usado em todos os forms) |

## Migração ID vs NAME (CRÍTICO)

O `WalletSelect` foi migrado em abril/2025 para usar **wallet.id** como value (antes usava wallet.name).

- **Dados novos:** `transaction.wallet` = ID do Firestore (ex: `"389pG63xVHekTTyaK7tY"`)
- **Dados antigos:** `transaction.wallet` = nome da carteira (ex: `"NuBank"`)

### Regras de uso

**Display (render):** sempre resolver para nome antes de exibir:
```tsx
wallets.find(w => w.id === tx.wallet || w.name === tx.wallet)?.name ?? tx.wallet
```

**Forms de edição:** sempre resolver NAME → ID antes de popular o WalletSelect:
```typescript
// resolveWalletId() em useEditTransaction.ts faz isso automaticamente
wallets.find(w => w.name === tx.wallet)?.id ?? tx.wallet
```

**Filtros:** `filterWallet` armazena wallet ID. Match deve verificar ambos:
```typescript
tx.wallet === filterWallet || walletObj?.name === tx.wallet
```

**Optimistic updates:** o mapa de impacts pode ser keyed por NAME (antigo) ou ID (novo):
```typescript
oldImpacts.get(w.name) || oldImpacts.get(w.id) || 0
```

## Estrutura de Parcelamentos

Cada parcela = documento Firestore separado em `transactions`, ligadas por `installmentGroupId`.

```
installmentNumber: 0 → entrada (isDownPayment: true)
installmentNumber: 1 → 1ª parcela (âncora do grupo)
installmentNumber: 2, 3... → parcelas seguintes
```

Campos de grupo:
- `installmentGroupId` — liga parcelas entre si (`gen_{timestamp}` ou `proposal_installments_{proposalId}`)
- `proposalGroupId` — liga entrada + parcelas de uma proposta (`proposal_{proposalId}`)
- `proposalId` — referência direta à proposta

Entrada pode ter wallet diferente das parcelas (`downPaymentWallet`).

## Race conditions e guards (frontend)

- `updatingIdsRef` (Set) em `useFinancialData.ts` previne cliques duplos nos handlers: `updateTransactionStatus`, `updateTransaction`, `updateGroupStatus`
- `syncExtraCostsStatus()` está implementada tanto no frontend (otimismo) quanto no backend (autoridade)

## Guard: Proposta aprovada

Transações pagas vinculadas a propostas aprovadas **não podem** ser revertidas para pendente via UI. O backend rejeita a operação com erro explícito. Para reverter: primeiro reverter a proposta para rascunho.
