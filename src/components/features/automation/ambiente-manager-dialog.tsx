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
import { Plus, Trash2, Pencil, Home } from "lucide-react";
import { Ambiente } from "@/types/automation";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import { Spinner } from "@/components/ui/spinner";

interface AmbienteManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAmbientesChange?: () => void;
}

export function AmbienteManagerDialog({ isOpen, onClose, onAmbientesChange }: AmbienteManagerDialogProps) {
    const { tenant } = useTenant();
    const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isCreating, setIsCreating] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);

    const [newAmbienteName, setNewAmbienteName] = React.useState("");
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editingName, setEditingName] = React.useState("");

    const loadAmbientes = React.useCallback(async () => {
        if (!tenant?.id) return;
        setIsLoading(true);
        try {
            const data = await AmbienteService.getAmbientes(tenant.id);
            setAmbientes(data);
        } catch (error) {
            console.error("Error loading ambientes:", error);
            // Fallback: tentar sem ordenação se der erro de índice
            setAmbientes([]);
        } finally {
            setIsLoading(false);
        }
    }, [tenant?.id]);

    React.useEffect(() => {
        if (isOpen && tenant?.id) {
            loadAmbientes();
        }
    }, [isOpen, tenant?.id, loadAmbientes]);

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
            await loadAmbientes();
            onAmbientesChange?.();
        } catch (error) {
            console.error("Error creating ambiente:", error);
            alert("Erro ao criar ambiente");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este ambiente?")) {
            setDeletingId(id);
            try {
                await AmbienteService.deleteAmbiente(id);
                await loadAmbientes();
                onAmbientesChange?.();
            } catch (error) {
                console.error("Error deleting ambiente:", error);
            } finally {
                setDeletingId(null);
            }
        }
    };

    const handleEdit = async (id: string) => {
        if (!editingName.trim()) return;

        setUpdatingId(id);
        try {
            await AmbienteService.updateAmbiente(id, { name: editingName.trim() });
            setEditingId(null);
            setEditingName("");
            await loadAmbientes();
            onAmbientesChange?.();
        } catch (error) {
            console.error("Error updating ambiente:", error);
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

    return (
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
                            {isCreating ? <Spinner className="text-primary-foreground" /> : <Plus className="h-4 w-4" />}
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
                                    <Home className="h-4 w-4 text-primary flex-shrink-0" />

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
                                                {updatingId === ambiente.id ? <Spinner className="h-3 w-3" /> : "Salvar"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={cancelEdit}
                                                disabled={updatingId === ambiente.id}
                                            >
                                                Cancelar
                                            </Button>
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
                                                        onClick={() => handleDelete(ambiente.id)}
                                                        disabled={deletingId !== null}
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
                    <Button variant="outline" className="cursor-pointer" onClick={onClose}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

