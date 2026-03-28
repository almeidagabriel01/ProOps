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
  Home,
  CalendarDays,
} from "lucide-react";

export type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  pageId?: string;
  /** Overrides pageId for niche availability checks (isPageEnabledForNiche). Defaults to pageId. */
  availabilityPageId?: string;
  requiresFinancial?: boolean;
  requiresEnterprise?: boolean;
  masterOnly?: boolean;
  children?: SubMenuItem[];
};

export type SubMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  masterOnly?: boolean;
  pageId?: string;
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
    icon: Wallet,
    label: "Financeiro",
    href: "/transactions",
    pageId: "financial",
    requiresFinancial: true,
    children: [
      {
        icon: ReceiptText,
        label: "Lançamentos",
        href: "/transactions",
        pageId: "transactions",
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
