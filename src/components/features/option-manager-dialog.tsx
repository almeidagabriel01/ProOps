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
import { Plus, Trash2, Pencil, Package } from "lucide-react";
import { Option, OptionService } from "@/services/option-service";
import { useTenant } from "@/providers/tenant-provider";
import { Spinner } from "@/components/ui/spinner";
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
import { toast } from '@/lib/toast';
import { Loader2 } from "lucide-react";

interface OptionManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onOptionsChange?: () => void;
    storageKey: string;
    label: string;
}

export function OptionManagerDialog({
    isOpen,
    onClose,
    onOptionsChange,
    storageKey,
    label
}: OptionManagerDialogProps) {
    const { tenant } = useTenant();
    const [options, setOptions] = React.useState<Option[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isCreating, setIsCreating] = React.useState(false);

    // Delete state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Edit state
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [newOption, setNewOption] = React.useState("");
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editingLabel, setEditingLabel] = React.useState("");

    const loadOptions = React.useCallback(async () => {
        if (!tenant?.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const data = await OptionService.getOptions(tenant.id, storageKey);
            setOptions(data);
        } catch (error) {
            console.error("Error loading options:", error);
            setOptions([]);
            toast.error("Erro ao carregar opções");
        } finally {
            setIsLoading(false);
        }
    }, [tenant?.id, storageKey]);

    React.useEffect(() => {
        if (isOpen && tenant?.id) {
            loadOptions();
        }
    }, [isOpen, tenant?.id, loadOptions]);

    const handleCreate = async () => {
        if (!tenant?.id || !newOption.trim() || isCreating) return;

        setIsCreating(true);
        try {
            await OptionService.createOption(tenant.id, storageKey, newOption.trim());
            setNewOption("");
            await loadOptions();
            onOptionsChange?.();
            toast.success("Opção criada com sucesso!");
        } catch (error) {
            console.error("Error creating option:", error);
            toast.error("Erro ao criar opção");
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
            await OptionService.deleteOption(deletingId);
            await loadOptions();
            onOptionsChange?.();
            toast.success("Opção excluída com sucesso!");
        } catch (error) {
            console.error("Error deleting option:", error);
            toast.error("Erro ao excluir opção");
        } finally {
            setIsDeleting(false);
            setDeleteConfirmOpen(false);
            setDeletingId(null);
        }
    };

    const handleEdit = async (id: string) => {
        if (!editingLabel.trim()) return;

        setUpdatingId(id);
        try {
            await OptionService.updateOption(id, editingLabel.trim());
            setEditingId(null);
            setEditingLabel("");
            await loadOptions();
            onOptionsChange?.();
            toast.success("Opção atualizada com sucesso!");
        } catch (error) {
            console.error("Error updating option:", error);
            toast.error("Erro ao atualizar opção");
        } finally {
            setUpdatingId(null);
        }
    };

    const startEdit = (option: Option) => {
        setEditingId(option.id);
        setEditingLabel(option.label);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingLabel("");
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Gerenciar {label}</DialogTitle>
                        <DialogDescription>
                            Adicione, edite ou remova opções para {label.toLowerCase()}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Criar nova opção */}
                        <div className="flex gap-2 items-center">
                            <div className="flex-1">
                                <Input
                                    placeholder={`Novo ${label.toLowerCase()}...`}
                                    value={newOption}
                                    onChange={(e) => setNewOption(e.target.value)}
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
                                disabled={!newOption.trim() || isCreating}
                            >
                                {isCreating ? <Spinner className="text-primary-foreground" /> : <Plus className="h-4 w-4" />}
                            </Button>
                        </div>

                        {/* Lista de opções */}
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <Spinner className="h-8 w-8" />
                                </div>
                            ) : options.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p>Nenhuma opção cadastrada.</p>
                                    <p className="text-sm">Digite acima e clique em +</p>
                                </div>
                            ) : (
                                options.map((option) => (
                                    <div
                                        key={option.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                                    >
                                        <Package className="h-4 w-4 text-primary shrink-0" />

                                        {editingId === option.id ? (
                                            <>
                                                <Input
                                                    value={editingLabel}
                                                    onChange={(e) => setEditingLabel(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleEdit(option.id);
                                                        if (e.key === "Escape") cancelEdit();
                                                    }}
                                                    className="flex-1 h-8"
                                                    autoFocus
                                                    disabled={updatingId === option.id}
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleEdit(option.id)}
                                                    disabled={updatingId === option.id}
                                                >
                                                    {updatingId === option.id ? <Spinner className="h-3 w-3" /> : "Salvar"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={cancelEdit}
                                                    disabled={updatingId === option.id}
                                                >
                                                    Cancelar
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 font-medium">
                                                    {option.label}
                                                </span>
                                                {deletingId === option.id ? (
                                                    <Spinner className="h-4 w-4 text-destructive" />
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            onClick={() => startEdit(option)}
                                                            disabled={deletingId !== null}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                                            onClick={() => handleDeleteClick(option.id)}
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
                        <Button variant="outline" className="cursor-pointer" onClick={onClose}>
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
                            Tem certeza que deseja excluir esta opção? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
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
        </>
    );
}
