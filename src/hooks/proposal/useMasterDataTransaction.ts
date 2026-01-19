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
  id: string; // Real ID
  data?: Partial<Ambiente>;
}

export interface SistemaAction {
  type: MasterDataActionType;
  entity: "sistema";
  id: string; // Real ID
  data?: Partial<Sistema>;
}

export type MasterDataAction = AmbienteAction | SistemaAction;

export interface UseMasterDataTransactionProps {
  initialAmbientes: Ambiente[];
  initialSistemas: Sistema[];
  tenantId?: string;
  onIdResolved?: (
    tempId: string,
    realId: string,
    entity: "ambiente" | "sistema",
  ) => void;
}

export function useMasterDataTransaction({
  initialAmbientes,
  initialSistemas,
  tenantId,
  onIdResolved,
}: UseMasterDataTransactionProps) {
  // Local state to reflect data immediately
  const [localAmbientes, setLocalAmbientes] =
    useState<Ambiente[]>(initialAmbientes);
  const [localSistemas, setLocalSistemas] =
    useState<Sistema[]>(initialSistemas);

  // Track pending async actions to prevent premature auto-saves (Senior Fix)
  const [pendingActionsCount, setPendingActionsCount] = useState(0);

  // Sync with initial data updates
  React.useEffect(() => {
    if (initialAmbientes) {
      setLocalAmbientes(initialAmbientes);
    }
  }, [initialAmbientes]);

  React.useEffect(() => {
    if (initialSistemas) {
      setLocalSistemas(initialSistemas);
    }
  }, [initialSistemas]);

  const handleAmbienteAction = useCallback(
    async (action: MasterDataAction) => {
      if (!tenantId) return;

      setPendingActionsCount((prev) => prev + 1);
      try {
        if (action.type === "create" && action.data) {
          // Optimistic update
          setLocalAmbientes((prev) => [...prev, action.data as Ambiente]);
          const created = await AmbienteService.createAmbiente({
            ...action.data,
            tenantId,
          });

          // Replace temp ID with real ID
          setLocalAmbientes((prev) =>
            prev.map((a) => (a.id === action.id ? created : a)),
          );

          // Notify parent about ID resolution
          if (onIdResolved) {
            onIdResolved(action.id, created.id, "ambiente");
          }
        } else if (action.type === "update" && action.data) {
          setLocalAmbientes((prev) =>
            prev.map((a) =>
              a.id === action.id ? { ...a, ...action.data } : a,
            ),
          );
          await AmbienteService.updateAmbiente(action.id, action.data);
        } else if (action.type === "delete") {
          setLocalAmbientes((prev) => prev.filter((a) => a.id !== action.id));
          await AmbienteService.deleteAmbiente(action.id);
        }
      } catch (error) {
        console.error("Error executing ambiente action:", error);
        toast.error("Erro ao salvar ambiente. Tente novamente.");
        // Revert optimistic update
        if (action.type === "create") {
          setLocalAmbientes((prev) => prev.filter((a) => a.id !== action.id));
        }
      } finally {
        setPendingActionsCount((prev) => Math.max(0, prev - 1));
      }
    },
    [tenantId, onIdResolved],
  );

  const handleSistemaAction = useCallback(
    async (action: MasterDataAction) => {
      if (!tenantId) return;

      setPendingActionsCount((prev) => prev + 1);
      try {
        if (action.type === "create" && action.data) {
          const sistemaData = action.data as Sistema;
          setLocalSistemas((prev) => [...prev, sistemaData]);
          const created = await SistemaService.createSistema({
            ...sistemaData,
            tenantId,
          });

          // Replace temp ID with real ID
          setLocalSistemas((prev) =>
            prev.map((s) => (s.id === action.id ? created : s)),
          );

          // Notify parent about ID resolution
          if (onIdResolved) {
            onIdResolved(action.id, created.id, "sistema");
          }
        } else if (action.type === "update" && action.data) {
          setLocalSistemas((prev) =>
            prev.map((s) =>
              s.id === action.id ? { ...s, ...action.data } : s,
            ),
          );
          // Fix strict type mismatch
          await SistemaService.updateSistema(
            action.id,
            action.data as Partial<Omit<Sistema, "id">>,
          );
        } else if (action.type === "delete") {
          setLocalSistemas((prev) => prev.filter((s) => s.id !== action.id));
          await SistemaService.deleteSistema(action.id);
        }
      } catch (error) {
        console.error("Error executing sistema action:", error);
        toast.error("Erro ao salvar sistema. Tente novamente.");
        // Revert optimistic update
        if (action.type === "create") {
          setLocalSistemas((prev) => prev.filter((s) => s.id !== action.id));
        }
      } finally {
        setPendingActionsCount((prev) => Math.max(0, prev - 1));
      }
    },
    [tenantId, onIdResolved],
  );

  // No-op commitChanges as data is already saved
  const commitChanges = async () => {
    return { idMap: {} };
  };

  return {
    mergedAmbientes: localAmbientes,
    mergedSistemas: localSistemas,
    handleAmbienteAction,
    handleSistemaAction,
    commitChanges,
    pendingActionsCount,
    setLocalAmbientes,
    setLocalSistemas,
  };
}
