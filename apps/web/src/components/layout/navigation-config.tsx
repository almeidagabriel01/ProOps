import {
  Blocks,
  LayoutDashboard,
  Package2,
  Wrench,
  Contact,
  FilePenLine,
  Wallet,
  FileSpreadsheet,
  Bot,
  ReceiptText,
  WalletCards,
  Handshake,
  FileText,
  Home,
  CalendarDays,
  Kanban,
  HardHat,
  ListTodo,
  BarChart3,
  TrendingUp,
  Target,
  CalendarClock,
} from "lucide-react";

import type { NicheConfig } from "@/lib/niches/config-types";
import { cap } from "@/lib/niches/vocabulary";

/**
 * Capacidade de plano exigida por um item de menu. Os nomes são os mesmos do
 * catálogo do backend (`PlanCapabilityKey`), que é quem bloqueia de verdade.
 *
 * Substitui o par `requiresFinancial` / `requiresEnterprise`. `requiresEnterprise`
 * era lido em seis lugares (dock, tab bar, sheet, onboarding) e declarado em
 * NENHUM item — o caminho inteiro de coroa e upsell do Enterprise era código
 * morto, e o CRM não tinha entrada de menu alguma: só era alcançado pelo
 * command palette, por botões soltos ou por URL direta.
 */
export type MenuCapability =
  | "financial"
  | "crm"
  | "fiscal"
  | "projects"
  | "salesGoals"
  | "bookingLink";

/**
 * Quais capacidades o plano do tenant abre. Mora aqui, e não em
 * `capability-gate.ts`, porque as funções puras deste arquivo precisam dele e o
 * caminho contrário seria import circular: capability-gate já importa
 * MenuCapability daqui.
 */
export type MenuCapabilityMap = Record<MenuCapability, boolean>;

export type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  /**
   * Ausente num GRUPO: o destino depende de quem está olhando, porque um membro
   * pode ter permissão só para o segundo filho. Quem resolve é
   * `resolveGroupTarget`.
   */
  href?: string;
  pageId?: string;
  /** Overrides pageId for niche availability checks (isPageEnabledForNiche). Defaults to pageId. */
  availabilityPageId?: string;
  requiresCapability?: MenuCapability;
  masterOnly?: boolean;
  children?: SubMenuItem[];
};

export type SubMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  masterOnly?: boolean;
  /**
   * Abre a exceção do `masterOnly` para a conta de demonstração, que é MEMBER.
   * Só para tela de configuração que tem o que mostrar em somente leitura: o
   * Link de agendamento mostra o expediente padrão do nicho.
   */
  showInDemo?: boolean;
  pageId?: string;
  /**
   * Sobrepõe pageId na checagem de nicho, como em MenuItem. Ambientes divide o
   * pageId "solutions" com Soluções para a permissão, mas tem porta de nicho
   * própria: sem isto os dois sumiriam no nicho cortinas, onde
   * pageAvailability.solutions é false.
   */
  availabilityPageId?: string;
  /** Sobrepõe a capacidade do pai. Notas Fiscais é Enterprise; Lançamentos é Pro. */
  requiresCapability?: MenuCapability;
};

