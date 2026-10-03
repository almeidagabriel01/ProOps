import {
  Bot,
  CalendarDays,
  CreditCard,
  FileSpreadsheet,
  HardHat,
  FileText,
  Handshake,
  Home,
  Kanban,
  LayoutDashboard,
  Link2,
  Package,
  ReceiptText,
  Settings,
  User,
  Users,
  UsersRound,
  Wallet,
  WalletCards,
  Wrench,
  ListTodo,
  BarChart3,
  TrendingUp,
  Target,
  CalendarClock,
  ClipboardList,
  ServerCog,
  FileSignature,
} from "lucide-react";

import {
  nicheMenuLabel,
  type MenuCapability,
} from "@/components/layout/navigation-config";
import type { NicheConfig } from "@/lib/niches/config-types";

/**
 * Os destinos que o command palette oferece.
 *
 * Vive fora do componente, sem "use client", para o guard de paridade poder
 * compará-los com os destinos do menu sem arrastar React nem Firebase. As duas
 * listas existem porque servem a coisas diferentes: o menu é hierarquia, e
 * agrupa; o palette é busca, e tem que ser plano, para quem digita "carteiras"
 * achar Carteiras. Diferentes de propósito não é o mesmo que divergentes: o
 * guard afirma que todo destino do menu está aqui.
 */

export interface SearchItem {
  id: string;
  label: string;
  description?: string;
  path: string;
  icon: React.ElementType;
  keywords?: string[];
  masterOnly?: boolean;
  requiresCapability?: MenuCapability;
  requiresCreate?: string; // pageId that requires create permission
  /** pageId cuja permissao de visualizacao e exigida para o destino aparecer. */
  requiresView?: string;

}

