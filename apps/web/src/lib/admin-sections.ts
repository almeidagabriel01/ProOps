import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface AdminSection {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece tambem na dock / tab bar do superadmin. */
  inDock?: boolean;
}

/**
 * Secoes do painel do superadmin: fonte unica para as abas do topo do /admin e
 * para a dock/tab bar. Antes cada superficie tinha a propria lista e metade das
 * paginas (Faturamento, Analytics) so abria digitando a URL.
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin", label: "Empresas", icon: Building2, inDock: true },
  { href: "/admin/overview", label: "Visão geral", icon: LayoutDashboard, inDock: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/billing", label: "Faturamento", icon: CreditCard },
  { href: "/admin/observability", label: "Observabilidade", icon: Activity },
  { href: "/admin/audit", label: "Auditoria", icon: ScrollText },
  { href: "/admin/setup-mfa", label: "Segurança", icon: ShieldCheck },
];

/** Secao ativa: a de href mais longo que casa com o caminho atual. */
export function resolveActiveAdminSection(pathname: string): string | null {
  let best: string | null = null;
  for (const section of ADMIN_SECTIONS) {
    const matches = pathname === section.href || pathname.startsWith(`${section.href}/`);
    if (matches && (!best || section.href.length > best.length)) best = section.href;
  }
  return best;
}