export const menuItems: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    pageId: "dashboard",
  },
  {
    icon: FilePenLine,
    label: "Propostas",
    // O caminho da venda: a proposta aprovada vira a obra. Projetos é tela de
    // acompanhamento, e com ícone próprio pesava na dock ao lado de Tarefas.
    // Sem capacidade no grupo: Propostas é de todo plano, Projetos coroa sozinho.
    children: [
      {
        icon: FilePenLine,
        label: "Propostas",
        href: "/proposals",
        pageId: "proposals",
      },
      {
        icon: HardHat,
        label: "Projetos",
        href: "/projects",
        pageId: "projects",
        requiresCapability: "projects",
      },
    ],
  },
  {
    icon: Kanban,
    label: "CRM",
    href: "/crm",
    pageId: "kanban",
    requiresCapability: "crm",
  },
  {
    icon: Wallet,
    label: "Financeiro",
    // Sem href e sem pageId: o destino sai de resolveGroupTarget, e "financial"
    // nunca foi um pageId de verdade (PERMISSION_PAGES tem transactions, wallet
    // e invoices). Ele era gravado em cada filho pelo achatamento antigo e
    // nenhuma superfície o lia.
    requiresCapability: "financial",
    children: [
      {
        icon: ReceiptText,
        label: "Lançamentos",
        href: "/transactions",
        pageId: "transactions",
      },
      {
        icon: WalletCards,
        label: "Carteiras",
        href: "/wallets",
        // pageId "wallet" no singular, a rota é plural. Já existe em
        // PERMISSION_PAGES e em PAGE_CONFIG: nenhuma chave nova.
        pageId: "wallet",
      },
      {
        icon: Handshake,
        label: "Comissões",
        href: "/commissions",
        // Mesmo pageId de Lançamentos: as comissões SÃO lançamentos, e uma
        // chave nova que a tela de Equipe não grave negaria todo mundo.
        // `masterOnly` porque o valor que cada parceiro recebe não é dado para
        // todo membro.
        pageId: "transactions",
        masterOnly: true,
      },
      {
        icon: BarChart3,
        label: "DRE",
        href: "/dre",
        // Mesmo pageId de Lançamentos: o DRE é um relatório sobre eles, e
        // quem vê os lançamentos vê o resultado (decisão do produto).
        pageId: "transactions",
      },
      {
        icon: TrendingUp,
        label: "Fluxo de caixa",
        href: "/cash-flow",
        // Projeção sobre os lançamentos em aberto: mesma permissão deles.
        pageId: "transactions",
      },
      {
        icon: FileText,
        label: "Notas Fiscais",
        href: "/invoices",
        pageId: "invoices",
        // Nota fiscal é Enterprise, o financeiro é Pro. Enquanto herdava a
        // capacidade do pai, um assinante Pro via "Notas Fiscais" sem coroa e
        // abria o módulo inteiro.
        requiresCapability: "fiscal",
      },
      {
        icon: Target,
        label: "Metas de vendas",
        href: "/goals",
        // Sem pageId: a meta é definida pelo dono, e o membro acompanha a dele
        // no Dashboard. A tela diz "Acesso Restrito" a quem abrir pela URL.
        masterOnly: true,
        // Pro, como o financeiro, mas é capacidade própria do catálogo: o
        // Starter com o add-on financeiro não tem metas.
        requiresCapability: "salesGoals",
      },
    ],
  },
  {
    icon: Contact,
    label: "Contatos",
    href: "/contacts",
    pageId: "clients",
  },
  {
    icon: CalendarDays,
    label: "Agenda",
    // O tempo da equipe: os compromissos, o que cada um tem a fazer e o link
    // em que o cliente pede a visita. Sem capacidade no grupo: Calendário e
    // Tarefas são de todo plano, o Link de agendamento coroa sozinho.
    children: [
      {
        icon: CalendarDays,
        label: "Calendário",
        href: "/calendar",
        pageId: "calendar",
      },
      {
        icon: ListTodo,
        label: "Tarefas",
        href: "/tasks",
        pageId: "tasks",
      },
      {
        icon: CalendarClock,
        label: "Link de agendamento",
        href: "/booking",
        // Sem pageId: o expediente é do dono. Os pedidos que chegam são
        // respondidos no Calendário, com a permissão dele.
        masterOnly: true,
        showInDemo: true,
        requiresCapability: "bookingLink",
      },
    ],
  },
  {
    icon: Blocks,
    label: "Catálogo",
    // As peças de que uma proposta é montada. São cadastros que alimentam a
    // proposta, não telas de uso diário, e ocupavam três ícones da dock.
    children: [
      {
        icon: Package2,
        label: "Produtos",
        href: "/products",
        pageId: "products",
      },
      { icon: Wrench, label: "Serviços", href: "/services", pageId: "services" },
      {
        icon: Bot,
        label: "Soluções",
        href: "/solutions",
        pageId: "solutions",
        // Explícito, embora seja o default, porque só lado a lado com o de
        // Ambientes fica claro por que os dois existem.
        availabilityPageId: "solutions",
      },
      {
        icon: Home,
        label: "Ambientes",
        href: "/ambientes",
        // Mesmo pageId de Soluções: é o mesmo escopo funcional, e um documento
        // de permissão gravado para "solutions" tem que gatear os dois.
        pageId: "solutions",
        // Mas porta de nicho própria: cortinas vê Ambientes, automação vê
        // Soluções, e nunca os dois. Sem isto os DOIS sumiriam em cortinas,
        // onde pageAvailability.solutions é false.
        availabilityPageId: "ambientes",
      },
    ],
  },
  {
    icon: FileSpreadsheet,
    label: "Planilhas",
    href: "/spreadsheets",
    pageId: "spreadsheets",
  },
];

/**
 * O rótulo que o nicho dá a um destino, ou `undefined` para manter o de
 * `menuItems`. Soluções e Ambientes falam do grupo e do local da proposta, que
 * mudam por nicho ("Sistemas" e "Áreas" em segurança).
 *
 * Um lugar só porque três superfícies precisam dizer o mesmo nome: a navegação
 * (`useNavigationItems`, que alimenta dock, tab bar e seletor de visão), o
 * tutorial (que herda o rótulo do menu) e a paleta de comandos.
 */
export function nicheMenuLabel(
  href: string,
  niche: Pick<NicheConfig, "vocabulary" | "solutionsPage">,
): string | undefined {
  if (href === "/solutions") return niche.solutionsPage.navigationLabel;
  if (href === "/ambientes") return cap(niche.vocabulary.place.plural);
  return undefined;
}

