"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
  Crown,
  Users,
  Wallet,
  WalletCards,
  ReceiptText,
  Bot,
  User,
  Settings,
  CreditCard,
  UsersRound,
  Search,
  Kanban,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  resolveCapabilityRestriction,
  useMenuCapabilities,
} from "@/components/layout/capability-gate";
import type { MenuCapability } from "@/components/layout/navigation-config";
import { useUpgradeModal } from "@/components/ui/upgrade-modal";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  getSolutionsPageConfig,
  isPageEnabledForNiche,
} from "@/lib/niches/config";
import { normalize } from "@/utils/text";

// Define searchable items with their icons and paths
interface SearchItem {
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

const searchItems: SearchItem[] = [
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
    icon: Package,
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
    id: "billing",
    label: "Plano e Cobrança",
    description: "Gerenciar seu plano",
    path: "/settings/billing",
    icon: CreditCard,
    keywords: ["assinatura", "pagamento", "upgrade"],
    masterOnly: true,
  },
];

interface CommandPaletteProps {
  className?: string;
}

export function CommandPalette({ className }: CommandPaletteProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const capabilities = useMenuCapabilities();
  const upgradeModal = useUpgradeModal();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Vem do provider: normaliza MASTER/ADMIN/SUPERADMIN. Antes era
  // `user?.role === "admin"`, que e falso para o role realmente gravado
  // ("MASTER") — os itens masterOnly sumiam para o proprio master.
  const { hasPermission, isMaster } = usePermissions();

  // Filter items based on search term and user permissions
  const filteredItems = React.useMemo(() => {
    const solutionsConfig = getSolutionsPageConfig(tenant?.niche);

    return searchItems
      .map((item) => {
        if (item.id !== "solutions") return item;

        return {
          ...item,
          label: solutionsConfig.navigationLabel,
          description:
            solutionsConfig.mode === "environment"
              ? "Gerenciar ambientes e produtos padrões"
              : item.description,
          keywords:
            solutionsConfig.mode === "environment"
              ? [...(item.keywords || []), "ambiente", "ambientes"]
              : item.keywords,
        };
      })
      .filter((item) => {
        // Check permission restrictions
        if (!isPageEnabledForNiche(tenant?.niche, item.id)) return false;
        if (item.masterOnly && !isMaster) return false;
        // Módulo sem plano NÃO some daqui: aparece coroado e o clique abre o
        // upgrade, igual à dock. Enquanto o palette escondia e a dock coroava,
        // o mesmo módulo tinha dois comportamentos opostos — e quem buscasse
        // "financeiro" recebia "nada encontrado", sem saber que o recurso
        // existe e é vendido.
        // Destino de navegacao: exige a mesma permissao de visualizacao que a
        // dock e a guarda de rota exigem. Sem isto o palette era rota de fuga.
        if (item.requiresView && !hasPermission(item.requiresView, "view"))
          return false;
        // Check create permission if required
        if (
          item.requiresCreate &&
          !hasPermission(item.requiresCreate, "create")
        )
          return false;

        // If no search term, don't show any results
        if (!searchTerm.trim()) return false;

        // Search in label, description, and keywords
        const term = normalize(searchTerm.trim());
        const matchesLabel = normalize(item.label).includes(term);
        const matchesDescription = item.description
          ? normalize(item.description).includes(term)
          : false;
        const matchesKeywords = item.keywords?.some((k) =>
          normalize(k).includes(term),
        );

        return matchesLabel || matchesDescription || matchesKeywords;
      });
  }, [searchTerm, isMaster, hasPermission, tenant?.niche]);

  // Handle item selection
  const handleSelect = React.useCallback(
    (item: SearchItem) => {
      setIsOpen(false);
      setSearchTerm("");
      inputRef.current?.blur();

      const { restricted, requiredPlan, description } =
        resolveCapabilityRestriction(item.requiresCapability, capabilities);
      if (restricted) {
        upgradeModal.showUpgradeModal(item.label, description, requiredPlan);
        return;
      }

      router.push(item.path);
    },
    [router, capabilities, upgradeModal],
  );

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1,
        );
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setSearchTerm("");
        inputRef.current?.blur();
      }
    },
    [isOpen, filteredItems, selectedIndex, handleSelect],
  );

  // Global keyboard shortcut (Cmd/Ctrl + K)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected index when filtered items change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative w-40 sm:w-56 md:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Buscar... (Ctrl+K)"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (e.target.value.trim() && !isOpen) {
              setIsOpen(true);
            } else if (!e.target.value.trim()) {
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (searchTerm.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="pl-9 h-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
        />
      </div>

      {/* Dropdown Results */}
      {isOpen && filteredItems.length > 0 && (
        <div className="absolute top-full left-0 mt-2 min-w-[320px] w-max max-w-[400px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95">
          <div className="max-h-[300px] overflow-y-auto py-1">
            {filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              const { restricted } = resolveCapabilityRestriction(
                item.requiresCapability,
                capabilities,
              );

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                >
                  <div className="shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">{item.label}</span>
                      {restricted && (
                        <Crown
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          aria-label="Requer upgrade de plano"
                        />
                      )}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd>
            <span>para navegar</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-2">
              Enter
            </kbd>
            <span>para selecionar</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-2">
              Esc
            </kbd>
            <span>para fechar</span>
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && searchTerm.trim() && filteredItems.length === 0 && (
        <div className="absolute top-full left-0 mt-2 min-w-[320px] w-max max-w-[400px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-4 py-8 text-center">
            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum resultado encontrado para &quot;{searchTerm}&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
