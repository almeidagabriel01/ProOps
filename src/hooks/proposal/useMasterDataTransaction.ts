import * as React from "react";
import { useState, useCallback } from "react";
import { Ambiente, Sistema } from "@/types/automation";
import { AmbienteService } from "@/services/ambiente-service";
import { SistemaService } from "@/services/sistema-service";
import { toast } from "react-toastify";

export type MasterDataActionType = "create" | "update" | "delete";

export interface AmbienteAction {
  type: MasterDataActionType;
  entity: "ambiente";
  id: string; // Real ID or Temp ID
  data?: Partial<Ambiente>;
}

export interface SistemaAction {
  type: MasterDataActionType;
  entity: "sistema";
  id: string; // Real ID or Temp ID
  data?: Partial<Sistema>;
}

export type MasterDataAction = AmbienteAction | SistemaAction;

export interface UseMasterDataTransactionProps {
  initialAmbientes: Ambiente[];
  initialSistemas: Sistema[];
  tenantId?: string;
}

export function useMasterDataTransaction({
  initialAmbientes,
  initialSistemas,
  tenantId,
}: UseMasterDataTransactionProps) {
  const [pendingActions, setPendingActions] = useState<MasterDataAction[]>([]);

  // Local state to reflect pending changes + initial data
  const [localAmbientes, setLocalAmbientes] =
    useState<Ambiente[]>(initialAmbientes);
  const [localSistemas, setLocalSistemas] =
    useState<Sistema[]>(initialSistemas);

  // Sync with initial data updates
  React.useEffect(() => {
    if (initialAmbientes && initialAmbientes.length > 0) {
      setLocalAmbientes(() => {
        // Only update if prev is empty (first load) or if we want to overwrite?
        // Simplest: If we have no pending actions, we can overwrite.
        // If we have pending actions, we might lose them if we just overwrite.
        // But usually initial load happens once.
        // Let's just overwrite for now, assuming initial load is authoritative at start.
        // Better: merge?
        // For this fix: just set it.
        return initialAmbientes;
      });
    }
  }, [initialAmbientes]);

  React.useEffect(() => {
    if (initialSistemas && initialSistemas.length > 0) {
      setLocalSistemas(initialSistemas);
    }
  }, [initialSistemas]);

  const handleAmbienteAction = useCallback((action: MasterDataAction) => {
    setPendingActions((prev) => [...prev, action]);

    setLocalAmbientes((prev) => {
      if (action.type === "create") {
        return [...prev, action.data as Ambiente];
      }
      if (action.type === "update") {
        return prev.map((a) =>
          a.id === action.id ? { ...a, ...action.data } : a
        );
      }
      if (action.type === "delete") {
        return prev.filter((a) => a.id !== action.id);
      }
      return prev;
    });
  }, []);

  const handleSistemaAction = useCallback((action: MasterDataAction) => {
    setPendingActions((prev) => [...prev, action]);

    setLocalSistemas((prev) => {
      if (action.type === "create") {
        return [...prev, action.data as Sistema];
      }
      if (action.type === "update") {
        return prev.map((s) =>
          s.id === action.id ? { ...s, ...action.data } : s
        );
      }
      if (action.type === "delete") {
        return prev.filter((s) => s.id !== action.id);
      }
      return prev;
    });
  }, []);

  const commitChanges = async () => {
    if (!tenantId) return { idMap: {} };

    const idMap: Record<string, string> = {}; // TempID -> RealID

    // Process actions sequentially to maintain order and dependencies
    // optimization: batch independent actions? For now, sequential is safer.

    try {
      for (const action of pendingActions) {
        if (action.entity === "ambiente") {
          if (action.type === "create") {
            if (!action.data) continue;
            const tempId = action.id;
            const { id: realId } = await AmbienteService.createAmbiente({
              ...action.data,
              tenantId,
            });
            idMap[tempId] = realId;
          } else if (action.type === "update") {
            if (!action.data) continue;
            const realId = idMap[action.id] || action.id;
            await AmbienteService.updateAmbiente(realId, action.data);
          } else if (action.type === "delete") {
            const realId = idMap[action.id] || action.id;
            await AmbienteService.deleteAmbiente(realId);
          }
        } else if (action.entity === "sistema") {
          if (action.type === "create") {
            if (!action.data) continue;
            const tempId = action.id;
            const fixedAmbienteIds = (action.data.ambienteIds || []).map(
              (aid: string) => idMap[aid] || aid
            );

            // Cast to ensure type compatibility (runtime validation assumed from UI)
            const sistemaData = action.data as Omit<Sistema, "id">;

            const { id: realId } = await SistemaService.createSistema({
              ...sistemaData,
              ambienteIds: fixedAmbienteIds,
              tenantId,
            });
            idMap[tempId] = realId;
          } else if (action.type === "update") {
            if (!action.data) continue;
            const realId = idMap[action.id] || action.id;
            const updateData = { ...action.data };
            if (updateData.ambienteIds) {
              updateData.ambienteIds = updateData.ambienteIds.map(
                (aid: string) => idMap[aid] || aid
              );
            }
            // Fix strict type mismatch for update
            await SistemaService.updateSistema(
              realId,
              updateData as Partial<Omit<Sistema, "id">>
            );
          } else if (action.type === "delete") {
            const realId = idMap[action.id] || action.id;
            await SistemaService.deleteSistema(realId);
          }
        }
      }

      setPendingActions([]); // Clear queue
      return { idMap };
    } catch (error) {
      console.error("Error committing master data changes", error);
      toast.error("Erro ao salvar alterações de ambientes/sistemas");
      throw error;
    }
  };

  return {
    mergedAmbientes: localAmbientes,
    mergedSistemas: localSistemas,
    handleAmbienteAction,
    handleSistemaAction,
    commitChanges,
    pendingActionsCount: pendingActions.length,
    setLocalAmbientes, // exposed for initial sync if needed
    setLocalSistemas,
  };
}
