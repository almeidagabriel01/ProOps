import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { Sistema, Ambiente } from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";

interface UseSystemManagerProps {
  isOpen: boolean;
  managedSistemas?: Sistema[];
  managedAmbientes?: Ambiente[];
  onAction?: (action: MasterDataAction) => void;
  onDataChange?: () => void;
}

export function useSystemManager({
  isOpen,
  managedSistemas,
  managedAmbientes,
  onAction,
  onDataChange,
}: UseSystemManagerProps) {
  const { tenant } = useTenant();

  // Data State
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI State
  const [selectedSistemaId, setSelectedSistemaId] = useState<string | null>(
    null,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [environmentToDelete, setEnvironmentToDelete] = useState<string | null>(
    null,
  );
  const [systemToDelete, setSystemToDelete] = useState<string | null>(null);

  // Editing State
  const [isEditingSystemName, setIsEditingSystemName] = useState(false);
  const [editingSystemName, setEditingSystemName] = useState("");

  // Create System State
  const [isCreatingSystem, setIsCreatingSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState("");

  // Create Environment State
  const [isAddingEnvironment, setIsAddingEnvironment] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState("");
  const [environmentSearch, setEnvironmentSearch] = useState("");
  const [showEnvironmentSelector, setShowEnvironmentSelector] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    if (managedSistemas && managedAmbientes) {
      setSistemas(managedSistemas);
      setAmbientes(managedAmbientes);

      if (!selectedSistemaId && managedSistemas.length > 0) {
        setSelectedSistemaId(managedSistemas[0].id);
      } else if (
        selectedSistemaId &&
        !managedSistemas.some((s) => s.id === selectedSistemaId)
      ) {
        setSelectedSistemaId(
          managedSistemas.length > 0 ? managedSistemas[0].id : null,
        );
      }

      setIsLoading(false);
      return;
    }

    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const [sistemasData, ambientesData] = await Promise.all([
        SistemaService.getSistemas(tenant.id),
        AmbienteService.getAmbientes(tenant.id),
      ]);
      setSistemas(sistemasData);
      setAmbientes(ambientesData);

      if (!selectedSistemaId && sistemasData.length > 0) {
        setSelectedSistemaId(sistemasData[0].id);
      }
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id, managedSistemas, managedAmbientes, selectedSistemaId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Derived State
  const selectedSistema = useMemo(
    () => sistemas.find((s) => s.id === selectedSistemaId),
    [sistemas, selectedSistemaId],
  );

  const linkedAmbientes = useMemo(() => {
    if (!selectedSistema) return [];

    if (selectedSistema.ambientes && selectedSistema.ambientes.length > 0) {
      const configuredIds = selectedSistema.ambientes.map((a) => a.ambienteId);
      return ambientes.filter((a) => configuredIds.includes(a.id));
    }

    const linkedIds =
      selectedSistema.availableAmbienteIds || selectedSistema.ambienteIds || [];
    return ambientes.filter((a) => linkedIds.includes(a.id));
  }, [selectedSistema, ambientes]);

  const availableAmbientesToAdd = useMemo(() => {
    if (!selectedSistema) return [];

    let linkedIds: string[] = [];
    if (selectedSistema.ambientes && selectedSistema.ambientes.length > 0) {
      linkedIds = selectedSistema.ambientes.map((a) => a.ambienteId);
    } else {
      linkedIds =
        selectedSistema.availableAmbienteIds ||
        selectedSistema.ambienteIds ||
        [];
    }

    return ambientes.filter(
      (a) =>
        !linkedIds.includes(a.id) &&
        (environmentSearch === "" ||
          a.name.toLowerCase().includes(environmentSearch.toLowerCase())),
    );
  }, [selectedSistema, ambientes, environmentSearch]);

  // Actions
  const handleCreateSystem = async () => {
    if (!newSystemName.trim()) return;

    try {
      if (onAction) {
        const tempId = `temp-sys-${Date.now()}`;
        onAction({
          type: "create",
          entity: "sistema",
          id: tempId,
          data: {
            id: tempId,
            name: newSystemName.trim(),
            tenantId: tenant?.id,
            description: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ambientes: [],
            availableAmbienteIds: [],
          } as Sistema,
        });
      } else {
        await SistemaService.createSistema({
          name: newSystemName.trim(),
          tenantId: tenant!.id,
          description: "",
          icon: "Cpu",
          order: 99,
          active: true,
          availableAmbienteIds: [],
          createdAt: new Date().toISOString(),
        } as unknown as Sistema);
        await loadData();
      }

      setNewSystemName("");
      setIsCreatingSystem(false);
      toast.success("Sistema criado!");
      onDataChange?.();
    } catch {
      toast.error("Erro ao criar sistema");
    }
  };

  const handleDeleteSystem = async () => {
    if (!systemToDelete) return;

    try {
      if (onAction) {
        onAction({
          type: "delete",
          entity: "sistema",
          id: systemToDelete,
        });
      } else {
        await SistemaService.deleteSistema(systemToDelete);
        await loadData();
      }
      toast.success("Sistema removido!");
      setSystemToDelete(null);
      onDataChange?.();
    } catch {
      toast.error("Erro ao remover sistema");
    }
  };

  const handleUpdateSystemName = async () => {
    if (!selectedSistema || !editingSystemName.trim()) return;

    try {
      if (onAction) {
        onAction({
          type: "update",
          entity: "sistema",
          id: selectedSistema.id,
          data: { name: editingSystemName.trim() },
        });
      } else {
        await SistemaService.updateSistema(selectedSistema.id, {
          name: editingSystemName.trim(),
        });
        await loadData();
      }
      setIsEditingSystemName(false);
      toast.success("Nome atualizado!");
      onDataChange?.();
    } catch {
      toast.error("Erro ao atualizar nome");
    }
  };

  const handleCreateEnvironment = async () => {
    if (!newEnvironmentName.trim() || !selectedSistema) return;

    try {
      let newAmbienteId = `temp-amb-${Date.now()}`;

      if (onAction) {
        onAction({
          type: "create",
          entity: "ambiente",
          id: newAmbienteId,
          data: {
            id: newAmbienteId,
            name: newEnvironmentName.trim(),
            tenantId: tenant?.id,
            icon: "Home",
          } as Ambiente,
        });

        const newAmbientesConfig = [
          ...(selectedSistema.ambientes || []),
          {
            ambienteId: newAmbienteId,
            products: [],
          },
        ];

        const currentIds =
          selectedSistema.availableAmbienteIds ||
          selectedSistema.ambienteIds ||
          [];
        const newAvailableIds = [...currentIds, newAmbienteId];

        onAction({
          type: "update",
          entity: "sistema",
          id: selectedSistema.id,
          data: {
            ambientes: newAmbientesConfig,
            availableAmbienteIds: newAvailableIds,
          },
        });
      } else {
        const newAmb = await AmbienteService.createAmbiente({
          name: newEnvironmentName.trim(),
          tenantId: tenant!.id,
          icon: "Home",
          defaultProducts: [],
        });
        newAmbienteId = newAmb.id;

        const newAmbientesConfig = [
          ...(selectedSistema.ambientes || []),
          {
            ambienteId: newAmbienteId,
            products: [],
          },
        ];
        const currentIds =
          selectedSistema.availableAmbienteIds ||
          selectedSistema.ambienteIds ||
          [];
        const newAvailableIds = [...currentIds, newAmbienteId];

        await SistemaService.updateSistema(selectedSistema.id, {
          ambientes: newAmbientesConfig,
          availableAmbienteIds: newAvailableIds,
        });

        await loadData();
      }

      setNewEnvironmentName("");
      setIsAddingEnvironment(false);
      toast.success("Ambiente criado e vinculado!");
      onDataChange?.();
    } catch {
      toast.error("Erro ao criar ambiente");
    }
  };

  const handleLinkEnvironment = async (ambienteId: string) => {
    if (!selectedSistema) return;

    try {
      const currentAmbientes = selectedSistema.ambientes || [];
      const currentIds = currentAmbientes.map((a) => a.ambienteId);
      const legIds = selectedSistema.availableAmbienteIds || [];

      if (currentIds.includes(ambienteId)) return;

      const newAmbientesConfig = [
        ...currentAmbientes,
        {
          ambienteId,
          products: [],
        },
      ];

      const newAvailableIds = [...legIds, ambienteId];

      if (onAction) {
        onAction({
          type: "update",
          entity: "sistema",
          id: selectedSistema.id,
          data: {
            ambientes: newAmbientesConfig,
            availableAmbienteIds: newAvailableIds,
          },
        });
      } else {
        await SistemaService.updateSistema(selectedSistema.id, {
          ambientes: newAmbientesConfig,
          availableAmbienteIds: newAvailableIds,
        });
        await loadData();
      }

      setShowEnvironmentSelector(false);
      toast.success("Ambiente vinculado!");
      onDataChange?.();
    } catch {
      toast.error("Erro ao vincular ambiente");
    }
  };

  const handleUnlinkEnvironment = async () => {
    if (!environmentToDelete || !selectedSistema) return;

    try {
      const currentAmbientes = selectedSistema.ambientes || [];
      const newAmbientesConfig = currentAmbientes.filter(
        (a) => a.ambienteId !== environmentToDelete,
      );

      const currentIds =
        selectedSistema.availableAmbienteIds ||
        selectedSistema.ambienteIds ||
        [];
      const newAvailableIds = currentIds.filter(
        (id) => id !== environmentToDelete,
      );

      if (onAction) {
        onAction({
          type: "update",
          entity: "sistema",
          id: selectedSistema.id,
          data: {
            ambientes: newAmbientesConfig,
            availableAmbienteIds: newAvailableIds,
          },
        });
      } else {
        await SistemaService.updateSistema(selectedSistema.id, {
          ambientes: newAmbientesConfig,
          availableAmbienteIds: newAvailableIds,
        });
        await loadData();
      }

      setEnvironmentToDelete(null);
      toast.success("Ambiente desvinculado!");
      onDataChange?.();
    } catch {
      toast.error("Erro ao desvincular ambiente");
    }
  };

  return {
    state: {
      sistemas,
      ambientes,
      isLoading,
      selectedSistemaId,
      selectedSistema,
      isMobileMenuOpen,
      environmentToDelete,
      systemToDelete,
      isEditingSystemName,
      editingSystemName,
      isCreatingSystem,
      newSystemName,
      isAddingEnvironment,
      newEnvironmentName,
      environmentSearch,
      showEnvironmentSelector,
      linkedAmbientes,
      availableAmbientesToAdd,
    },
    actions: {
      setSistemas,
      setAmbientes,
      setIsLoading,
      setSelectedSistemaId,
      setIsMobileMenuOpen,
      handleLinkEnvironment,
      handleUnlinkEnvironment,
      loadData,
      setEnvironmentToDelete,
      setSystemToDelete,
      setIsEditingSystemName,
      setEditingSystemName,
      setIsCreatingSystem,
      setNewSystemName,
      setIsAddingEnvironment,
      setNewEnvironmentName,
      setEnvironmentSearch,
      setShowEnvironmentSelector,
      handleCreateSystem,
      handleDeleteSystem,
      handleUpdateSystemName,
      handleCreateEnvironment,
    },
  };
}
