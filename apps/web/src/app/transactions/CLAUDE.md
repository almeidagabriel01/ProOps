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

**Filtros no endereço (2026-09-25)** não contrariam a regra acima: o endereço
não é persistência entre sessões, é o estado da página aberta. Voltar de um
lançamento ou recarregar devolve a lista como estava; trocar de aba continua
zerando o status. O padrão de cada filtro não aparece no endereço, e
`status=todos` é a escolha explícita de ver todos na Lista
(`_lib/filters-url.ts`). O tenant chegar depois do primeiro render não conta
como troca de empresa, senão o status do endereço seria apagado.
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

## Comissões aparecem aqui, e são despesas

Aprovar uma proposta com vendedor ou arquiteto gera, além das receitas, uma
**despesa de comissão por parceiro por parcela**, com o mesmo vencimento da
receita que ela espelha (`isCommission: true`, `category: "Comissao"`,
`clientId` apontando para o PARCEIRO). A regra completa vive no backend, em
`apps/functions/src/api/controllers/proposal-commissions.ts`.

Três consequências para esta pasta:

- Elas têm `proposalId`, então `isProposalLinkedTransaction` as considera
  ligadas a proposta — e isso é o certo: o valor vem do percentual da proposta,
  e editar direto aqui seria contornar a fonte. Para mudar, muda-se o
  percentual na proposta.
- Elas **não** têm `proposalGroupId`. Cada parceiro tem
  `installmentGroupId` próprio (`commission_{proposalId}_{contactId}_{role}`),
  então na aba Agrupados viram um card por parceiro em vez de entrar no card
  dos recebíveis do cliente — que somaria receita com despesa. Uma comissão
  única (proposta à vista) fica **avulsa**, sem grupo.
- A série é numerada **1..N sobre todas as receitas**, entrada inclusive. Não
  copie o `isInstallment` da receita espelhada: o card de grupo desta pasta só
  lista os membros marcados como parcela, então numa série mista a comissão da
  entrada desaparecia da lista e o total do cabeçalho deixava de bater com a
  soma das linhas.
- `getProposalTransactionDisplayName` não mexe na descrição delas: o prefixo
  legado que ele remove ("Entrada: ", "Parcela N/M: ", "Proposta: ") não casa
  com "Comissão Fulano: Título".
- A linha que espelha a entrada aparece como **"Entrada"**, não "Parcela 1/5".
  A estrutura continua sendo série (é o que faz o card listá-la), e só o rótulo
  diz o que ela é, espelhando o card de receita logo acima. Fonte única em
  `_lib/proposal-transaction.ts` (`getInstallmentLabel`), usada nas duas
  posições da lista de parcelas; guard em
  `_lib/__tests__/proposal-transaction.test.ts`.

O relatório por parceiro fica em `/commissions`, alimentado por
`GET /v1/transactions/commissions`. Ele é `masterOnly` no menu, mas **as
despesas de comissão continuam visíveis nesta lista** para quem tem permissão
de Lançamentos: escondê-las daqui exigiria filtrar a lista, e é decisão à parte.

## Exclusão com "Desfazer" e ações em massa (2026-09-25)

- **Excluir não grava na hora.** `deleteTransactionGroup` e
  `deleteTransactionsBulk` tiram as linhas da lista e ajustam as carteiras de
  forma otimista; o `DELETE` só vai ao servidor depois da janela do toast
  (`lib/undoable-action.ts`, 6s). "Desfazer" é um `fetchData(true)`: o servidor
  não mudou. Fechar a aba dentro da janela pede confirmação do navegador.
- **Aba Agrupados** lê resumos do servidor, que só mudam depois da gravação.
  Por isso a página guarda `pendingDeleteKeys` (`group:{id}` e `tx:{id}`) e
  filtra `visibleGroupSummaries`/`visibleStandalone`.
- **Ações em massa** (`_components/bulk-actions-bar.tsx`, regra pura em
  `_lib/bulk-actions.ts`): marcar como pago pelo `status-batch` (lotes de 200,
  o teto do backend), exportar `.xlsx` (exceljs por import dinâmico) e excluir
  (até 100, uma chamada por lançamento). A seleção também guarda ids de custo
  extra, que ficam de fora. Lançamento de proposta não é excluído em massa, pela
  mesma regra do diálogo individual. Toda ação que grava confirma com a
  contagem, porque a lista por vencimento começa com tudo selecionado.

## Categorias e DRE (2026-09-26)

- **A categoria virou lista da empresa**, cada uma num grupo do DRE (Receita
  bruta, Outras receitas, Impostos e deduções, Custos, Despesas operacionais,
  Outras despesas). O campo do formulário é
  `_components/form-steps/transaction-category-field.tsx`: busca separada por
  receita e despesa, e quem pode criar lançamento cria categoria digitando. O
  lançamento **continua guardando o nome** (`category`), então busca, cartão e
  exportação seguem iguais; um nome antigo fora da lista aparece e é gravado
  como está.
- A lista vem de `GET /v1/transactions/categories` (semeada no backend com as
  categorias que a empresa já usava) e fica guardada no módulo
  (`hooks/use-transaction-categories.ts`): formulário e DRE leem a mesma cópia.
- **O DRE é a rota `/dre`**, no grupo Financeiro, com o pageId de Lançamentos
  (quem vê lançamentos vê o resultado) e a capacidade `financial`. Caixa é o
  padrão; competência numa chave. Regra do cálculo no `apps/functions/CLAUDE.md`,
  seção DRE e categorias. A gestão das categorias (grupo, renomear, excluir)
  fica no botão "Categorias" da própria tela (`app/dre/_components/`).
- A conta free vê o DRE do tenant de demonstração pela API, e as categorias
  só para ver.

## Fluxo de caixa projetado (2026-09-26)

- **Rota `/cash-flow`**, no grupo Financeiro, com o pageId de Lançamentos e a
  capacidade `financial`, como o DRE. Lê do Firestore o saldo das carteiras
  ativas e os lançamentos em aberto (`TransactionService.getOpenTransactions`,
  com teto de 5.000), o mesmo caminho do Dashboard, então funciona na
  demonstração sem backend novo.
- **A conta é pura** (`lib/finance/cash-flow.ts`) e roda no navegador: mexer no
  cenário recalcula na hora. O cenário mexe só no que está a RECEBER (a
  porcentagem que entra e os dias de atraso); o que está a pagar entra inteiro,
  no vencimento; vencido dos dois lados conta como hoje. Padrões: pessimista
  80% e 30 dias, realista 95% e 15, otimista 100% no vencimento. O ajuste de
  cada pessoa fica no navegador dela (localStorage), não é dado da empresa.
- **Limite conhecido, o mesmo do Dashboard:** custo extra pendente de um
  lançamento já pago não entra, porque a consulta traz só lançamentos
  pendentes ou vencidos. Recorrência só entra quando os lançamentos dela já
  existem.

## Race conditions e guards (frontend)

- `updatingIdsRef` (Set) em `useFinancialData.ts` previne cliques duplos nos handlers: `updateTransactionStatus`, `updateTransaction`, `updateGroupStatus`
- `syncExtraCostsStatus()` está implementada tanto no frontend (otimismo) quanto no backend (autoridade)

## Guard: Proposta aprovada

Transações pagas vinculadas a propostas aprovadas **não podem** ser revertidas para pendente via UI. O backend rejeita a operação com erro explícito. Para reverter: primeiro reverter a proposta para rascunho.
