import {
  CreditCard,
  FileText,
  FolderOpen,
  Hash,
  Link2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface SettingsNavItem {
  label: string;
  /** Rótulo curto usado abaixo de lg, onde os três itens dividem a largura. */
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
}

export interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

/**
 * As seções de `/settings`. Lida pela sidebar (`SettingsNav`) e pelo
 * onboarding, que precisa saber quais telas de configuração existem: com duas
 * listas, uma seção nova entraria só na sidebar e o tutorial nunca a mostraria.
 */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: "Conta",
    items: [
      { label: "Segurança", href: "/settings/security", icon: ShieldCheck },
    ],
  },
  {
    label: "Organização",
    items: [
      { label: "Equipe", href: "/settings/team", icon: Users },
      { label: "Propostas", href: "/settings/proposals", icon: Hash },
      {
        label: "Pagamento Online",
        shortLabel: "Pagamento",
        href: "/settings/payments",
        icon: CreditCard,
      },
      {
        label: "Notas Fiscais",
        shortLabel: "Notas",
        href: "/settings/fiscal",
        icon: FileText,
      },
      {
        label: "Google Drive",
        shortLabel: "Drive",
        href: "/settings/drive",
        icon: FolderOpen,
      },
      {
        label: "Contas vinculadas",
        shortLabel: "Contas",
        href: "/settings/linked-accounts",
        icon: Link2,
      },
    ],
  },
];

export function flattenSettingsNavItems(): SettingsNavItem[] {
  return SETTINGS_NAV_GROUPS.flatMap((group) => group.items);
}
