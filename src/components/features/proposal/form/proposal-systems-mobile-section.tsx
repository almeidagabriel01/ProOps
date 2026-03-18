"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { Ambiente, ProposalSistema, Sistema } from "@/types/automation";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import { SistemaSelectorProps } from "@/components/features/automation/sistema-selector";
import { SystemEnvironmentManagerDialog } from "@/components/features/automation/system-environment-manager-dialog";
import { useWindowFocus } from "@/hooks/use-window-focus";
import { getPrimaryAmbiente } from "@/lib/sistema-migration-utils";
import { compareDisplayText } from "@/lib/sort-text";
import {
  migrateDraftHideZeroQtyStateToProposal,
  readProposalHideZeroQtyState,
  writeProposalHideZeroQtyState,
} from "@/lib/proposal-hide-zero-qty-storage";
import {
  Box,
  Cpu,
  Layers3,
  Package,
  PencilLine,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  MobileDisclosure,
  MobileEmptyState,
  MobileMetric,
  MobilePanel,
  formatCurrency,
} from "./mobile/shared";

interface ProposalSystemsMobileSectionProps {
  selectedSistemas: ProposalSistema[];
  selectedProducts: ProposalProduct[];
  products: Array<Product | Service>;
  primaryColor: string;
  selectorKey: number;
  onRemoveSystem: (index: number, systemInstanceId: string) => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProductToSystem: (
    product: Product | Service,
    sistemaIndex: number,
    systemInstanceId: string,
  ) => void;
  onAddNewSystem: (sistema: ProposalSistema) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  SistemaSelectorComponent: React.ComponentType<SistemaSelectorProps>;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  onDataUpdate?: () => void;
  ambientes?: Ambiente[];
  sistemas?: Sistema[];
  onAmbienteAction?: (action: MasterDataAction) => void;
  onSistemaAction?: (action: MasterDataAction) => void;
  onRemoveAmbiente: (sistemaIndex: number, ambienteId: string) => void;
  proposalStorageKey?: string;
}

type ProductKind = "product" | "service";

const MOBILE_DIALOG_SHEET_CLASSNAME =
  "dialog-scroll-fix left-[50%] top-[50%] z-50 flex box-border w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-border/70 p-0 sm:w-full sm:max-h-[min(90vh,720px)] sm:max-w-lg";

