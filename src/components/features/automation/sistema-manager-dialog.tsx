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
import { Pencil, Trash2, Package, Plus } from "lucide-react";
import { Sistema, Ambiente } from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";

interface SistemaManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSistemasChange?: () => void;
    onEditSistema?: (sistema: Sistema) => void;
    onCreateNew?: () => void;
    filterAmbienteId?: string;
}

export function SistemaManagerDialog({ 
    isOpen, 
    onClose, 
    onSistemasChange,
    onEditSistema,
    onCreateNew,
    filterAmbienteId
}: SistemaManagerDialogProps) {
    const { tenant } = useTenant();
    const [sistemas, setSistemas] = React.useState<Sistema[]>([]);
    const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const loadData = React.useCallback(async () => {
        if (!tenant?.id) return;
        setIsLoading(true);
        try {
            const [sistemasData, ambientesData] = await Promise.all([
                SistemaService.getSistemas(tenant.id),
                AmbienteService.getAmbientes(tenant.id),
            ]);
            
            let filteredSistemas = sistemasData;
            if (filterAmbienteId) {
                filteredSistemas = sistemasData.filter(s => s.ambienteIds.includes(filterAmbienteId));
            }
            
            setSistemas(filteredSistemas);
            setAmbientes(ambientesData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [tenant?.id, filterAmbienteId]);

    React.useEffect(() => {
        if (isOpen && tenant?.id) {
            loadData();
        }
    }, [isOpen, tenant?.id, loadData]);

    const handleDelete = async (sistema: Sistema) => {
        if (!confirm(`Tem certeza que deseja excluir o template "${sistema.name}"?`)) return;

        try {
            await SistemaService.deleteSistema(sistema.id);
            await loadData();
            onSistemasChange?.();
        } catch (error) {
            console.error("Error deleting sistema:", error);
            alert("Erro ao excluir sistema");
        }
    };

    const getAmbienteNames = (ambienteIds: string[]) => {
        return ambienteIds
            .map(id => ambientes.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join(", ");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Gerenciar Templates de Sistema</DialogTitle>
                    <DialogDescription>
                        Visualize, edite ou exclua os templates de sistema criados.
                    </DialogDescription>
                </DialogHeader>

                {onCreateNew && (
                    <div className="flex justify-start">
                        <Button 
                            onClick={() => {
                                onClose();
                                onCreateNew();
                            }}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Novo Template
                        </Button>
                    </div>
                )}

                <div className="space-y-3 py-2">
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                            Carregando...
                        </div>
                    ) : sistemas.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>Nenhum template de sistema criado.</p>
                            <p className="text-sm">Clique em "Novo Template" para criar.</p>
                        </div>
                    ) : (
                        sistemas.map((sistema) => (
                            <div
                                key={sistema.id}
                                className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                                <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium">{sistema.name}</h4>
                                    {sistema.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                            {sistema.description}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                            {sistema.defaultProducts.length} produto(s)
                                        </span>
                                        {sistema.ambienteIds.length > 0 && (
                                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                                {getAmbienteNames(sistema.ambienteIds)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={() => {
                                            onClose();
                                            onEditSistema?.(sistema);
                                        }}
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(sistema)}
                                        title="Excluir"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
