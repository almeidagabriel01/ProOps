"use client";

import * as React from "react";
import { Ambiente } from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Pencil,
  Trash2,
  Home,
  Plus,
  Loader2,
  Check,
  X,
  LayoutGrid,
} from "lucide-react";
import { toast } from "react-toastify";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
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
import { motion, AnimatePresence } from "motion/react";

interface AmbienteListProps {
  ambientes: Ambiente[];
  onUpdate: () => void;
}

export function AmbienteList({ ambientes, onUpdate }: AmbienteListProps) {
  const { tenant } = useTenant();

  // Create State
  const [newAmbienteName, setNewAmbienteName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  // Edit State
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Handlers
  const handleCreate = async () => {
    if (!tenant?.id || !newAmbienteName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const nextOrder = await AmbienteService.getNextOrder(tenant.id);
      await AmbienteService.createAmbiente({
        tenantId: tenant.id,
        name: newAmbienteName.trim(),
        icon: "Home",
        order: nextOrder,
        createdAt: new Date().toISOString(),
      });
      setNewAmbienteName("");
      toast.success("Ambiente criado com sucesso!");
      onUpdate();
    } catch (error) {
      console.error("Error creating ambiente:", error);
      toast.error("Erro ao criar ambiente");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setIsUpdating(true);
    try {
      await AmbienteService.updateAmbiente(id, { name: editingName.trim() });
      setEditingId(null);
      setEditingName("");
      toast.success("Ambiente atualizado!");
      onUpdate();
    } catch (error) {
      console.error("Error updating ambiente:", error);
      toast.error("Erro ao atualizar ambiente");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await AmbienteService.deleteAmbiente(deletingId);
      toast.success("Ambiente excluído!");
      onUpdate();
    } catch (error) {
      console.error("Error deleting ambiente:", error);
      toast.error("Erro ao excluir ambiente");
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
      setDeleteConfirmOpen(false);
    }
  };

  const startEdit = (amb: Ambiente) => {
    setEditingId(amb.id);
    setEditingName(amb.name);
  };

  return (
    <div className="space-y-8">
      {/* Create Section */}
      <div className="max-w-xl">
        <div className="relative flex items-center">
          <Input
            id="new-ambiente-input"
            className="pr-32 h-12 text-base shadow-sm border-muted-foreground/20 focus-visible:ring-primary/20"
            placeholder="Nome do novo ambiente (ex: Sala de Estar)"
            value={newAmbienteName}
            onChange={(e) => setNewAmbienteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <div className="absolute right-1 top-1 bottom-1">
            <Button
              onClick={handleCreate}
              disabled={!newAmbienteName.trim() || isCreating}
              className="h-full rounded-md px-4"
              size="sm"
            >
              {isCreating ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar
                </>
              )}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 px-1">
          Adicione ambientes globais para serem utilizados em seus sistemas.
        </p>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {ambientes.map((amb) => (
            <motion.div
              layout
              key={amb.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`
                group relative flex flex-col justify-between p-4 rounded-xl border bg-card transition-all duration-300
                ${editingId === amb.id ? "ring-2 ring-primary border-primary" : "hover:border-primary/50 hover:shadow-md"}
              `}
            >
              {editingId === amb.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2 text-primary font-medium">
                    <Home className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">
                      Editando
                    </span>
                  </div>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit(amb.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEdit(amb.id)}
                      disabled={isUpdating}
                      className="h-8 px-3"
                    >
                      {isUpdating ? (
                        <Spinner className="h-3 w-3" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-secondary rounded-lg text-secondary-foreground">
                      <Home className="h-5 w-5" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => startEdit(amb)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setDeletingId(amb.id);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold text-lg">{amb.name}</h4>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {ambientes.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
            <p>Nenhum ambiente encontrado.</p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ambiente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o ambiente &quot;
              {ambientes.find((a) => a.id === deletingId)?.name}&quot; da lista
              global. Sistemas que usam este ambiente podem ficar com
              referências quebradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
