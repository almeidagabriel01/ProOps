"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlanFeatures } from "@/types";
import { AdminService } from "@/services/admin-service";
import { Loader2 } from "lucide-react";
import { toast } from '@/lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  currentFeatures: PlanFeatures;
  onSaved: () => void;
}

const buildPlanFeaturesSnapshot = (features: PlanFeatures): string =>
  JSON.stringify({
    maxUsers: features.maxUsers,
    maxProducts: features.maxProducts,
    maxClients: features.maxClients,
    maxProposals: features.maxProposals,
    maxPdfTemplates: features.maxPdfTemplates,
    hasFinancial: features.hasFinancial,
    canCustomizeTheme: features.canCustomizeTheme,
    canEditPdfSections: features.canEditPdfSections,
  });

export function EditLimitsDialog({
  open,
  onClose,
  tenantId,
  tenantName,
  currentFeatures,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PlanFeatures>(currentFeatures);
  const [initialSnapshot, setInitialSnapshot] = useState("");

  useEffect(() => {
    if (currentFeatures) {
      setFormData(currentFeatures);
      setInitialSnapshot(buildPlanFeaturesSnapshot(currentFeatures));
    }
  }, [currentFeatures, open]);

  const hasChanges = useMemo(
    () => buildPlanFeaturesSnapshot(formData) !== initialSnapshot,
    [formData, initialSnapshot],
  );

  const handleChange = (field: keyof PlanFeatures, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setLoading(true);
    try {
      await AdminService.updateTenantLimits(tenantId, formData);
      toast.success(`Limites de "${tenantName}" atualizados com sucesso!`);
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar limites.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Limites: {tenantName}</DialogTitle>
          <DialogDescription>
            Defina limites personalizados para esta empresa. Use -1 para
            ilimitado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Máximo de Usuários</Label>
              <Input
                type="number"
                value={formData.maxUsers}
                onChange={(e) =>
                  handleChange("maxUsers", parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Máximo de Produtos</Label>
              <Input
                type="number"
                value={formData.maxProducts}
                onChange={(e) =>
                  handleChange("maxProducts", parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Máximo de Clientes</Label>
              <Input
                type="number"
                value={formData.maxClients}
                onChange={(e) =>
                  handleChange("maxClients", parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Máximo de Propostas (mês)</Label>
              <Input
                type="number"
                value={formData.maxProposals}
                onChange={(e) =>
                  handleChange("maxProposals", parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Templates PDF</Label>
              <Input
                type="number"
                value={formData.maxPdfTemplates}
                onChange={(e) =>
                  handleChange("maxPdfTemplates", parseInt(e.target.value))
                }
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm text-muted-foreground">
              Recursos Extras
            </h4>

            <div className="flex items-center justify-between">
              <Label htmlFor="financial">Módulo Financeiro</Label>
              <Switch
                id="financial"
                checked={formData.hasFinancial}
                onCheckedChange={(c) => handleChange("hasFinancial", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="theme">Customizar Tema</Label>
              <Switch
                id="theme"
                checked={formData.canCustomizeTheme}
                onCheckedChange={(c) => handleChange("canCustomizeTheme", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="pdf_edit">Editor PDF Avançado</Label>
              <Switch
                id="pdf_edit"
                checked={formData.canEditPdfSections}
                onCheckedChange={(c) => handleChange("canEditPdfSections", c)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || !hasChanges}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
