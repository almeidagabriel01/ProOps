"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pencil } from "lucide-react";
import {
  Sistema,
  Ambiente,
  ProposalSistema,
  SistemaProduct,
  AmbienteProduct,
} from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import { SystemEnvironmentManagerDialog } from "./system-environment-manager-dialog";
import { SistemaTemplateDialog } from "./sistema-template-dialog";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import {
  createProposalSistema,
  getPrimaryAmbiente,
} from "@/lib/sistema-migration-utils";

export interface SistemaSelectorProps {
  value?: ProposalSistema | null;
  onChange: (sistema: ProposalSistema | null) => void;
  onProductsChange?: (products: SistemaProduct[]) => void;
  onDataUpdate?: () => void;
  // Managed mode
  sistemas?: Sistema[];
  ambientes?: Ambiente[];
  onAction?: (action: MasterDataAction) => Promise<void> | void;
  onAmbienteAction?: (action: MasterDataAction) => Promise<void> | void;
  onSistemaAction?: (action: MasterDataAction) => Promise<void> | void;
  resetAmbienteAfterSelect?: boolean;
  // Selected systems to filter out already selected ambientes
  selectedSistemas?: ProposalSistema[];
}

export function SistemaSelector({
  value,
  onChange,
  onProductsChange,
  onDataUpdate,
  sistemas: managedSistemas,
  ambientes: managedAmbientes,
  onAmbienteAction,
  onSistemaAction,
  resetAmbienteAfterSelect,
  selectedSistemas,
}: SistemaSelectorProps) {
  const { tenant } = useTenant();

  // Data
  const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
  const [sistemas, setSistemas] = React.useState<Sistema[]>([]);
  const [filteredAmbientes, setFilteredAmbientes] = React.useState<Ambiente[]>(
    [],
  );

  // Selection state
  const [selectedAmbienteId, setSelectedAmbienteId] =
    React.useState<string>("");
  const [selectedSistemaId, setSelectedSistemaId] = React.useState<string>("");

  // Dialog state
  const [isSistemaDialogOpen, setIsSistemaDialogOpen] = React.useState(false);
  const [isManagerOpen, setIsManagerOpen] = React.useState(false);
  const [editingSistema, setEditingSistema] = React.useState<Sistema | null>(
    null,
  );
  // Unused state removed: openedFromManager

  const [isLoading, setIsLoading] = React.useState(true);

  // Load data
  const loadData = React.useCallback(
    async (silent = false) => {
      // Managed Mode
      if (managedSistemas && managedAmbientes) {
        setSistemas(managedSistemas);
        setAmbientes(managedAmbientes);
        // Initial filtering will be handled by useEffect
        setIsLoading(false);
        return;
      }

      if (!tenant?.id) return;
      if (!silent) setIsLoading(true);
      try {
        const [ambientesData, sistemasData] = await Promise.all([
          AmbienteService.getAmbientes(tenant.id),
          SistemaService.getSistemas(tenant.id),
        ]);
        setAmbientes(ambientesData);
        setSistemas(sistemasData);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [tenant?.id, managedAmbientes, managedSistemas],
  );

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter ambientes when sistema changes
  React.useEffect(() => {
    if (selectedSistemaId) {
      const sistema = sistemas.find((s) => s.id === selectedSistemaId);
      if (sistema) {
        const availableIds =
          sistema.availableAmbienteIds || sistema.ambienteIds || [];

        let filtered: Ambiente[] = [];
        if (availableIds.length > 0) {
          filtered = ambientes.filter((a) => availableIds.includes(a.id));
        } else {
          // If no restrictions defined (legacy or new unbounded), show all
          filtered = ambientes;
        }

        // Remove ambientes already selected for this system
        if (selectedSistemas && selectedSistemas.length > 0) {
          const currentSystem = selectedSistemas.find(
            (s) => s.sistemaId === selectedSistemaId,
          );
          if (currentSystem && currentSystem.ambientes) {
            const selectedAmbienteIds = currentSystem.ambientes.map(
              (a) => a.ambienteId,
            );
            filtered = filtered.filter(
              (a) => !selectedAmbienteIds.includes(a.id),
            );
          }
        }

        setFilteredAmbientes(filtered);
      } else {
        setFilteredAmbientes([]);
      }
    } else {
      setFilteredAmbientes([]);
    }
  }, [selectedSistemaId, sistemas, ambientes, selectedSistemas]);

  const currentValueSistemaId = value?.sistemaId;

  const availableSistemas = React.useMemo(() => {
    if (!selectedSistemas || selectedSistemas.length === 0) {
      return sistemas;
    }

    return sistemas.filter((sistema) => {
      if (currentValueSistemaId && sistema.id === currentValueSistemaId) {
        return true;
      }

      const allowedAmbienteIds =
        sistema.availableAmbienteIds && sistema.availableAmbienteIds.length > 0
          ? sistema.availableAmbienteIds
          : sistema.ambienteIds && sistema.ambienteIds.length > 0
            ? sistema.ambienteIds
            : ambientes.map((a) => a.id);

      const selectedForSystem = selectedSistemas.find(
        (s) => s.sistemaId === sistema.id,
      );

      if (!selectedForSystem) {
        return true;
      }

      const selectedAmbienteIds = new Set(
        (selectedForSystem.ambientes && selectedForSystem.ambientes.length > 0
          ? selectedForSystem.ambientes.map((a) => a.ambienteId)
          : selectedForSystem.ambienteId
            ? [selectedForSystem.ambienteId]
            : []
        ).filter(Boolean),
      );

      const hasRemainingAmbiente = allowedAmbienteIds.some(
        (ambienteId) => !selectedAmbienteIds.has(ambienteId),
      );

      return hasRemainingAmbiente;
    });
  }, [sistemas, ambientes, selectedSistemas, currentValueSistemaId]);

  React.useEffect(() => {
    if (!selectedSistemaId) return;
    const stillAvailable = availableSistemas.some(
      (s) => s.id === selectedSistemaId,
    );
    if (!stillAvailable) {
      setSelectedSistemaId("");
      setSelectedAmbienteId("");
      onChange(null);
    }
  }, [selectedSistemaId, availableSistemas, onChange]);

  // Initialize from value (Legacy handling + New Format)
  React.useEffect(() => {
    if (value) {
      const primaryAmbiente = getPrimaryAmbiente(value);
      setSelectedSistemaId(value.sistemaId || "");
      setSelectedAmbienteId(
        primaryAmbiente?.ambienteId || value.ambienteId || "",
      );
    } else {
      // Only reset if external value is strictly null (e.g. form reset)
      // When user interacts internally, we manage state via handlers
      if (value === null) {
        setSelectedSistemaId("");
        setSelectedAmbienteId("");
      }
    }
  }, [value]);

  const handleSistemaChange = (sistemaId: string) => {
    setSelectedSistemaId(sistemaId);
    setSelectedAmbienteId(""); // Reset environment when system changes
    onChange(null); // Clear value until complete

    if (!sistemaId) return;
  };

  const handleAmbienteChange = (ambienteId: string) => {
    setSelectedAmbienteId(ambienteId);

    if (!ambienteId || !selectedSistemaId) {
      onChange(null);
      return;
    }

    const sistema = sistemas.find((s) => s.id === selectedSistemaId);
    const ambiente = ambientes.find((a) => a.id === ambienteId);

    if (sistema && ambiente) {
      // Get products from ambiente or fall back to sistema's legacy defaultProducts
      // Get products from System Configuration (New) or fallback to Environment Defaults (Legacy)
      // Check if this specific ambiente is configured in the system
      const systemEnvConfig = sistema.ambientes?.find(
        (a) => a.ambienteId === ambiente.id,
      );

      let products: AmbienteProduct[] = [];

      if (systemEnvConfig) {
        // Priority 1: System-specific configuration (The new feature)
        // If a configuration exists, we use it strictly, even if it has 0 products.
        products = [...(systemEnvConfig.products || [])];
      } else if (ambiente.defaultProducts?.length) {
        // Priority 2: Global Environment Defaults (Backward compatibility / Fallback)
        products = [...ambiente.defaultProducts];
      } else {
        // Priority 3: System Global Defaults (Legacy)
        products = (sistema.defaultProducts || []).map((p) => ({
          productId: p.productId,
          itemType: p.itemType || "product",
          productName: p.productName,
          quantity: p.quantity,
          notes: p.notes,
          status: p.status, // Preserve status if available
        }));
      }

      const proposalSistema = createProposalSistema(
        sistema.id,
        sistema.name,
        ambiente.id,
        ambiente.name,
        sistema.description,
        products,
        systemEnvConfig?.description || ambiente.description, // Pass description (System Override or Global Default)
      );

      onChange(proposalSistema);
      onProductsChange?.(products as SistemaProduct[]);

      if (resetAmbienteAfterSelect) {
        // Clear environment selection immediately to allow selecting another one
        // The system selection stays active
        setTimeout(() => setSelectedAmbienteId(""), 0);
      }
    } else {
      onChange(null);
    }
  };

  const handleSistemaCreated = (sistema: Sistema) => {
    // If the newly created system is compatible with current flow, auto-select it
    setSelectedSistemaId(sistema.id);
    setSelectedAmbienteId(""); // User needs to select an environment next
    loadData(true);
    onDataUpdate?.();
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 1. Sistema Selection (First) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Solução</Label>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchableSelect
              id="proposal-sistema-select"
              name="proposal-sistema-select"
              value={selectedSistemaId}
              onValueChange={(val) => handleSistemaChange(val)}
              disabled={isLoading}
              options={availableSistemas.map((sistema) => ({
                value: sistema.id,
                label: sistema.name,
              }))}
              placeholder="Selecione uma solução..."
              searchPlaceholder="Buscar solução..."
            />
          </div>

          {selectedSistemaId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const sys = sistemas.find((s) => s.id === selectedSistemaId);
                if (sys) {
                  setEditingSistema(sys);
                  setIsSistemaDialogOpen(true);
                }
              }}
              title="Editar Solução"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 2. Ambiente Selection (Second, Filtered) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ambiente</Label>
        </div>
        <div className="relative">
          <SearchableSelect
            id="proposal-ambiente-select"
            name="proposal-ambiente-select"
            value={selectedAmbienteId}
            onValueChange={(val) => handleAmbienteChange(val)}
            disabled={!selectedSistemaId}
            options={filteredAmbientes.map((ambiente) => ({
              value: ambiente.id,
              label: ambiente.name,
            }))}
            placeholder={
              selectedSistemaId
                ? "Selecione um ambiente..."
                : "Selecione uma solução primeiro"
            }
            searchPlaceholder={
              selectedSistemaId
                ? "Buscar ambiente..."
                : "Selecione uma solução primeiro"
            }
          />
        </div>
      </div>

      {/* Dialogs */}
      <SystemEnvironmentManagerDialog
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onDataChange={() => loadData(true)}
        sistemas={managedSistemas}
        ambientes={managedAmbientes}
        onAction={async (action) => {
          if (action.entity === "ambiente" && onAmbienteAction) {
            await onAmbienteAction(action);
          } else if (onSistemaAction) {
            await onSistemaAction(action);
          }
        }}
      />

      <SistemaTemplateDialog
        isOpen={isSistemaDialogOpen}
        onClose={() => {
          setIsSistemaDialogOpen(false);
          setEditingSistema(null);
        }}
        editingSistema={editingSistema}
        preselectedAmbienteId={selectedAmbienteId} // Pass selected env to auto-check
        onSave={handleSistemaCreated}
        sistemas={managedSistemas}
        ambientes={managedAmbientes}
        onAction={onSistemaAction}
        onAmbienteAction={onAmbienteAction}
        onBack={undefined}
      />
    </div>
  );
}