export const searchItems: SearchItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Visão geral do sistema",
    path: "/dashboard",
    icon: LayoutDashboard,
    requiresView: "dashboard",
    keywords: ["home", "início", "resumo", "visão geral"],
  },
  {
    id: "kanban",
    label: "CRM",
    description: "Visualização e gestão de processos",
    path: "/crm",
    icon: Kanban,
    requiresView: "kanban",
    keywords: ["quadro", "processos", "tarefas", "cartões", "crm", "kanban"],
    requiresCapability: "crm",
  },
  {
    id: "calendar",
    label: "Calendário",
    description: "Agenda de compromissos e visitas",
    path: "/calendar",
    icon: CalendarDays,
    requiresView: "calendar",
    keywords: [
      "calendario",
      "calendário",
      "agenda",
      "compromisso",
      "visita",
      "evento",
    ],
  },
  {
    id: "tasks",
    label: "Tarefas",
    description: "O que fazer, com responsável e prazo",
    path: "/tasks",
    icon: ListTodo,
    requiresView: "tasks",
    keywords: ["tarefa", "a fazer", "pendência", "lembrete", "responsável", "menção"],
  },
  {
    id: "booking",
    label: "Link de agendamento",
    description: "O cliente escolhe um horário livre e pede a visita",
    path: "/booking",
    icon: CalendarClock,
    masterOnly: true,
    requiresCapability: "bookingLink",
    keywords: ["agendamento", "agendar", "link", "horário", "visita", "expediente", "reserva"],
  },
  {
    id: "projects",
    label: "Projetos",
    description: "Obras de instalação e entregas",
    path: "/projects",
    icon: HardHat,
    requiresView: "projects",
    requiresCapability: "projects",
    keywords: ["projeto", "obra", "instalação", "entrega", "técnico"],
  },
  {
    id: "service-orders",
    label: "Ordens de serviço",
    description: "Chamados técnicos, com a assinatura do cliente",
    path: "/service-orders",
    icon: ClipboardList,
    requiresView: "service_orders",
    requiresCapability: "fieldService",
    keywords: ["ordem de serviço", "os", "chamado", "manutenção", "assistência", "técnico", "preventiva", "corretiva"],
  },
  {
    id: "equipment",
    label: "Equipamentos",
    description: "Aparelhos instalados nos clientes",
    path: "/equipment",
    icon: ServerCog,
    requiresView: "equipment",
    requiresCapability: "fieldService",
    keywords: ["equipamento", "aparelho", "garantia", "número de série", "parque instalado"],
  },
  {
    id: "contracts",
    label: "Contratos",
    description: "Mensalidades de manutenção e monitoramento",
    path: "/contracts",
    icon: FileSignature,
    requiresView: "contracts",
    requiresCapability: "fieldService",
    keywords: ["contrato", "mensalidade", "manutenção", "monitoramento", "recorrente", "pmoc", "preventiva"],
  },
  {
    id: "spreadsheets",
    label: "Planilhas",
    description: "Gerenciar planilhas",
    path: "/spreadsheets",
    icon: FileSpreadsheet,
    requiresView: "spreadsheets",
    keywords: ["planilha", "excel", "tabela", "dados"],
  },
  {
    id: "products",
    label: "Produtos",
    description: "Gerenciar catálogo de produtos",
    path: "/products",
    icon: Package,
    keywords: ["catálogo", "estoque", "itens", "mercadorias"],
    requiresView: "products",
  },
  {
    id: "services",
    label: "Serviços",
    description: "Gerenciar catálogo de serviços",
    path: "/services",
    icon: Wrench,
    keywords: ["serviço", "servicos", "mão de obra", "atividade"],
    requiresView: "services",
  },
  {
    id: "new-product",
    label: "Novo Produto",
    description: "Cadastrar um novo produto",
    path: "/products/new",
    icon: Package,
    keywords: ["adicionar", "criar", "cadastrar"],
    requiresCreate: "products",
  },
  {
    id: "new-service",
    label: "Novo Serviço",
    description: "Cadastrar um novo serviço",
    path: "/services/new",
    icon: Package,
    keywords: ["adicionar", "criar", "cadastrar", "serviço"],
    requiresCreate: "services",
  },
  {
    id: "proposals",
    label: "Propostas",
    description: "Gerenciar propostas comerciais",
    path: "/proposals",
    icon: FileText,
    requiresView: "proposals",
    keywords: ["orçamento", "proposta", "cotação", "vendas"],
  },
  {
    id: "new-proposal",
    label: "Nova Proposta",
    description: "Criar uma nova proposta",
    path: "/proposals/new",
    icon: FileText,
    keywords: ["adicionar", "criar", "orçamento"],
    requiresCreate: "proposals",
  },
  {
    id: "customers",
    label: "Contatos",
    description: "Gerenciar clientes e fornecedores",
    path: "/contacts",
    icon: UsersRound,
    keywords: ["cliente", "fornecedor", "contato", "empresa", "pessoa"],
    requiresView: "clients",
  },
  {
    id: "new-customer",
    label: "Novo Contato",
    description: "Cadastrar um novo contato",
    path: "/contacts/new",
    icon: UsersRound,
    keywords: ["adicionar", "criar", "cadastrar", "cliente", "fornecedor"],
    requiresCreate: "clients",
  },
  {
    id: "transactions",
    label: "Lançamentos",
    description: "Gerenciar lançamentos financeiros",
    path: "/transactions",
    icon: ReceiptText,
    requiresView: "transactions",
    keywords: [
      "transactions",
      "lancamentos",
      "lançamentos",
      "transacoes",
      "transações",
      "receitas",
      "despesas",
    ],
    requiresCapability: "financial",
  },
  {
    id: "invoices",
    label: "Notas Fiscais",
    description: "NF-e e NFS-e emitidas",
    icon: FileText,
    path: "/invoices",
    requiresCapability: "fiscal",
    requiresView: "invoices",
    keywords: ["nota", "notas", "fiscal", "nfe", "nfse", "danfe", "xml"],
  },
  {
    id: "dre",
    label: "DRE",
    description: "Quanto sobrou: receitas menos impostos, custos e despesas",
    path: "/dre",
    icon: BarChart3,
    requiresView: "transactions",
    requiresCapability: "financial",
    keywords: ["dre", "resultado", "lucro", "prejuizo", "prejuízo", "demonstrativo", "relatorio", "relatório", "categorias"],
  },
  {
    id: "cash-flow",
    label: "Fluxo de caixa",
    description: "Quanto vai ter em caixa nos próximos meses, em três cenários",
    path: "/cash-flow",
    icon: TrendingUp,
    requiresView: "transactions",
    requiresCapability: "financial",
    keywords: ["fluxo", "caixa", "projecao", "projeção", "previsao", "previsão", "saldo", "cenarios", "cenários"],
  },
  {
    id: "goals",
    label: "Metas de vendas",
    description: "A meta do mês da empresa e de cada pessoa da equipe",
    path: "/goals",
    icon: Target,
    masterOnly: true,
    requiresCapability: "salesGoals",
    keywords: ["meta", "metas", "objetivo", "vendas", "desempenho", "equipe"],
  },
  {
    id: "commissions",
    label: "Comissões",
    description: "Quanto pagar a cada vendedor e arquiteto no mês",
    path: "/commissions",
    icon: Handshake,
    // Mesmo pageId de Lançamentos: comissão é relatório sobre lançamento.
    requiresView: "transactions",
    requiresCapability: "financial",
    masterOnly: true,
    keywords: [
      "comissao",
      "comissões",
      "comissoes",
      "vendedor",
      "arquiteto",
      "parceiro",
    ],
  },
  {
    id: "wallets",
    label: "Carteiras",
    description: "Gerenciar carteiras financeiras",
    path: "/wallets",
    icon: WalletCards,
    requiresView: "wallet",
    keywords: ["carteira", "carteiras", "contas", "saldos"],
    requiresCapability: "financial",
  },
  {
    id: "solutions",
    label: "Soluções",
    description: "Gerenciar soluções e templates",
    path: "/solutions",
    icon: Bot,
    requiresView: "solutions",
    keywords: ["solucoes", "soluções", "automacao", "automação", "templates"],
  },
  {
    // Par de "solutions", como no menu: mesmo pageId de permissao, porta de
    // nicho propria. O filtro por id derruba um dos dois, nunca os dois.
    id: "ambientes",
    label: "Ambientes",
    description: "Gerenciar ambientes e produtos padrões",
    path: "/ambientes",
    icon: Home,
    requiresView: "solutions",
    keywords: ["ambiente", "ambientes", "espaco", "espaço", "comodo", "cômodo"],
  },
  {
    id: "new-income",
    label: "Nova Receita",
    description: "Registrar uma nova receita",
    path: "/transactions/new?type=income",
    icon: Wallet,
    keywords: ["adicionar", "entrada", "recebimento"],
    requiresCapability: "financial",
    requiresCreate: "transactions",
  },
  {
    id: "new-expense",
    label: "Nova Despesa",
    description: "Registrar uma nova despesa",
    path: "/transactions/new?type=expense",
    icon: Wallet,
    keywords: ["adicionar", "saída", "pagamento"],
    requiresCapability: "financial",
    requiresCreate: "transactions",
  },
  {
    id: "profile",
    label: "Perfil",
    description: "Configurações da conta",
    path: "/profile",
    icon: User,
    keywords: ["conta", "usuário", "minha conta"],
  },
  {
    id: "settings",
    label: "Configurações",
    description: "Configurações do sistema",
    path: "/settings",
    icon: Settings,
    keywords: ["opções", "preferências", "ajustes"],
  },
  {
    id: "team",
    label: "Equipe",
    description: "Gerenciar membros da equipe",
    path: "/settings/team",
    icon: Users,
    keywords: ["membros", "usuários", "time", "colaboradores"],
    masterOnly: true,
  },
  {
    id: "linked-accounts",
    label: "Contas vinculadas",
    description: "Integrações conectadas à empresa",
    path: "/settings/linked-accounts",
    icon: Link2,
    keywords: ["integrações", "google", "agenda", "drive", "asaas", "conectar", "reconectar"],
  },
  {
    id: "billing",
    label: "Plano e Cobrança",
    description: "Gerenciar seu plano",
    // /settings/billing e declarada em PAGE_CONFIG mas nao existe em disco:
    // o link dava 404. O destino real e a aba de faturamento do perfil.
    path: "/profile?tab=billing",
    icon: CreditCard,
    keywords: ["assinatura", "pagamento", "upgrade"],
    masterOnly: true,
  },
];

/**
 * `searchItems` com o texto do nicho. Soluções e Ambientes mudam de nome por
 * nicho ("Sistemas" e "Áreas" em segurança) e a paleta tem que dizer o mesmo
 * que o menu, então o rótulo sai de `nicheMenuLabel`, a mesma fonte da
 * navegação. O `id` fica: a paleta filtra por ele, e ele é a chave de nicho.
 */
export function searchItemsForNiche(
  niche: Pick<NicheConfig, "vocabulary" | "solutionsPage">,
): SearchItem[] {
  const { place, group } = niche.vocabulary;
  return searchItems.map((item) => {
    const label = nicheMenuLabel(item.path, niche);
    if (!label) return item;
    const isPlace = item.path === "/ambientes";
    const nicheTerm = isPlace ? place : group;
    return {
      ...item,
      label,
      description: isPlace
        ? `Gerenciar ${place.plural} e produtos padrões`
        : `Gerenciar ${group.plural} e templates`,
      keywords: [
        ...new Set([
          ...(item.keywords ?? []),
          nicheTerm.singular,
          nicheTerm.plural,
        ]),
      ],
    };
  });
}
