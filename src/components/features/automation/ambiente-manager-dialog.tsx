"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Home, Package } from "lucide-react";
import { Ambiente } from "@/types/automation";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import { Spinner } from "@/components/ui/spinner";
import { AmbienteProductsDialog } from "./ambiente-products-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";

interface AmbienteManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAmbientesChange?: (updatedAmbiente?: { id: string; name: string }) => void;
  ambientes?: Ambiente[]; // Managed mode: pass data
  onAction?: (action: MasterDataAction) => Promise<void> | void; // Managed mode: pass handler
}

export function AmbienteManagerDialog({
  isOpen,
  onClose,
  onAmbientesChange,
  ambientes: managedAmbientes,
  onAction,
}: AmbienteManagerDialogProps) {
  const { tenant } = useTenant();
  const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const [newAmbienteName, setNewAmbienteName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");

  // Products dialog state
  const [productsDialogOpen, setProductsDialogOpen] = React.useState(false);
  const [selectedAmbienteForProducts, setSelectedAmbienteForProducts] =
    React.useState<Ambiente | null>(null);

  const loadAmbientes = React.useCallback(async () => {
    if (managedAmbientes) {
      setAmbientes(managedAmbientes);
      setIsLoading(false);
      return;
    }

    if (!tenant?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await AmbienteService.getAmbientes(tenant.id);
      setAmbientes(data);
    } catch (error) {
      console.error("Error loading ambientes:", error);
      setAmbientes([]);
      toast.error("Erro ao carregar ambientes");
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id, managedAmbientes]);

  React.useEffect(() => {
    if (isOpen && tenant?.id) {
      loadAmbientes();
    }
  }, [isOpen, tenant?.id, loadAmbientes]);

  const handleCreate = async () => {
    if (!tenant?.id || !newAmbienteName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      if (onAction) {
        // Managed Mode
        const tempId = `temp-${Date.now()}`;
        // Update: Await the action to ensure real ID is created before feedback
        await onAction({
          type: "create",
          entity: "ambiente",
          id: tempId, // Pass tempId, but service will ignore and return Real ID
          data: {
            id: tempId,
            tenantId: tenant.id,
            name: newAmbienteName.trim(),
            icon: "Home",
            order: 9999,
            createdAt: new Date().toISOString(),
          },
        });
        setNewAmbienteName("");
        // No need to loadAmbientes(), parent updates props
        onAmbientesChange?.();
        toast.success("Ambiente adicionado!");
      } else {
        // Direct Mode
        const nextOrder = await AmbienteService.getNextOrder(tenant.id);
        await AmbienteService.createAmbiente({
          tenantId: tenant.id,
          name: newAmbienteName.trim(),
          icon: "Home",
          order: nextOrder,
          createdAt: new Date().toISOString(),
        });
        setNewAmbienteName("");
        await loadAmbientes();
        onAmbientesChange?.();
        toast.success("Ambiente criado com sucesso!");
      }
    } catch (error) {
      console.error("Error creating ambiente:", error);
      toast.error("Erro ao criar ambiente");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    try {
      if (onAction) {
        onAction({
          type: "delete",
          entity: "ambiente",
          id: deletingId,
        });
        // loadAmbientes() not needed if managed
        onAmbientesChange?.();
        toast.success("Ambiente removido!");
      } else {
        await AmbienteService.deleteAmbiente(deletingId);
        await loadAmbientes();
        onAmbientesChange?.();
        toast.success("Ambiente excluído com sucesso!");
      }
    } catch (error) {
      console.error("Error deleting ambiente:", error);
      toast.error("Erro ao excluir ambiente");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editingName.trim()) return;

    setUpdatingId(id);
    try {
      const newName = editingName.trim();

      if (onAction) {
        onAction({
          type: "update",
          entity: "ambiente",
          id,
          data: { name: newName },
        });
        setEditingId(null);
        setEditingName("");
        // managed update
        onAmbientesChange?.({ id, name: newName });
        toast.success("Ambiente atualizado!");
      } else {
        await AmbienteService.updateAmbiente(id, { name: newName });
        setEditingId(null);
        setEditingName("");
        await loadAmbientes();
        // Pass the updated ambiente info so parent can sync selectedSistemas
        onAmbientesChange?.({ id, name: newName });
        toast.success("Ambiente atualizado com sucesso!");
      }
    } catch (error) {
      console.error("Error updating ambiente:", error);
      toast.error("Erro ao atualizar ambiente");
    } finally {
      setUpdatingId(null);
    }
  };

  const startEdit = (ambiente: Ambiente) => {
    setEditingId(ambiente.id);
    setEditingName(ambiente.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const openProductsDialog = (ambiente: Ambiente) => {
    setSelectedAmbienteForProducts(ambiente);
    setProductsDialogOpen(true);
  };

  const handleProductsSave = () => {
    loadAmbientes();
    onAmbientesChange?.();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Ambientes</DialogTitle>
            <DialogDescription>
              Adicione os ambientes da casa: Sala, Quarto, Cozinha, etc.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Criar novo ambiente */}
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Input
                  placeholder="Ex: Sala, Quarto, Cozinha..."
                  value={newAmbienteName}
                  onChange={(e) => setNewAmbienteName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isCreating) {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  disabled={isCreating}
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newAmbienteName.trim() || isCreating}
              >
                {isCreating ? (
                  <Spinner className="text-primary-foreground" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Lista de ambientes */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : ambientes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Home className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum ambiente cadastrado.</p>
                  <p className="text-sm">Digite o nome acima e clique em +</p>
                </div>
              ) : (
                ambientes.map((ambiente) => (
                  <div
                    key={ambiente.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <Home className="h-4 w-4 text-primary shrink-0" />

                    {editingId === ambiente.id ? (
                      <>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEdit(ambiente.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="flex-1 h-8"
                          autoFocus
                          disabled={updatingId === ambiente.id}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleEdit(ambiente.id)}
                          disabled={updatingId === ambiente.id}
                        >
                          {updatingId === ambiente.id ? (
                            <Spinner className="h-3 w-3" />
                          ) : (
                            "Salvar"
                          )}
                        </Button>
                        {updatingId !== ambiente.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            disabled={updatingId === ambiente.id}
                          >
                            Cancelar
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium">
                          {ambiente.name}
                        </span>
                        {deletingId === ambiente.id ? (
                          <Spinner className="h-4 w-4 text-destructive" />
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-primary hover:text-primary"
                              onClick={() => openProductsDialog(ambiente)}
                              disabled={deletingId !== null}
                              title="Configurar produtos padrão"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEdit(ambiente)}
                              disabled={deletingId !== null}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(ambiente.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={onClose}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este ambiente? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Products Dialog */}
      <AmbienteProductsDialog
        isOpen={productsDialogOpen}
        onClose={() => setProductsDialogOpen(false)}
        ambiente={selectedAmbienteForProducts}
        onSave={handleProductsSave}
        onAction={onAction}
      />
    </>
  );
}