function AdaptiveSheetBody({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = React.useState(false);

  React.useEffect(() => {
    const viewportNode = viewportRef.current;
    const contentNode = contentRef.current;
    if (!viewportNode || !contentNode) return;

    const measure = () => {
      setHasOverflow(contentNode.scrollHeight > viewportNode.clientHeight + 10);
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    resizeObserver.observe(viewportNode);
    resizeObserver.observe(contentNode);
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  return (
    <div
      ref={viewportRef}
      className={`dialog-scroll-fix min-h-0 w-full flex-1 overscroll-y-contain px-4 py-2.5 ${
        hasOverflow ? "overflow-y-auto scrollbar-none" : "overflow-y-visible"
      }`}
    >
      <div ref={contentRef} className="w-full space-y-2.5">
        {children}
      </div>
    </div>
  );
}

export function ProposalSystemsMobileSection({
  selectedSistemas,
  selectedProducts,
  products,
  primaryColor,
  selectorKey,
  onRemoveSystem,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onAddExtraProductToSystem,
  onAddNewSystem,
  onRemoveProduct,
  SistemaSelectorComponent,
  onToggleStatus,
  onDataUpdate,
  ambientes,
  sistemas,
  onAmbienteAction,
  onSistemaAction,
  onRemoveAmbiente,
  proposalStorageKey,
}: ProposalSystemsMobileSectionProps) {
  const [activeSystemKey, setActiveSystemKey] = React.useState<string | null>(null);
  const [isAddSystemOpen, setIsAddSystemOpen] = React.useState(false);
  const [isManagerOpen, setIsManagerOpen] = React.useState(false);
  const [hideZeroQtyByEnvironment, setHideZeroQtyByEnvironment] =
    React.useState<Record<string, boolean>>({});
  const previousSystemKeysRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    if (proposalStorageKey) {
      migrateDraftHideZeroQtyStateToProposal(proposalStorageKey);
    }
  }, [proposalStorageKey]);

  React.useEffect(() => {
    setHideZeroQtyByEnvironment(readProposalHideZeroQtyState(proposalStorageKey));
  }, [proposalStorageKey]);

  const handleToggleHideZeroQtyByEnvironment = React.useCallback(
    (environmentInstanceId: string, hideZeroQty: boolean) => {
      setHideZeroQtyByEnvironment((prev) => {
        const next = { ...prev };
        if (hideZeroQty) next[environmentInstanceId] = true;
        else delete next[environmentInstanceId];
        writeProposalHideZeroQtyState(next, proposalStorageKey);
        return next;
      });
    },
    [proposalStorageKey],
  );

  useWindowFocus(() => {
    onDataUpdate?.();
  });

  const validInstanceIds = React.useMemo(() => {
    const ids = new Set<string>();
    selectedSistemas.forEach((sistema) => {
      getSystemAmbientes(sistema).forEach((ambiente) => {
        ids.add(getEnvironmentInstanceId(sistema, ambiente.ambienteId));
      });
    });
    return ids;
  }, [selectedSistemas]);

  const visibleProducts = React.useMemo(
    () =>
      selectedProducts.filter(
        (product) =>
          product.systemInstanceId &&
          validInstanceIds.has(product.systemInstanceId),
      ),
    [selectedProducts, validInstanceIds],
  );

  const totalValue = visibleProducts.reduce((sum, product) => sum + product.total, 0);
  const totalProfit = visibleProducts.reduce((sum, product) => {
    if ((product.itemType || "product") === "service") return sum;
    return sum + product.unitPrice * product.quantity * ((product.markup || 0) / 100);
  }, 0);
  const totalItems = visibleProducts.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0,
  );
  const systemKeys = React.useMemo(
    () => selectedSistemas.map((sistema, index) => getSystemKey(sistema, index)),
    [selectedSistemas],
  );

  React.useEffect(() => {
    const lastSystemKey = systemKeys[systemKeys.length - 1] ?? null;
    const hasNewSystem = Boolean(
      lastSystemKey && !previousSystemKeysRef.current.includes(lastSystemKey),
    );

    setActiveSystemKey((current) => {
      if (hasNewSystem) return lastSystemKey;
      if (current && systemKeys.includes(current)) return current;
      return systemKeys[0] ?? null;
    });

    previousSystemKeysRef.current = systemKeys;
  }, [systemKeys]);

  const systemSummaries = React.useMemo<SystemSummary[]>(
    () =>
      selectedSistemas.map((sistema, sistemaIndex) => {
        const key = getSystemKey(sistema, sistemaIndex);
        const environments = getSystemAmbientes(sistema).map((ambiente) => {
          const environmentKey = getEnvironmentInstanceId(
            sistema,
            ambiente.ambienteId,
          );
          const environmentProducts = selectedProducts
            .filter((product) => product.systemInstanceId === environmentKey)
            .sort((a, b) => compareDisplayText(a.productName, b.productName));
          const hideZeroQty = !!hideZeroQtyByEnvironment[environmentKey];
          const visibleEnvironmentProducts = hideZeroQty
            ? environmentProducts.filter(
                (product) => Number(product.quantity || 0) !== 0,
              )
            : environmentProducts;

          return {
            key: environmentKey,
            ambienteId: ambiente.ambienteId || "",
            title: ambiente.ambienteName || "Ambiente",
            description: ambiente.description,
            selectedProducts: environmentProducts,
            visibleProducts: visibleEnvironmentProducts,
            hiddenProductsCount:
              environmentProducts.length - visibleEnvironmentProducts.length,
            totalValue: environmentProducts.reduce(
              (sum, product) => sum + product.total,
              0,
            ),
            totalItems: environmentProducts.reduce(
              (sum, product) => sum + (product.quantity || 0),
              0,
            ),
            activeLines: environmentProducts.filter(
              (product) => product.status !== "inactive",
            ).length,
            visibleQuantity: visibleEnvironmentProducts.reduce(
              (sum, product) => sum + (product.quantity || 0),
              0,
            ),
            hideZeroQty,
          };
        });

        const systemProducts = environments.flatMap(
          (environment) => environment.selectedProducts,
        );

        return {
          key,
          sistema,
          sistemaIndex,
          title: sistema.sistemaName,
          description: sistema.description,
          environments,
          selectedProducts: systemProducts,
          totalValue: systemProducts.reduce((sum, product) => sum + product.total, 0),
          totalItems: systemProducts.reduce(
            (sum, product) => sum + (product.quantity || 0),
            0,
          ),
          activeLines: systemProducts.filter(
            (product) => product.status !== "inactive",
          ).length,
          visibleLines: environments.reduce(
            (sum, environment) => sum + environment.visibleProducts.length,
            0,
          ),
        };
      }),
    [hideZeroQtyByEnvironment, selectedProducts, selectedSistemas],
  );

  const activeSystemSummary = React.useMemo(
    () =>
      systemSummaries.find((summary) => summary.key === activeSystemKey) ??
      systemSummaries[0] ??
      null,
    [activeSystemKey, systemSummaries],
  );

  const totalEnvironmentCount = systemSummaries.reduce(
    (sum, system) => sum + system.environments.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MobileMetric
          label="Solucoes"
          value={`${selectedSistemas.length}`}
          hint="solucoes configuradas"
          accent="sky"
        />
        <MobileMetric
          label="Ambientes"
          value={`${totalEnvironmentCount}`}
          hint={`${totalItems} item(ns) em edicao`}
          accent="emerald"
        />
        <MobileMetric
          label="Valor"
          value={formatCurrency(totalValue)}
          hint={`${formatCurrency(totalProfit)} de lucro`}
          accent="amber"
          className="col-span-2"
        />
      </div>

      <MobilePanel
        title="Solucoes da proposta"
        description="Selecione a solucao ativa e abra apenas o ambiente que precisa editar."
        icon={Cpu}
        tone="accent"
        bodyClassName="space-y-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-foreground [overflow-wrap:anywhere]">
              {activeSystemSummary
                ? `${activeSystemSummary.title} / ${activeSystemSummary.environments.length} ambiente(s)`
                : "Adicione a primeira solucao para comecar a estruturar a proposta."}
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              Todas as acoes do desktop continuam disponiveis dentro de cada ambiente.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:w-[230px]">
            <Button
              type="button"
              className="min-h-11 rounded-2xl"
              onClick={() => setIsAddSystemOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar solucao
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-2xl"
              onClick={() => setIsManagerOpen(true)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Gerenciar base
            </Button>
          </div>
        </div>

        {selectedSistemas.length === 0 ? (
          <MobileEmptyState
            title="Nenhuma solucao adicionada"
            description="Abra o seletor para adicionar sistemas com ambientes e montar a automacao sem poluir a interface."
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border/60 bg-background/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Solucoes
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha a solucao para abrir a estrutura completa dela logo abaixo.
                  </p>
                </div>
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {selectedSistemas.length} ativa(s)
                </span>
              </div>

              <div className="-mx-1 mt-4 overflow-x-auto pb-1">
                <div className="flex gap-2 px-1">
                  {systemSummaries.map((system, index) => {
                    const isActive = system.key === activeSystemSummary?.key;

                    return (
                      <button
                        key={system.key}
                        type="button"
                        onClick={() => setActiveSystemKey(system.key)}
                        className={`min-h-[124px] min-w-[228px] shrink-0 rounded-[26px] border px-4 py-3 text-left transition-all ${
                          isActive
                            ? "shadow-[0_24px_60px_-38px_rgba(15,23,42,0.48)]"
                            : "border-border/60 bg-background/75"
                        }`}
                        style={
                          isActive
                            ? {
                                borderColor: `${primaryColor}42`,
                                background: `linear-gradient(145deg, ${primaryColor}16, rgba(255,255,255,0.95) 78%)`,
                              }
                            : undefined
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                isActive
                                  ? "bg-white/85 text-slate-700"
                                  : "bg-background text-muted-foreground"
                              }`}
                            >
                              Solucao {index + 1}
                            </span>
                            <p className="mt-2 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                              {system.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                              {system.environments.length} ambiente(s) / {system.activeLines} linha(s) ativa(s)
                            </p>
                          </div>

                          {isActive ? (
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                              style={{ backgroundColor: `${primaryColor}18` }}
                            >
                              <Cpu className="h-4 w-4" style={{ color: primaryColor }} />
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <MetricChip label="Qtd" value={`${system.totalItems}`} />
                          <MetricChip
                            label="Valor"
                            value={formatCurrency(system.totalValue)}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
                <MetricChip
                  label="Linhas ativas"
                  value={`${activeSystemSummary?.activeLines ?? 0}`}
                />
                <MetricChip
                  label="Ambientes"
                  value={`${activeSystemSummary?.environments.length ?? 0}`}
                />
                <MetricChip
                  label="Valor da solucao"
                  value={formatCurrency(activeSystemSummary?.totalValue ?? 0)}
                  className="col-span-2"
                />
              </div>
            </div>

            {activeSystemSummary ? (
              <SystemWorkspace
                system={activeSystemSummary}
                productsCatalog={products}
                primaryColor={primaryColor}
                onToggleHideZeroQty={handleToggleHideZeroQtyByEnvironment}
                onRemoveSystem={() =>
                  onRemoveSystem(
                    activeSystemSummary.sistemaIndex,
                    `${activeSystemSummary.sistema.sistemaId}-${getPrimaryAmbiente(activeSystemSummary.sistema)?.ambienteId || ""}`,
                  )
                }
                onUpdateProductQuantity={onUpdateProductQuantity}
                onUpdateProductMarkup={onUpdateProductMarkup}
                onUpdateProductPrice={onUpdateProductPrice}
                onAddExtraProductToSystem={onAddExtraProductToSystem}
                onRemoveProduct={onRemoveProduct}
                onToggleStatus={onToggleStatus}
                onRemoveAmbiente={onRemoveAmbiente}
              />
            ) : null}
          </div>
        )}
      </MobilePanel>

      <Dialog open={isAddSystemOpen} onOpenChange={setIsAddSystemOpen}>
        <DialogContent
          variant="sheet"
          className={MOBILE_DIALOG_SHEET_CLASSNAME}
          hideCloseButton
          allowOverflow
        >
          <div className="flex w-full max-h-full min-h-0 flex-1 flex-col overflow-visible">
            <div className="border-b border-border/60 px-4 pb-2.5 pt-2">
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border/70 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <DialogHeader className="min-w-0 text-left">
                  <DialogTitle className="text-base">Adicionar solucao</DialogTitle>
                  <DialogDescription className="[overflow-wrap:anywhere]">
                    Escolha sistema e ambiente sem sair do fluxo mobile.
                  </DialogDescription>
                </DialogHeader>
                <button
                  type="button"
                  onClick={() => setIsAddSystemOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 w-full flex-1 overflow-visible px-4 py-2.5">
              <div className="w-full space-y-2.5">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
                  <MetricChip label="Solucoes" value={`${selectedSistemas.length}`} />
                  <MetricChip
                    label="Ambientes"
                    value={`${totalEnvironmentCount}`}
                  />
                  <MetricChip
                    label="Valor atual"
                    value={formatCurrency(totalValue)}
                    className="col-span-2"
                  />
                </div>

                <div className="rounded-[24px] border border-border/60 bg-background/75 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-700 dark:text-sky-300">
                      <Box className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Inserir nova solucao
                      </p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                        Adicione a combinacao de sistema e ambiente para continuar a configuracao.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <SistemaSelectorComponent
                      key={selectorKey}
                      onChange={(value) => {
                        if (!value) return;
                        onAddNewSystem(value);
                        setIsAddSystemOpen(false);
                      }}
                      onDataUpdate={onDataUpdate}
                      resetAmbienteAfterSelect={true}
                      onAmbienteAction={onAmbienteAction}
                      onSistemaAction={onSistemaAction}
                      sistemas={sistemas}
                      ambientes={ambientes}
                      selectedSistemas={selectedSistemas}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SystemEnvironmentManagerDialog
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onDataChange={() => onDataUpdate?.()}
        sistemas={sistemas}
        ambientes={ambientes}
        onAction={async (action) => {
          if (action.entity === "ambiente" && onAmbienteAction) {
            onAmbienteAction(action);
            return;
          }
          if (onSistemaAction) onSistemaAction(action);
        }}
        allowDelete={false}
      />
    </div>
  );
}

interface EnvironmentSummary {
  key: string;
  ambienteId: string;
  title: string;
  description?: string;
  selectedProducts: ProposalProduct[];
  visibleProducts: ProposalProduct[];
  hiddenProductsCount: number;
  totalValue: number;
  totalItems: number;
  activeLines: number;
  visibleQuantity: number;
  hideZeroQty: boolean;
}

interface SystemSummary {
  key: string;
  sistema: ProposalSistema;
  sistemaIndex: number;
  title: string;
  description?: string;
  environments: EnvironmentSummary[];
  selectedProducts: ProposalProduct[];
  totalValue: number;
  totalItems: number;
  activeLines: number;
  visibleLines: number;
}

interface SystemWorkspaceProps {
  system: SystemSummary;
  primaryColor: string;
  productsCatalog: Array<Product | Service>;
  onToggleHideZeroQty: (environmentKey: string, checked: boolean) => void;
  onRemoveSystem: () => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProductToSystem: (
    product: Product | Service,
    sistemaIndex: number,
    systemInstanceId: string,
  ) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  onRemoveAmbiente: (sistemaIndex: number, ambienteId: string) => void;
}

function SystemWorkspace({
  system,
  primaryColor,
  productsCatalog,
  onToggleHideZeroQty,
  onRemoveSystem,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onAddExtraProductToSystem,
  onRemoveProduct,
  onToggleStatus,
  onRemoveAmbiente,
}: SystemWorkspaceProps) {
  return (
    <div
      className="overflow-hidden rounded-[28px] border bg-card shadow-[0_18px_60px_-42px_rgba(15,23,42,0.45)]"
      style={{ borderColor: `${primaryColor}33` }}
    >
      <div
        className="border-b px-4 py-4"
        style={{
          borderColor: `${primaryColor}22`,
          background: `linear-gradient(135deg, ${primaryColor}14, transparent 72%)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${primaryColor}18` }}
          >
            <Cpu className="h-5 w-5" style={{ color: primaryColor }} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Solucao em foco
                </p>
                <p className="mt-1 text-base font-semibold leading-6 text-foreground [overflow-wrap:anywhere]">
                  {system.title}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                  {system.description || "Sem descricao cadastrada."}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-2xl border-destructive/20 text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive sm:shrink-0"
                onClick={onRemoveSystem}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover solucao
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{
              borderColor: `${primaryColor}30`,
              color: primaryColor,
              backgroundColor: `${primaryColor}12`,
            }}
          >
            {system.environments.length} ambiente(s)
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
          <MetricChip label="Ambientes" value={`${system.environments.length}`} />
          <MetricChip label="Linhas ativas" value={`${system.activeLines}`} />
          <MetricChip
            label="Valor final"
            value={formatCurrency(system.totalValue)}
            className="col-span-2"
          />
          <MetricChip
            label="Quantidade"
            value={`${system.totalItems} unidade(s)`}
            className="col-span-2"
          />
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-background/90">
              <Layers3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Ambientes
              </p>
              <p className="text-sm text-muted-foreground">
                Abra o ambiente para revisar itens e ajustes
              </p>
            </div>
          </div>
        </div>

        {system.environments.length > 0 ? (
          <div className="space-y-4">
            {system.environments.map((environment, index) => (
              <EnvironmentWorkspace
                key={environment.key}
                environment={environment}
                environmentIndex={index}
                system={system}
                primaryColor={primaryColor}
                productsCatalog={productsCatalog}
                onToggleHideZeroQty={(checked) =>
                  onToggleHideZeroQty(environment.key, checked)
                }
                onDeleteEnvironment={() =>
                  onRemoveAmbiente(system.sistemaIndex, environment.ambienteId)
                }
                onUpdateProductQuantity={(productId, delta, itemType) =>
                  onUpdateProductQuantity(productId, delta, environment.key, itemType)
                }
                onUpdateProductMarkup={(productId, markup, itemType) =>
                  onUpdateProductMarkup(productId, markup, environment.key, itemType)
                }
                onUpdateProductPrice={(productId, newPrice, itemType) =>
                  onUpdateProductPrice(productId, newPrice, environment.key, itemType)
                }
                onRemoveProduct={(productId, itemType) =>
                  onRemoveProduct(productId, environment.key, itemType)
                }
                onAddExtraProduct={(product) =>
                  onAddExtraProductToSystem(
                    product,
                    system.sistemaIndex,
                    environment.key,
                  )
                }
                onToggleStatus={onToggleStatus}
              />
            ))}
          </div>
        ) : (
          <MobileEmptyState
            title="Nenhum ambiente disponivel"
            description="Adicione um ambiente a esta solucao para liberar a edicao de itens."
          />
        )}
      </div>
    </div>
  );
}

function MetricChip({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/60 bg-background/70 px-3 py-2 ${className ?? ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

interface EnvironmentWorkspaceProps {
  system: SystemSummary;
  environment: EnvironmentSummary;
  environmentIndex: number;
  primaryColor: string;
  productsCatalog: Array<Product | Service>;
  onToggleHideZeroQty: (checked: boolean) => void;
  onDeleteEnvironment: () => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    price: number,
    itemType?: "product" | "service",
  ) => void;
  onRemoveProduct: (
    productId: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProduct: (product: Product | Service) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}

function EnvironmentWorkspace({
  system,
  environment,
  environmentIndex,
  primaryColor,
  productsCatalog,
  onToggleHideZeroQty,
  onDeleteEnvironment,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onAddExtraProduct,
  onToggleStatus,
}: EnvironmentWorkspaceProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);

  return (
    <>
      <MobileDisclosure
        title={environment.title}
        description={
          environment.description || `Ambiente ${environmentIndex + 1} de ${system.title}`
        }
        meta={formatCurrency(environment.totalValue)}
        className="rounded-[24px] shadow-[0_18px_50px_-38px_rgba(15,23,42,0.28)]"
      >
        <div className="flex flex-wrap gap-2">
          <MetricChip label="Linhas" value={`${environment.selectedProducts.length}`} />
          <MetricChip label="Qtd visivel" value={`${environment.visibleQuantity}`} />
          <MetricChip label="Valor" value={formatCurrency(environment.totalValue)} />
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-border/60 bg-background/68 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <span
                className="rounded-full border bg-background/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ borderColor: `${primaryColor}24`, color: primaryColor }}
              >
                {system.title}
              </span>
              <span className="rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {environment.activeLines} linha(s) ativa(s)
              </span>
            </div>

            <p className="text-sm text-foreground [overflow-wrap:anywhere]">
              {environment.hideZeroQty
                ? environment.hiddenProductsCount > 0
                  ? `${environment.hiddenProductsCount} item(ns) com quantidade zero ocultos.`
                  : "Nenhum item com quantidade zero oculto."
                : "Todos os itens aparecem nesta visualizacao."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Ocultar qtd. 0
            </span>
            <Switch
              checked={environment.hideZeroQty}
              onCheckedChange={onToggleHideZeroQty}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {environment.visibleProducts.length === 0 ? (
            <MobileEmptyState
              title={
                environment.selectedProducts.length > 0 && environment.hideZeroQty
                  ? "Itens com quantidade zero ocultos"
                  : "Sem itens neste ambiente"
              }
              description={
                environment.selectedProducts.length > 0 && environment.hideZeroQty
                  ? "Desative o filtro para revisar todos os itens deste ambiente."
                  : "Adicione produtos ou servicos extras para completar este ambiente."
              }
            />
          ) : (
            environment.visibleProducts.map((product, index) => (
              <ProductActionRow
                key={`${environment.key}-${product.productId}-${index}`}
                product={product}
                systemName={system.title}
                environmentName={environment.title}
                environmentInstanceId={environment.key}
                onUpdateProductQuantity={onUpdateProductQuantity}
                onUpdateProductMarkup={onUpdateProductMarkup}
                onUpdateProductPrice={onUpdateProductPrice}
                onRemoveProduct={onRemoveProduct}
                onToggleStatus={onToggleStatus}
              />
            ))
          )}
        </div>

        <div className="mt-4 rounded-[22px] border border-dashed border-border/70 bg-background/70 p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Item extra
              </p>
              <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
                Adicione produtos ou servicos extras somente neste ambiente.
              </p>
            </div>

            <Button
              type="button"
              className="min-h-11 rounded-2xl"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar item
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full rounded-2xl border-destructive/20 text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={onDeleteEnvironment}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remover ambiente
          </Button>
        </div>
      </MobileDisclosure>

      <AddExtraItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        productsCatalog={productsCatalog}
        selectedProducts={environment.selectedProducts}
        onAddExtraProduct={onAddExtraProduct}
      />
    </>
  );
}

interface ProductActionRowProps {
  product: ProposalProduct;
  systemName: string;
  environmentName: string;
  environmentInstanceId: string;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    price: number,
    itemType?: "product" | "service",
  ) => void;
  onRemoveProduct: (
    productId: string,
    itemType?: "product" | "service",
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}

function ProductActionRow({
  product,
  systemName,
  environmentName,
  environmentInstanceId,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onToggleStatus,
}: ProductActionRowProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [priceValue, setPriceValue] = React.useState(String(product.unitPrice || 0));
  const [markupValue, setMarkupValue] = React.useState(String(product.markup || 0));

  const itemType = (product.itemType || "product") as ProductKind;
  const isService = itemType === "service";
  const isActive = product.status !== "inactive";
  const isExtra = !!product.isExtra;
  const finalUnitPrice = isService
    ? product.unitPrice || 0
    : (product.unitPrice || 0) * (1 + (product.markup || 0) / 100);

  React.useEffect(() => {
    if (!isDialogOpen) {
      setPriceValue(String(product.unitPrice || 0));
      setMarkupValue(String(product.markup || 0));
    }
  }, [isDialogOpen, product.markup, product.unitPrice]);

  const applyFinancialChanges = () => {
    const parsedPrice = parseNumberInput(priceValue, product.unitPrice || 0);
    const parsedMarkup = parseNumberInput(markupValue, product.markup || 0);

    if (parsedPrice !== product.unitPrice) {
      onUpdateProductPrice(product.productId, parsedPrice, itemType);
    }

    if (!isService && parsedMarkup !== (product.markup || 0)) {
      onUpdateProductMarkup(product.productId, parsedMarkup, itemType);
    }

    setIsDialogOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className={`w-full rounded-[24px] border p-3.5 text-left transition-all ${
          isExtra
            ? "border-sky-500/25 bg-sky-500/8"
            : "border-border/60 bg-card"
        } ${!isActive ? "opacity-75" : ""}`}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {product.productImage || product.productImages?.[0] ? (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[20px] border border-border/60 bg-background/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.productImages?.[0] || product.productImage}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border/60 bg-background/80">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                    isService
                      ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {isService ? "Servico" : "Produto"}
                </span>
                {isExtra ? (
                  <span className="rounded-full bg-sky-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-sky-700 dark:text-sky-300">
                    Extra
                  </span>
                ) : null}
                {!isActive ? (
                  <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-300">
                    Oculto no PDF
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="break-words text-[15px] font-semibold leading-5 text-foreground">
                  {product.productName}
                </p>
                {product.productDescription ? (
                  <p className="mt-1 text-sm leading-5 text-muted-foreground break-words">
                    {product.productDescription}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InlinePill label="Qtd" value={`${product.quantity}`} />
            <InlinePill
              label="Preco"
              value={formatCurrency(product.unitPrice || 0)}
            />
            {!isService ? (
              <InlinePill
                label="Markup"
                value={`${Number(product.markup || 0).toFixed(0)}%`}
              />
            ) : (
              <InlinePill label="Tipo" value="Servico" />
            )}
            <InlinePill label="Total" value={formatCurrency(product.total)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-background/60 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Ambiente
              </p>
              <p className="break-words text-sm font-medium text-foreground">
                {environmentName}
              </p>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <PencilLine className="h-3.5 w-3.5" />
              Editar item
            </span>
          </div>
        </div>
      </button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          variant="sheet"
          className={MOBILE_DIALOG_SHEET_CLASSNAME}
          hideCloseButton
        >
          <div className="flex w-full max-h-full min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-border/60 px-4 pb-2.5 pt-2">
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border/70 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <DialogHeader className="min-w-0 text-left">
                  <DialogTitle className="text-base [overflow-wrap:anywhere]">
                    {product.productName}
                  </DialogTitle>
                  <DialogDescription className="[overflow-wrap:anywhere]">
                    {systemName} / {environmentName}
                  </DialogDescription>
                </DialogHeader>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AdaptiveSheetBody>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
                  <MetricChip label="Preco base" value={formatCurrency(product.unitPrice)} />
                  <MetricChip label="Total atual" value={formatCurrency(product.total)} />
                  <MetricChip
                    label="Valor unitario final"
                    value={formatCurrency(finalUnitPrice)}
                    className="col-span-2"
                  />
                </div>

                <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Visibilidade no PDF
                      </p>
                      <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
                        {isActive
                          ? "Item ativo e visivel na proposta."
                          : "Item oculto no PDF, mas mantido para edicao."}
                      </p>
                    </div>
                    {onToggleStatus ? (
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                          onToggleStatus(
                            product.productId,
                            checked ? "active" : "inactive",
                            environmentInstanceId,
                            itemType,
                          )
                        }
                      />
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Quantidade
                  </p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-2xl"
                      onClick={() =>
                        onUpdateProductQuantity(product.productId, -1, itemType)
                      }
                    >
                      <span className="text-lg">-</span>
                    </Button>
                    <div className="min-w-0 flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 text-center text-base font-semibold">
                      {product.quantity}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-2xl"
                      onClick={() =>
                        onUpdateProductQuantity(product.productId, 1, itemType)
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Preco base
                    </p>
                    <Input
                      value={priceValue}
                      onChange={(event) => setPriceValue(event.target.value)}
                      className="mt-2.5 h-11 rounded-2xl"
                      inputMode="decimal"
                    />
                  </div>

                  <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Markup
                    </p>
                    <Input
                      value={markupValue}
                      disabled={isService}
                      onChange={(event) => setMarkupValue(event.target.value)}
                      className="mt-2.5 h-11 rounded-2xl"
                      inputMode="decimal"
                      suffix={<span className="text-xs">%</span>}
                    />
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {isService
                        ? "Servicos usam somente o preco informado."
                        : "Markup define o lucro aplicado sobre o custo base."}
                    </p>
                  </div>
                </div>
            </AdaptiveSheetBody>

            <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 pb-3.5 pt-2.5 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 w-full rounded-2xl sm:w-auto"
                  onClick={() => {
                    onRemoveProduct(product.productId, itemType);
                    setIsDialogOpen(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover item
                </Button>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full rounded-2xl sm:w-auto"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11 w-full rounded-2xl sm:w-auto"
                    onClick={applyFinancialChanges}
                  >
                    Salvar ajustes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InlinePill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="rounded-[18px] border border-border/60 bg-background/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {label}: <span className="normal-case text-foreground">{value}</span>
    </span>
  );
}

function AddExtraItemDialog({
  open,
  onOpenChange,
  productsCatalog,
  selectedProducts,
  onAddExtraProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productsCatalog: Array<Product | Service>;
  selectedProducts: ProposalProduct[];
  onAddExtraProduct: (product: Product | Service) => void;
}) {
  const [filter, setFilter] = React.useState<"all" | ProductKind>("all");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);

  React.useEffect(() => {
    if (!open) {
      setFilter("all");
      setSearch("");
    }
  }, [open]);

  const availableItems = React.useMemo(() => {
    const selectedIds = new Set(
      selectedProducts.map(
        (product) => `${product.itemType || "product"}:${product.productId}`,
      ),
    );
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return productsCatalog
      .filter((product) => {
        const productKey = `${product.itemType || "product"}:${product.id}`;
        if (selectedIds.has(productKey)) return false;
        if (filter !== "all" && (product.itemType || "product") !== filter) {
          return false;
        }
        if (!normalizedSearch) return true;

        return (
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.category?.toLowerCase().includes(normalizedSearch) ||
          product.description?.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => compareDisplayText(a.name, b.name));
  }, [deferredSearch, filter, productsCatalog, selectedProducts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="sheet"
        className={MOBILE_DIALOG_SHEET_CLASSNAME}
        hideCloseButton
      >
        <div className="flex w-full max-h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border/60 px-4 pb-2.5 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border/70 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <DialogHeader className="min-w-0 text-left">
                <DialogTitle className="text-base">Adicionar item extra</DialogTitle>
                <DialogDescription>
                  Selecione um item do catalogo para este ambiente.
                </DialogDescription>
              </DialogHeader>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Fechar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <AdaptiveSheetBody>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Tudo" },
                  { value: "product", label: "Produtos" },
                  { value: "service", label: "Servicos" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value as "all" | ProductKind)}
                    className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-medium transition-all ${
                      filter === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background/75 text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, categoria ou descricao"
                icon={<Search className="h-4 w-4" />}
              />

              {availableItems.length === 0 ? (
                <MobileEmptyState
                  title="Nenhum item disponivel"
                  description="Todos os itens compativeis ja foram adicionados ou o filtro atual nao encontrou resultados."
                />
              ) : (
                <div className="space-y-2 pb-2">
                  {availableItems.map((product) => {
                    const itemType = (product.itemType || "product") as ProductKind;
                    return (
                      <button
                        key={`${itemType}-${product.id}`}
                        type="button"
                        onClick={() => {
                          onAddExtraProduct(product);
                          onOpenChange(false);
                        }}
                        className="w-full rounded-[22px] border border-border/60 bg-card p-3 text-left transition-all hover:border-primary/35 hover:bg-primary/5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/80">
                            <Layers3 className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
                                  {product.name}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                                  {itemType === "service" ? "Servico" : "Produto"}
                                  {product.category ? ` / ${product.category}` : ""}
                                </p>
                              </div>

                              <span className="shrink-0 text-sm font-semibold text-foreground">
                                {formatCurrency(Number(product.price))}
                              </span>
                            </div>

                            {product.description ? (
                              <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                                {product.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
          </AdaptiveSheetBody>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getSystemAmbientes(sistema: ProposalSistema) {
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema.ambientes;
  }

  return [
    {
      ambienteId: sistema.ambienteId || "",
      ambienteName: sistema.ambienteName || "Ambiente",
      description: undefined,
      products: sistema.products || [],
    },
  ];
}

function getEnvironmentInstanceId(sistema: ProposalSistema, ambienteId?: string) {
  return `${sistema.sistemaId}-${ambienteId || ""}`;
}

function getSystemKey(sistema: ProposalSistema, sistemaIndex: number) {
  return `${sistema.sistemaId || "sistema"}-${sistemaIndex}`;
}

function parseNumberInput(value: string, fallback: number) {
  const parsed = Number(value.replace(",", ".").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}
