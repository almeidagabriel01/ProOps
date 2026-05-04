# CLAUDE.md — src/app/dashboard/

## Propósito

O Dashboard é a tela inicial do sistema após o login. Exibe um resumo executivo do negócio em tempo real: saldo financeiro, alertas de vencimentos, fluxo de caixa projetado, balanço futuro, estatísticas de propostas e clientes, e atividade recente.

Toda a rota é um Client Component (`'use client'`) porque depende de hooks de estado (`useDashboardData`, `useAuth`, `useTenant`).

---

## Fontes de Dados

O hook `useDashboardData` (`src/hooks/useDashboardData.ts`) é a única fonte de dados do dashboard. Ele executa **6 chamadas em paralelo** via `Promise.all` ao montar o componente:

| Service | Método | O que traz |
|---------|--------|------------|
| `TransactionService` | `getTransactions(tenantId)` | Todos os lançamentos do tenant |
| `TransactionService` | `getSummary(tenantId)` | Resumo financeiro agregado (totalIncome, totalExpense, pendentes) |
| `ProposalService` | `getProposals(tenantId)` | Todas as propostas |
| `ClientService` | `getClients(tenantId)` | Todos os clientes |
| `WalletService` | `getWallets(tenantId)` | Carteiras ativas |
| `KanbanService` | `getStatuses(tenantId)` | Colunas do kanban para calcular stats de proposta |

Todos os services estão em `src/services/`. Chamam o proxy `/api/backend/*` que encaminha para Cloud Functions.

### Dados brutos vs. computados

O hook separa claramente dados brutos de computações derivadas:

```
rawData (useState)
  ├── transactions[]
  ├── proposals[]
  ├── clients[]
  ├── wallets[]
  └── kanbanColumns[]

computed (useMemo sobre rawData)
  ├── chartData          — receitas/despesas dos próximos 6 meses
  ├── futureBalances     — projeção mensal para 12 meses
  ├── currentMonthStats  — breakdown por categoria e carteira (mês atual)
  ├── proposalStats      — aprovadas/pendentes/total/taxa de conversão
  ├── overdueTransactions — lançamentos com status "overdue"
  ├── upcomingDue        — lançamentos pendentes vencendo em até 7 dias
  ├── newClientsThisMonth
  ├── recentTransactions — últimas 5
  ├── recentProposals    — últimas 5
  └── balance            — soma dos saldos das carteiras ativas
```

### Lógica de projeção de caixa

- **Fluxo de Caixa** (6 meses): agrupa receitas e despesas pelo mês efetivo — para lançamentos `paid`, usa a data de pagamento real (`paidAt` > `updatedAt` > `date`); para pendentes, usa `dueDate`.
- **Balanço Futuro** (12 meses): considera apenas lançamentos **não pagos** com `dueDate` definido. O primeiro mês parte do saldo real atual das carteiras; os demais acumulam o delta de entradas e saídas previstas.

### Estatísticas de propostas

Usa as colunas do kanban para mapear o status dinâmico de cada proposta:
- `category === "won"` (ou legacy `status === "approved"`) → aprovada
- `category === "open"` (ou legacy `status === "sent" | "in_progress"`) → pendente
- Taxa de conversão exclui rascunhos (`status !== "draft"`) do denominador.

---

## Componentes Visuais

### Layout geral

```
page.tsx (DashboardPage)
  ├── Header (saudação + saldo atual)
  ├── AlertsCard
  ├── QuickActionsCard
  ├── Grid 2 colunas (Charts)
  │   ├── SimpleBarChart — Fluxo de Caixa (6 meses)
  │   └── FutureBalanceChart — Balanço Futuro (3/6/12 meses)
  ├── Grid 2 colunas
  │   ├── RecentProposalsList — últimas 5 propostas
  │   └── MonthStats — breakdown do mês atual
  ├── Grid 2 colunas (Stats)
  │   ├── ProposalStatsCard — donut chart de propostas
  │   └── ClientsStatsCard — total e novos clientes
  └── RecentTransactionsList — últimas 5 transações
```

### Componentes locais (`_components/`)

