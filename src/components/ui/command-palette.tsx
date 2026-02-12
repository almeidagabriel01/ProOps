"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";

// Define searchable items with their icons and paths
interface SearchItem {
  id: string;
  label: string;
  description?: string;
  path: string;
  icon: React.ElementType;
  keywords?: string[];
  masterOnly?: boolean;
  requiresFinancial?: boolean;
  requiresCreate?: string; // pageId that requires create permission
}

const searchItems: SearchItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Visão geral do sistema",
    path: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["home", "início", "resumo", "visão geral"],
  },
  {
    id: "products",
    label: "Produtos",
    description: "Gerenciar catálogo de produtos",
    path: "/products",
    icon: Package,
    keywords: ["catálogo", "estoque", "itens", "mercadorias"],
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
    id: "proposals",
    label: "Propostas",
    description: "Gerenciar propostas comerciais",
    path: "/proposals",
    icon: FileText,
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
    path: "/financial",
    icon: ReceiptText,
    keywords: [
      "lancamentos",
      "lançamentos",
      "transacoes",
      "transações",
      "receitas",
      "despesas",
    ],
    requiresFinancial: true,
  },
  {
    id: "wallets",
    label: "Carteiras",
    description: "Gerenciar carteiras financeiras",
    path: "/financial/wallets",
    icon: WalletCards,
    keywords: ["carteira", "carteiras", "contas", "saldos"],
    requiresFinancial: true,
  },
  {
    id: "solutions",
    label: "Soluções",
    description: "Gerenciar soluções e templates",
    path: "/solutions",
    icon: Bot,
    keywords: ["solucoes", "soluções", "automacao", "automação", "templates"],
  },
  {
    id: "new-income",
    label: "Nova Receita",
    description: "Registrar uma nova receita",
    path: "/financial/new?type=income",
    icon: Wallet,
    keywords: ["adicionar", "entrada", "recebimento"],
    requiresFinancial: true,
    requiresCreate: "financial",
  },
  {
    id: "new-expense",
    label: "Nova Despesa",
    description: "Registrar uma nova despesa",
    path: "/financial/new?type=expense",
    icon: Wallet,
    keywords: ["adicionar", "saída", "pagamento"],
    requiresFinancial: true,
    requiresCreate: "financial",
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
  const { user } = useAuth();
  const { hasFinancial } = usePlanLimits();
  const { hasPermission } = usePermissions();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isMaster = user?.role === "admin";

  // Filter items based on search term and user permissions
  const filteredItems = React.useMemo(() => {
    return searchItems.filter((item) => {
      // Check permission restrictions
      if (item.masterOnly && !isMaster) return false;
      if (item.requiresFinancial && !hasFinancial) return false;
      // Check create permission if required
      if (item.requiresCreate && !hasPermission(item.requiresCreate, "create"))
        return false;

      // If no search term, don't show any results
      if (!searchTerm.trim()) return false;

      // Search in label, description, and keywords
      const term = searchTerm.toLowerCase();
      const matchesLabel = item.label.toLowerCase().includes(term);
      const matchesDescription = item.description?.toLowerCase().includes(term);
      const matchesKeywords = item.keywords?.some((k) =>
        k.toLowerCase().includes(term),
      );

      return matchesLabel || matchesDescription || matchesKeywords;
    });
  }, [searchTerm, isMaster, hasFinancial, hasPermission]);

  // Handle item selection
  const handleSelect = React.useCallback(
    (item: SearchItem) => {
      router.push(item.path);
      setIsOpen(false);
      setSearchTerm("");
      inputRef.current?.blur();
    },
    [router],
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
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
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
