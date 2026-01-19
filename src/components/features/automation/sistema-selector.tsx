"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Plus, Settings, Package, Trash2, Pencil } from "lucide-react";
import { toast } from "react-toastify";
import {
  Sistema,
  Ambiente,
  ProposalSistema,
  SistemaProduct,
} from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import { AmbienteManagerDialog } from "./ambiente-manager-dialog";
import { SistemaTemplateDialog } from "./sistema-template-dialog";
import { SistemaManagerDialog } from "./sistema-manager-dialog";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";

export interface SistemaSelectorProps {
  value?: ProposalSistema | null;
  onChange: (sistema: ProposalSistema | null) => void;
  onProductsChange?: (products: SistemaProduct[]) => void;
  onDataUpdate?: () => void;
  // Managed mode
  sistemas?: Sistema[];
  ambientes?: Ambiente[];
  onAction?: (action: MasterDataAction) => Promise<void> | void;
  // Separate handlers if needed, or generic.
  // Let's use generic onAction for now, or maybe distinct ones if distinct types?
  // The hook provides handleAmbienteAction and handleSistemaAction.
  // Let's accept onAmbienteAction and onSistemaAction for clarity.
  onAmbienteAction?: (action: MasterDataAction) => Promise<void> | void;
  onSistemaAction?: (action: MasterDataAction) => Promise<void> | void;
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
}: SistemaSelectorProps) {
  const { tenant } = useTenant();

  // Data
  const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
  const [sistemas, setSistemas] = React.useState<Sistema[]>([]);
  const [filteredSistemas, setFilteredSistemas] = React.useState<Sistema[]>([]);

  // Selection state
  const [selectedAmbienteId, setSelectedAmbienteId] =
    React.useState<string>("");
  const [selectedSistemaId, setSelectedSistemaId] = React.useState<string>("");

  // Dialog state
  const [isAmbienteDialogOpen, setIsAmbienteDialogOpen] = React.useState(false);
  const [isSistemaDialogOpen, setIsSistemaDialogOpen] = React.useState(false);
  const [isSistemaManagerOpen, setIsSistemaManagerOpen] = React.useState(false);
  const [editingSistema, setEditingSistema] = React.useState<Sistema | null>(
    null,
  );
  const [openedFromManager, setOpenedFromManager] = React.useState(false);

  const [isLoading, setIsLoading] = React.useState(true);

  // Load data
  const loadData = React.useCallback(
    async (silent = false) => {
      // Managed Mode
      if (managedSistemas && managedAmbientes) {
        setSistemas(managedSistemas);
        setFilteredSistemas(managedSistemas);
        setAmbientes(managedAmbientes);
        setIsLoading(false);
        return;
      }

      if (!tenant?.id) return;
      if (!silent) setIsLoading(true);
      if (!tenant?.id) return;
      if (!silent) setIsLoading(true);
      try {
        const [ambientesData, sistemasData] = await Promise.all([
          AmbienteService.getAmbientes(tenant.id),
          SistemaService.getSistemas(tenant.id),
        ]);
        setAmbientes(ambientesData);
        setSistemas(sistemasData);
        setFilteredSistemas(sistemasData);
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

  // Filter sistemas when ambiente changes
  React.useEffect(() => {
    if (selectedAmbienteId) {
      const filtered = sistemas.filter((s) =>
        (s.ambienteIds || []).includes(selectedAmbienteId),
      );
      setFilteredSistemas(filtered);
    } else {
      setFilteredSistemas([]);
    }
  }, [selectedAmbienteId, sistemas]);

  // Initialize from value
  React.useEffect(() => {
    if (value) {
      setSelectedAmbienteId(value.ambienteId);
      setSelectedSistemaId(value.sistemaId || "");
    } else {
      setSelectedAmbienteId("");
      setSelectedSistemaId("");
    }
  }, [value]);

  // Sync value names if underlying data changes (e.g. edited in dialogs)
  React.useEffect(() => {
    if (!value) return;

    const currentAmbiente = ambientes.find((a) => a.id === value.ambienteId);
    const currentSistema = sistemas.find((s) => s.id === value.sistemaId);

    // If data is missing (maybe deleted), do nothing or handle accordingly
    if (!currentAmbiente || !currentSistema) return;

    // Check if names have changed
    const ambienteNameChanged = currentAmbiente.name !== value.ambienteName;
    const sistemaNameChanged = currentSistema.name !== value.sistemaName;

    if (ambienteNameChanged || sistemaNameChanged) {
      onChange({
        ...value,
        ambienteName: currentAmbiente.name,
        sistemaName: currentSistema.name,
      });
    }
  }, [ambientes, sistemas, value, onChange]);

  const handleAmbienteChange = (ambienteId: string) => {
    setSelectedAmbienteId(ambienteId);
    setSelectedSistemaId("");

    if (!ambienteId) {
      onChange(null);
      return;
    }

    const ambiente = ambientes.find((a) => a.id === ambienteId);
    if (ambiente) {
      // Partial selection (Env only) - This ensures draft persistence
      onChange({
        ambienteId: ambiente.id,
        ambienteName: ambiente.name,
        sistemaId: "",
        sistemaName: "",
        description: "",
        products: [],
      });
    } else {
      onChange(null);
    }
  };

  const handleSistemaChange = (sistemaId: string) => {
    setSelectedSistemaId(sistemaId);

    if (!sistemaId) {
      // Revert to partial selection (Env only)
      const ambiente = ambientes.find((a) => a.id === selectedAmbienteId);
      if (ambiente) {
        onChange({
          ambienteId: ambiente.id,
          ambienteName: ambiente.name,
          sistemaId: "",
          sistemaName: "",
          description: "",
          products: [],
        });
      } else {
        onChange(null);
      }
      return;
    }

    const sistema = sistemas.find((s) => s.id === sistemaId);
    const ambiente = ambientes.find((a) => a.id === selectedAmbienteId);

    if (sistema && ambiente) {
      const proposalSistema: ProposalSistema = {
        sistemaId: sistema.id,
        sistemaName: sistema.name,
        ambienteId: ambiente.id,
        ambienteName: ambiente.name,
        description: sistema.description,
        products: [...sistema.defaultProducts],
      };
      onChange(proposalSistema);
      onProductsChange?.(proposalSistema.products);
    }
  };

  const handleNewSistema = () => {
    setEditingSistema(null);
    setIsSistemaDialogOpen(true);
  };

  const handleEditSistema = () => {
    const sistema = sistemas.find((s) => s.id === selectedSistemaId);
    if (sistema) {
      setEditingSistema(sistema);
      setIsSistemaDialogOpen(true);
    }
  };

  const handleSistemaCreated = (sistema: Sistema) => {
    // Auto-select the new sistema if it belongs to selected ambiente
    const shouldSelect = (sistema.ambienteIds || []).includes(
      selectedAmbienteId,
    );

    if (!shouldSelect) {
      loadData();
      return;
    }

    const ambiente = ambientes.find((a) => a.id === selectedAmbienteId);
    if (ambiente) {
      const proposalSistema: ProposalSistema = {
        sistemaId: sistema.id,
        sistemaName: sistema.name,
        ambienteId: ambiente.id,
        ambienteName: ambiente.name,
        description: sistema.description,
        products: [...sistema.defaultProducts],
      };

      // Directly trigger change, avoiding stale state lookup in handleSistemaChange
      onChange(proposalSistema);
      onProductsChange?.(proposalSistema.products);

      // Update local state purely for visual feedback before unmount
      setSelectedSistemaId(sistema.id);
    } else {
      // Fallback
      loadData();
    }
    onDataUpdate?.();
  };

  const handleDeleteSistema = async () => {
    if (!selectedSistemaId) return;

    const sistema = sistemas.find((s) => s.id === selectedSistemaId);
    if (!sistema) return;

    if (
      !confirm(
        `Tem certeza que deseja excluir o template "${sistema.name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    try {
      await SistemaService.deleteSistema(selectedSistemaId);
      setSelectedSistemaId("");
      onChange(null);
      loadData(true);
      onDataUpdate?.();
    } catch (error) {
      console.error("Error deleting sistema:", error);
      toast.error("Erro ao excluir sistema");
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Ambiente Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ambiente</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAmbienteDialogOpen(true)}
            className="h-7 text-xs"
          >
            <Settings className="h-3 w-3 mr-1" />
            Gerenciar
          </Button>
        </div>
        <Select
          value={selectedAmbienteId}
          onChange={(e) => handleAmbienteChange(e.target.value)}
          className="w-full"
        >
          <option value="">Selecione um ambiente...</option>
          {ambientes.map((ambiente) => (
            <option key={ambiente.id} value={ambiente.id}>
              {ambiente.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Selected Sistema Info or Explicit Add Button */}
      {selectedAmbienteId && !selectedSistemaId && !value && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const ambiente = ambientes.find(
                (a) => a.id === selectedAmbienteId,
              );
              if (ambiente) {
                onChange({
                  ambienteId: ambiente.id,
                  ambienteName: ambiente.name,
                  sistemaId: "",
                  sistemaName: "",
                  description: "",
                  products: [],
                });
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar (Sem Sistema)
          </Button>
        </div>
      )}

      {selectedAmbienteId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Sistema</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSistemaManagerOpen(true)}
                className="h-7 text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Gerenciar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNewSistema}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Novo
              </Button>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Select
              value={selectedSistemaId}
              onChange={(e) => handleSistemaChange(e.target.value)}
              className="flex-1"
            >
              <option value="">Selecione um sistema...</option>
              {filteredSistemas.map((sistema) => (
                <option key={sistema.id} value={sistema.id}>
                  {sistema.name}
                </option>
              ))}
            </Select>
            {selectedSistemaId && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleEditSistema}
                  title="Editar template"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleDeleteSistema}
                  title="Excluir template"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selected Sistema Info Removed per user request */}

      {/* Dialogs */}
      <AmbienteManagerDialog
        isOpen={isAmbienteDialogOpen}
        onClose={() => setIsAmbienteDialogOpen(false)}
        onAmbientesChange={() => loadData(true)}
        ambientes={managedAmbientes}
        onAction={onAmbienteAction}
      />

      <SistemaTemplateDialog
        isOpen={isSistemaDialogOpen}
        onClose={() => {
          setIsSistemaDialogOpen(false);
          setEditingSistema(null);
        }}
        editingSistema={editingSistema}
        preselectedAmbienteId={selectedAmbienteId}
        onSave={handleSistemaCreated}
        sistemas={managedSistemas}
        ambientes={managedAmbientes}
        onAction={onSistemaAction}
        onAmbienteAction={onAmbienteAction}
        onBack={
          openedFromManager ? () => setIsSistemaManagerOpen(true) : undefined
        }
      />

      <SistemaManagerDialog
        isOpen={isSistemaManagerOpen}
        onClose={() => setIsSistemaManagerOpen(false)}
        onSistemasChange={() => loadData(true)}
        onEditSistema={(sistema) => {
          setEditingSistema(sistema);
          setIsSistemaManagerOpen(false);
          setIsSistemaDialogOpen(true);
          setOpenedFromManager(true);
        }}
        onCreateNew={() => {
          setEditingSistema(null);
          setIsSistemaManagerOpen(false);
          setIsSistemaDialogOpen(true);
          setOpenedFromManager(true);
        }}
        filterAmbienteId={selectedAmbienteId}
        sistemas={managedSistemas}
        ambientes={managedAmbientes}
        onAction={onSistemaAction}
      />
    </div>
  );
}
