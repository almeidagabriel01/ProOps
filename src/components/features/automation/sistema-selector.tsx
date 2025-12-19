"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Plus, Settings, Package, Trash2, Pencil } from "lucide-react";
import { Sistema, Ambiente, ProposalSistema, SistemaProduct } from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import { AmbienteManagerDialog } from "./ambiente-manager-dialog";
import { SistemaTemplateDialog } from "./sistema-template-dialog";
import { SistemaManagerDialog } from "./sistema-manager-dialog";

export interface SistemaSelectorProps {
    value?: ProposalSistema | null;
    onChange: (sistema: ProposalSistema | null) => void;
    onProductsChange?: (products: SistemaProduct[]) => void;
}

export function SistemaSelector({ value, onChange, onProductsChange }: SistemaSelectorProps) {
    const { tenant } = useTenant();

    // Data
    const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
    const [sistemas, setSistemas] = React.useState<Sistema[]>([]);
    const [filteredSistemas, setFilteredSistemas] = React.useState<Sistema[]>([]);

    // Selection state
    const [selectedAmbienteId, setSelectedAmbienteId] = React.useState<string>("");
    const [selectedSistemaId, setSelectedSistemaId] = React.useState<string>("");

    // Dialog state
    const [isAmbienteDialogOpen, setIsAmbienteDialogOpen] = React.useState(false);
    const [isSistemaDialogOpen, setIsSistemaDialogOpen] = React.useState(false);
    const [isSistemaManagerOpen, setIsSistemaManagerOpen] = React.useState(false);
    const [editingSistema, setEditingSistema] = React.useState<Sistema | null>(null);
    const [openedFromManager, setOpenedFromManager] = React.useState(false);

    const [isLoading, setIsLoading] = React.useState(true);

    // Load data
    const loadData = React.useCallback(async (silent = false) => {
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
            if (!silent) setIsLoading(false);
        }
    }, [tenant?.id]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter sistemas when ambiente changes
    React.useEffect(() => {
        if (selectedAmbienteId) {
            const filtered = sistemas.filter((s) => (s.ambienteIds || []).includes(selectedAmbienteId));
            setFilteredSistemas(filtered);
        } else {
            setFilteredSistemas([]);
        }
    }, [selectedAmbienteId, sistemas]);

    // Initialize from value
    React.useEffect(() => {
        if (value) {
            setSelectedAmbienteId(value.ambienteId);
            setSelectedSistemaId(value.sistemaId);
        }
    }, [value]);

    const handleAmbienteChange = (ambienteId: string) => {
        setSelectedAmbienteId(ambienteId);
        setSelectedSistemaId("");
        onChange(null);
    };

    const handleSistemaChange = (sistemaId: string) => {
        setSelectedSistemaId(sistemaId);

        if (!sistemaId) {
            onChange(null);
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
        const shouldSelect = (sistema.ambienteIds || []).includes(selectedAmbienteId);

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
    };

    const handleDeleteSistema = async () => {
        if (!selectedSistemaId) return;

        const sistema = sistemas.find((s) => s.id === selectedSistemaId);
        if (!sistema) return;

        if (!confirm(`Tem certeza que deseja excluir o template "${sistema.name}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            await SistemaService.deleteSistema(selectedSistemaId);
            setSelectedSistemaId("");
            onChange(null);
            loadData(true);
        } catch (error) {
            console.error("Error deleting sistema:", error);
            alert("Erro ao excluir sistema");
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

            {/* Sistema Selection */}
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

            {/* Selected Sistema Info */}
            {value && (
                <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium">{value.sistemaName}</span>
                        <span className="text-xs text-muted-foreground">
                            em {value.ambienteName}
                        </span>
                    </div>
                    {value.description && (
                        <p className="text-sm text-muted-foreground">{value.description}</p>
                    )}
                    {value.products.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                            {value.products.length} produto(s) incluído(s)
                        </div>
                    )}
                </div>
            )}

            {/* Dialogs */}
            <AmbienteManagerDialog
                isOpen={isAmbienteDialogOpen}
                onClose={() => setIsAmbienteDialogOpen(false)}
                onAmbientesChange={() => loadData(true)}
            />

            <SistemaTemplateDialog
                isOpen={isSistemaDialogOpen}
                onClose={() => {
                    setIsSistemaDialogOpen(false);
                    setOpenedFromManager(false);
                }}
                editingSistema={editingSistema}
                preselectedAmbienteId={selectedAmbienteId}
                onSave={handleSistemaCreated}
                onBack={openedFromManager ? () => setIsSistemaManagerOpen(true) : undefined}
            />

            <SistemaManagerDialog
                isOpen={isSistemaManagerOpen}
                onClose={() => setIsSistemaManagerOpen(false)}
                onSistemasChange={() => loadData(true)}
                filterAmbienteId={selectedAmbienteId}
                onEditSistema={(sistema) => {
                    setEditingSistema(sistema);
                    setOpenedFromManager(true);
                    setIsSistemaDialogOpen(true);
                }}
                onCreateNew={() => {
                    setEditingSistema(null);
                    setOpenedFromManager(true);
                    setIsSistemaDialogOpen(true);
                }}
            />
        </div>
    );
}
