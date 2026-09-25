// Dashboard Components Barrel Export
export { FinancialMetricCards, AlertsCard } from "./metric-cards";
export { RecentTransactionsList, RecentProposalsList } from "./recent-lists";
export { QuickActionsCard, ProposalStatsCard, ClientsStatsCard } from "./stats-cards";
export { WalletsGrid } from "./wallets-grid";
export { MonthStats } from "./month-stats";
export { CommissionsPanel } from "./commissions-panel";
// FutureBalanceChart fica fora do barrel: a página o importa sob demanda
// (Recharts), e reexportá-lo aqui o colocaria no bundle de quem usa o barrel.
