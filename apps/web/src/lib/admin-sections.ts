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
}

/**
 * Seções do painel do superadmin: fonte única da dock (desktop) e da tab bar
 * do celular, onde elas aparecem igual a qualquer módulo do ERP.
 *
 * Antes existia também uma barra de abas no topo do /admin. Com as seções na
 * dock, ela duplicava a navegação e ocupava uma faixa inteira da tela no
 * celular, então saiu.
 *
 * A ORDEM importa no celular: a tab bar mostra as 4 primeiras e manda o resto
 * para o "Mais" (`VISIBLE_TABS` em `mobile-tab-bar.tsx`). As quatro primeiras
 * são as de uso diário E têm rótulo curto: a 360px cada aba tem ~72px, e
 * "Observabilidade" sairia cortado ali, então ela fica no "Mais".
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin", label: "Empresas", icon: Building2 },
  { href: "/admin/overview", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/audit", label: "Auditoria", icon: ScrollText },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/observability", label: "Observabilidade", icon: Activity },
  { href: "/admin/billing", label: "Faturamento", icon: CreditCard },
  { href: "/admin/setup-mfa", label: "Segurança", icon: ShieldCheck },
];
