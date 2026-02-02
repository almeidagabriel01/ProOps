import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Wallet,
  Shield,
  FileSpreadsheet,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  pageId?: string;
  requiresFinancial?: boolean;
  masterOnly?: boolean;
  children?: SubMenuItem[];
};

export type SubMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  masterOnly?: boolean;
};

// ============================================
// MENU CONFIGURATION
// ============================================

export const menuItems: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    pageId: "dashboard",
  },
  { icon: Package, label: "Produtos", href: "/products", pageId: "products" },
  {
    icon: FileText,
    label: "Propostas",
    href: "/proposals",
    pageId: "proposals",
  },
  {
    icon: Users,
    label: "Contatos",
    href: "/contacts",
    pageId: "clients",
  },
  {
    icon: FileSpreadsheet,
    label: "Planilhas",
    href: "/spreadsheets",
  },
  {
    icon: Wallet,
    label: "Financeiro",
    href: "/financial",
    pageId: "financial",
    requiresFinancial: true,
    children: [
      {
        icon: FileText,
        label: "Lançamentos",
        href: "/financial",
      },
      {
        icon: Wallet,
        label: "Carteiras",
        href: "/financial/wallets",
      },
    ],
  },
  {
    icon: Shield,
    label: "Equipe",
    href: "/settings/team",
    pageId: "team",
    masterOnly: true,
  },
];

// ============================================
// DIMENSIONS
// ============================================

export const COLLAPSED_WIDTH = 72;
export const EXPANDED_WIDTH = 300;

// ============================================
// UTILITIES
// ============================================

/**
 * Lighten a hex color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/**
 * Get visible children for a menu item based on user role
 */
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
