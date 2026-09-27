"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Crown, FileText, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import {
  resolveCapabilityRestriction,
  useMenuCapabilities,
} from "@/components/layout/capability-gate";
import { useUpgradeModal } from "@/components/ui/upgrade-modal";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { getNicheConfig, isPageEnabledForNiche } from "@/lib/niches/config";
import { normalize } from "@/utils/text";
import { useRecordSearch } from "@/hooks/use-record-search";
import {
  pushRecentRecord,
  readRecentRecords,
  type RecentRecord,
} from "@/lib/command-palette-recents";
import {
  searchItemsForNiche,
  type SearchItem,
} from "@/components/ui/command-palette-items";

/**
 * Uma linha da lista: destino do menu (página ou ação) ou registro (proposta,
 * contato). A navegação por teclado percorre as duas numa lista só.
 */
type PaletteEntry =
  | { type: "nav"; key: string; group: string; item: SearchItem }
  | { type: "record"; key: string; group: string; record: RecentRecord };

const RECORD_GROUP_LABEL: Record<RecentRecord["kind"], string> = {
  proposal: "Propostas",
  contact: "Contatos",
};

const RECORD_ICON: Record<RecentRecord["kind"], React.ElementType> = {
  proposal: FileText,
  contact: User,
};

// Abaixo de sm o painel ocupa a largura da tela menos o respiro, em vez dos
// 320px mínimos que vazavam para fora num celular.
const PANEL_CLASS =
  "absolute top-full left-0 mt-2 min-w-[320px] w-max max-w-[400px] max-sm:min-w-0 max-sm:w-[calc(100vw-2rem)] max-sm:max-w-none bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95";

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

interface CommandPaletteProps {
  className?: string;
}

export function CommandPalette({ className }: CommandPaletteProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const capabilities = useMenuCapabilities();
  const upgradeModal = useUpgradeModal();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [recents, setRecents] = React.useState<RecentRecord[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Vem do provider: normaliza MASTER/ADMIN/SUPERADMIN. Antes era
  // `user?.role === "admin"`, que e falso para o role realmente gravado
  // ("MASTER") — os itens masterOnly sumiam para o proprio master.
  const { hasPermission, isMaster } = usePermissions();

  React.useEffect(() => {
    setRecents(readRecentRecords(safeLocalStorage(), userId));
  }, [userId]);

  // Registros seguem a mesma permissão de visualização da página deles: quem
  // não vê propostas não as encontra pela busca.
  const { results: recordResults, isLoading: isSearchingRecords } =
    useRecordSearch(searchTerm, {
      tenantId: tenant?.id,
      canSearchProposals: hasPermission("proposals", "view"),
      canSearchContacts: hasPermission("clients", "view"),
    });

  const hasTerm = searchTerm.trim().length > 0;

  // Rótulos de Soluções e Ambientes no nome do nicho, iguais aos do menu.
  const nicheSearchItems = React.useMemo(
    () => searchItemsForNiche(getNicheConfig(tenant?.niche)),
    [tenant?.niche],
  );

  // Filter items based on search term and user permissions
  const filteredItems = React.useMemo(() => {
    return nicheSearchItems.filter((item) => {
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
      if (item.requiresCreate && !hasPermission(item.requiresCreate, "create"))
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
  }, [searchTerm, isMaster, hasPermission, tenant?.niche, nicheSearchItems]);

  const entries = React.useMemo<PaletteEntry[]>(() => {
    if (!hasTerm) {
      return recents.map((record) => ({
        type: "record" as const,
        key: `recent-${record.kind}-${record.id}`,
        group: "Recentes",
        record,
      }));
    }
    return [
      ...filteredItems.map((item) => ({
        type: "nav" as const,
        key: `nav-${item.id}`,
        group: "Páginas e ações",
        item,
      })),
      ...recordResults.map((record) => ({
        type: "record" as const,
        key: `${record.kind}-${record.id}`,
        group: RECORD_GROUP_LABEL[record.kind],
        record,
      })),
    ];
  }, [hasTerm, recents, filteredItems, recordResults]);

  const closePalette = React.useCallback(() => {
    setIsOpen(false);
    setSearchTerm("");
    inputRef.current?.blur();
  }, []);

  // Handle item selection
  const handleSelect = React.useCallback(
    (entry: PaletteEntry) => {
      closePalette();

      if (entry.type === "record") {
        setRecents(pushRecentRecord(safeLocalStorage(), userId, entry.record));
        router.push(entry.record.path);
        return;
      }

      const { item } = entry;
      const { restricted, requiredPlan, description } =
        resolveCapabilityRestriction(item.requiresCapability, capabilities);
      if (restricted) {
        upgradeModal.showUpgradeModal(item.label, description, requiredPlan);
        return;
      }

      router.push(item.path);
    },
    [router, capabilities, upgradeModal, closePalette, userId],
  );

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < entries.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : entries.length - 1));
      } else if (e.key === "Enter" && entries[selectedIndex]) {
        e.preventDefault();
        handleSelect(entries[selectedIndex]);
      } else if (e.key === "Escape") {
        closePalette();
      }
    },
    [isOpen, entries, selectedIndex, handleSelect, closePalette],
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

  // Reset selected index when the list changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [entries.length]);

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <div className="relative w-40 max-w-full sm:w-56 md:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Buscar... (Ctrl+K)"
          aria-label="Buscar páginas, propostas e contatos"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 h-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
        />
      </div>

      {/* Dropdown Results */}
      {isOpen && entries.length > 0 && (
        <div className={PANEL_CLASS}>
          <div className="max-h-[360px] overflow-y-auto py-1">
            {entries.map((entry, index) => {
              const isSelected = index === selectedIndex;
              const showGroup =
                index === 0 || entries[index - 1].group !== entry.group;
              const Icon =
                entry.type === "nav"
                  ? entry.item.icon
                  : hasTerm
                    ? RECORD_ICON[entry.record.kind]
                    : Clock;
              const label =
                entry.type === "nav" ? entry.item.label : entry.record.label;
              const description =
                entry.type === "nav"
                  ? entry.item.description
                  : entry.record.description;
              const restricted =
                entry.type === "nav" &&
                resolveCapabilityRestriction(
                  entry.item.requiresCapability,
                  capabilities,
                ).restricted;

              return (
                <React.Fragment key={entry.key}>
                  {showGroup && (
                    <div className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {entry.group}
                    </div>
                  )}
                  <button
                    onClick={() => handleSelect(entry)}
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
                        <span className="font-medium text-sm truncate">
                          {label}
                        </span>
                        {restricted && (
                          <Crown
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-label="Requer upgrade de plano"
                          />
                        )}
                      </div>
                      {description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {description}
                        </div>
                      )}
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
            {hasTerm && isSearchingRecords && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader size="sm" variant="button" />
                Buscando propostas e contatos...
              </div>
            )}
          </div>
          <div className="hidden sm:flex border-t border-border px-3 py-2 text-xs text-muted-foreground items-center gap-2">
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

      {/* Searching, nothing yet */}
      {isOpen && hasTerm && entries.length === 0 && isSearchingRecords && (
        <div className={PANEL_CLASS}>
          <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader size="sm" variant="button" />
            Buscando...
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && hasTerm && entries.length === 0 && !isSearchingRecords && (
        <div className={PANEL_CLASS}>
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