export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export function getVisibleChildren(
  item: MenuItem,
  isMaster: boolean,
): SubMenuItem[] {
  if (!item.children) return [];
  return item.children.filter((child) => {
    if (child.masterOnly) return isMaster;
    return true;
  });
}

/** O que o gate precisa saber de quem está olhando. */
export type NavigationViewer = {
  isMaster: boolean;
  isDemo: boolean;
  hasPermission: (pageId: string, action: "view") => boolean;
  /** `isPageEnabledForNiche` já ligado ao nicho do tenant. */
  isPageEnabled: (pageId?: string | null) => boolean;
};

/**
 * Os filhos de um grupo que esta pessoa pode ver.
 *
 * PERMISSÃO ANTES DE PLANO. A ordem inversa fazia o mesmo membro sem permissão
 * de `invoices` NÃO ver Notas Fiscais num tenant Enterprise, onde a capacidade
 * estava satisfeita e a checagem caía na permissão, e VER, coroada, num tenant
 * Pro, onde a capacidade faltava e a função devolvia cedo. Visibilidade oposta
 * conforme o tier, para a mesma pessoa, com o upsell aparecendo para quem não
 * poderia usar o módulo nem depois do upgrade.
 *
 * Plano NÃO filtra: item sem a capacidade permanece e quem o coroa é
 * `resolveCapabilityRestriction`, na dock e no seletor. Some por permissão,
 * nicho ou masterOnly, nunca por plano.
 */
export function filterVisibleChildren(
  item: MenuItem,
  viewer: NavigationViewer,
): SubMenuItem[] {
  return (item.children ?? []).filter((child) => {
    // availabilityPageId, não pageId: Ambientes divide "solutions" com Soluções
    // para a permissão, mas tem porta de nicho própria. Checando por pageId, os
    // dois sumiriam no nicho cortinas.
    const availKey = child.availabilityPageId ?? child.pageId;
    if (!viewer.isPageEnabled(availKey)) return false;
    if (child.masterOnly && !viewer.isMaster) {
      if (!(child.showInDemo && viewer.isDemo)) return false;
    }
    if (child.pageId && !viewer.isMaster && !viewer.isDemo) {
      if (!viewer.hasPermission(child.pageId, "view")) return false;
    }
    return true;
  });
}

/**
 * Colapsa um grupo em UM destino, para a dock desenhar um ícone só.
 *
 * `children` já chega filtrado por permissão, nicho e masterOnly: quem filtra é
 * `useNavigationItems`, em um lugar só. Refiltrar aqui recriaria os dois
 * critérios divergentes que já causaram "Notas Fiscais" visível para quem tinha
 * apenas `transactions.canView`.
 *
 * Devolve null quando não sobrou filho nenhum: o grupo some da dock.
 */
export function resolveGroupTarget(
  item: MenuItem,
  children: SubMenuItem[],
  capabilities: MenuCapabilityMap,
): { href: string; requiresCapability?: MenuCapability } | null {
  if (children.length === 0) return null;

  const effectiveCapability = (child: SubMenuItem) =>
    child.requiresCapability ?? item.requiresCapability;

  // O primeiro filho que o plano REALMENTE abre; se nenhum abre, o primeiro
  // visível. É o que faz um assinante Pro ver "Financeiro" sem coroa (ele tem
  // Lançamentos) enquanto "Notas Fiscais" segue coroada lá dentro, e o que
  // impede o upsell de empurrar Enterprise quando Pro já resolveria.
  const primary =
    children.find((child) => {
      const capability = effectiveCapability(child);
      return !capability || capabilities[capability];
    }) ?? children[0];

  return {
    href: primary.href,
    requiresCapability: effectiveCapability(primary),
  };
}

/**
 * Um item por DESTINO, grupo desmontado. É o que o onboarding quer: ele monta um
 * passo por rota (`ROUTE_STEP_TEMPLATES`), não por ícone da dock.
 */
export function flattenMenuItems(items: MenuItem[]): SubMenuItem[] {
  const leaves: SubMenuItem[] = [];

  for (const item of items) {
    if (item.children) {
      for (const child of item.children) {
        leaves.push({
          ...child,
          requiresCapability: child.requiresCapability ?? item.requiresCapability,
        });
      }
      continue;
    }
    // Item sem href e sem filhos não é destino nem grupo: não existe hoje, e se
    // passar a existir é erro de declaração, não algo para o onboarding montar.
    if (!item.href) continue;
    leaves.push({
      icon: item.icon,
      label: item.label,
      href: item.href,
      pageId: item.pageId,
      availabilityPageId: item.availabilityPageId,
      requiresCapability: item.requiresCapability,
      masterOnly: item.masterOnly,
    });
  }

  return leaves;
}