| Arquivo | Componentes exportados | Descrição |
|---------|------------------------|-----------|
| `metric-cards.tsx` | `FinancialMetricCards`, `AlertsCard` | Cards financeiros e alertas de vencimento |
| `future-balance-chart.tsx` | `FutureBalanceChart` | LineChart (Recharts) com seletor de período (3/6/12 meses) |
| `month-stats.tsx` | `MonthStats` | Barra de progresso por categoria + movimentação por carteira |
| `recent-lists.tsx` | `RecentTransactionsList`, `RecentProposalsList` | Listas de atividade recente |
| `stats-cards.tsx` | `QuickActionsCard`, `ProposalStatsCard`, `ClientsStatsCard` | Ações rápidas e estatísticas com PieChart (Recharts) |
| `wallets-grid.tsx` | `WalletsGrid` | Grade de carteiras (exportado no barrel mas não usado em `page.tsx` atualmente) |
| `dashboard-skeleton.tsx` | `DashboardSkeleton` | Skeleton de carregamento completo da página |
| `index.ts` | barrel export | Re-exporta todos os componentes acima |

### Bibliotecas de gráficos

- **Recharts** — todos os gráficos do dashboard usam Recharts:
  - `SimpleBarChart` (em `src/components/charts/simple-bar-chart.tsx`) — BarChart para fluxo de caixa
  - `LineChart` dentro de `FutureBalanceChart` — projeção de balanço
  - `PieChart` / `Pie` dentro de `ProposalStatsCard` — distribuição de propostas (donut)

---

## Performance e Carregamento

### Estado de loading

Enquanto o tenant ou os dados carregam, `page.tsx` renderiza `<DashboardSkeleton />`. O hook aguarda `isTenantLoading` terminar antes de disparar qualquer fetch.

### Cancelamento de requisições

O `useEffect` de fetch usa um flag `cancelled` para descartar resultados de requisições que completaram após a desmontagem do componente ou após o tenant mudar.

### ResizeObserver em gráficos

`FutureBalanceChart` usa `ResizeObserver` com debounce de 150ms para adaptar as dimensões do `LineChart` ao container. Isso evita re-renders excessivos durante resize.

### Atenção com volumes grandes

O dashboard busca **todos** os lançamentos e **todas** as propostas do tenant de uma vez. Para tenants com grande volume, isso pode ser lento. Se a performance se tornar problema, considerar:
1. Adicionar filtro de período nas chamadas a `getTransactions` e `getProposals`
2. Mover as computações pesadas para o backend (endpoint de summary)

---

## Permissões e Acesso

- A página não bloqueia acesso por role — qualquer usuário autenticado vê o dashboard.
- `QuickActionsCard` usa `usePagePermission` para mostrar apenas os atalhos que o usuário pode criar (`canCreate`). Membros sem permissão de criação em proposals/transactions/clients/products não veem os respectivos cards de ação rápida.
- O módulo financeiro (`hasFinancial`) é verificado via `usePlanLimits` — se o plano não incluir financeiro, o atalho de "Novo Lançamento" fica oculto.
- Superadmin sem tenant selecionado vê `<SelectTenantState />` em vez do dashboard.

---

## Arquivos-chave

| Caminho | Responsabilidade |
|---------|-----------------|
| `src/app/dashboard/page.tsx` | Orquestrador da página — layout e passagem de props |
| `src/app/dashboard/_components/` | Todos os componentes visuais do dashboard |
| `src/hooks/useDashboardData.ts` | Hook central — fetch paralelo + computações derivadas |
| `src/components/charts/simple-bar-chart.tsx` | BarChart de fluxo de caixa (Recharts) |
| `src/services/transaction-service.ts` | `getTransactions`, `getSummary` |
| `src/services/proposal-service.ts` | `getProposals` |
| `src/services/client-service.ts` | `getClients` |
| `src/services/wallet-service.ts` | `getWallets` |
| `src/services/kanban-service.ts` | `getStatuses`, `getDefaultProposalColumns` |

---

## Casos especiais

- **Superadmin**: se `user.role === "superadmin"` e não houver `tenant` selecionado, exibe `<SelectTenantState />`.
- **ExtraCosts em transações**: o hook itera sobre `transaction.extraCosts` para incluí-los nos cálculos de fluxo de caixa e balanço futuro, usando o mesmo tipo (`income`/`expense`) do lançamento pai.
- **Wallet name vs. ID** (ver CLAUDE.md raiz): `MonthStats` agrupa por `entry.wallet` que pode ser name ou ID. Isso é exibição, então o impacto visual é baixo — mas ao exibir a lista de movimentação por carteira, o header do item pode aparecer como ID em dados pós-migração de abril/2025.
