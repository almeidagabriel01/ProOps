import {
  LayoutDashboard,
  Package2,
  Wrench,
  Contact,
  FilePenLine,
  Wallet,
  FileSpreadsheet,
  Bot,
  ReceiptText,
  FileText,
  Home,
  CalendarDays,
  MessageCircle,
  Kanban,
} from "lucide-react";

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
export type MenuCapability = "financial" | "crm" | "fiscal";

export type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  pageId?: string;
  /** Overrides pageId for niche availability checks (isPageEnabledForNiche). Defaults to pageId. */
  availabilityPageId?: string;
  requiresCapability?: MenuCapability;
  /** Flag do TENANT (whatsappEnabled), não capacidade de plano — some por completo em vez de coroar. */
  requiresWhatsApp?: boolean;
  masterOnly?: boolean;
  /** Treat href as an external URL — render as <a target="_blank"> instead of <Link>. */
  external?: boolean;
  children?: SubMenuItem[];
};

export type SubMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  masterOnly?: boolean;
  pageId?: string;
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
    href: "/proposals",
    pageId: "proposals",
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
    href: "/transactions",
    pageId: "financial",
    requiresCapability: "financial",
    children: [
      {
        icon: ReceiptText,
        label: "Lançamentos",
        href: "/transactions",
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
    label: "Calendario",
    href: "/calendar",
    pageId: "calendar",
  },
  { icon: Package2, label: "Produtos", href: "/products", pageId: "products" },
  { icon: Wrench, label: "Serviços", href: "/services", pageId: "services" },
  {
    icon: FileSpreadsheet,
    label: "Planilhas",
    href: "/spreadsheets",
    pageId: "spreadsheets",
  },
  {
    icon: Bot,
    label: "Soluções",
    href: "/solutions",
    pageId: "solutions",
  },
  {
    icon: Home,
    label: "Ambientes",
    href: "/ambientes",
    // Use "solutions" as the pageId so MEMBER permission documents created for
    // "solutions" also gate the /ambientes page (same functional scope).
    // The niche availability in niches/config.ts controls which item is shown.
    pageId: "solutions",
    // But use "ambientes" for niche availability so cortinas sees this item
    // while automacao sees the /solutions item (which has solutions:true).
    availabilityPageId: "ambientes",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    // Resolved at runtime by useNavigationItems from the bot WhatsApp number.
    href: "",
    pageId: "whatsapp",
    requiresWhatsApp: true,
    external: true,
  },
];

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
