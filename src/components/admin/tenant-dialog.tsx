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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TenantNiche, NICHE_LABELS } from "@/types";
import { TenantBillingInfo } from "@/services/admin-service";
import { ALLOWED_TYPES } from "@/services/storage-service";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "react-toastify";

export interface TenantFormData {
  name: string;
  color: string;
  logoUrl?: string;
  niche: TenantNiche;
  email?: string;
  password?: string;
  planId?: string;
  subscriptionStatus?: "active" | "past_due" | "canceled" | "unpaid" | "trialing";
  currentPeriodEnd?: string;
}

type PlanOption = {
  value: string;
  label: string;
};

const PLAN_OPTIONS: PlanOption[] = [
  { value: "free", label: "Gratuito" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Profissional" },
  { value: "enterprise", label: "Enterprise" },
];

interface TenantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TenantBillingInfo | null;
  onSave: (data: TenantFormData) => void;
  isSaving?: boolean;
}

export function TenantDialog({
  isOpen,
  onClose,
  initialData,
  onSave,
  isSaving = false,
}: TenantDialogProps) {
  const [formData, setFormData] = React.useState<TenantFormData>({
    name: "",
    color: "#3b82f6",
    logoUrl: "",
    niche: "automacao_residencial" as TenantNiche,
    email: "",
    password: "",
    planId: "free",
    subscriptionStatus: "active",
    currentPeriodEnd: "",
  });
  const [showPassword, setShowPassword] = React.useState(false);

  // Reset or Load data when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      console.log("TenantDialog Open. InitialData:", initialData);
      console.log("Admin Subscription Status:", initialData?.admin?.subscriptionStatus);

      if (initialData) {
        setFormData({
          name: initialData.tenant.name,
          color: initialData.tenant.primaryColor,
          logoUrl: initialData.tenant.logoUrl || "",
          niche: initialData.tenant.niche || "automacao_residencial",
          email: initialData.admin?.email || "",
          password: "",
          planId: initialData.planId || "free",
          subscriptionStatus: (initialData.admin?.subscription?.status?.toLowerCase() as TenantFormData["subscriptionStatus"]) || initialData.admin?.subscriptionStatus || "active",
          currentPeriodEnd: initialData.admin?.currentPeriodEnd || "",
        });
      } else {
        setFormData({
          name: "",
          color: "#3b82f6",
          logoUrl: "",
          niche: "automacao_residencial" as TenantNiche,
          email: "",
          password: "",
          planId: "free",
          subscriptionStatus: "active", // Default
          currentPeriodEnd: "",
        });
      }
    }
  }, [isOpen, initialData]);

  // Auto-fill date upon creating paid plan
  React.useEffect(() => {
    // Only if creating (no initialData) and plan became paid and date is empty
    if (!initialData && formData.planId !== "free" && !formData.currentPeriodEnd) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setFormData(prev => ({ ...prev, currentPeriodEnd: nextMonth.toISOString() }));
    }
  }, [formData.planId, initialData]); // removed formData.currentPeriodEnd to avoid overwrite loop

  // Auto-calculate status based on date (Manual Subscription)
  React.useEffect(() => {
    if (formData.planId === "free") return;
    if (!formData.currentPeriodEnd) return;

    const expiry = new Date(formData.currentPeriodEnd);
    const now = new Date();

    // Check if date is valid
    if (isNaN(expiry.getTime())) return;

    if (expiry < now) {
      // Expired
      if (formData.subscriptionStatus !== "past_due" && formData.subscriptionStatus !== "canceled") {
        setFormData(prev => ({ ...prev, subscriptionStatus: "past_due" }));
      }
    } else {
      // Future
      if (formData.subscriptionStatus === "past_due") {
        // Reactivate if it was past due
        setFormData(prev => ({ ...prev, subscriptionStatus: "active" }));
      }
    }
  }, [formData.currentPeriodEnd, formData.planId, formData.subscriptionStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("O nome da empresa é obrigatório.");
      return;
    }

    const isCreating = !initialData;
    if (isCreating) {
      if (!formData.email || !formData.password) {
        toast.error("Email e senha são obrigatórios para criar uma empresa.");
        return;
      }
    }

    if (formData.password && formData.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    onSave(formData);
  };

  const isEditing = !!initialData;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Empresa" : "Nova Empresa"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Gerencie as informações e assinatura da empresa."
              : "Preencha os dados para criar um novo ambiente."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-2">
            <Tabs defaultValue="company" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="company">Empresa</TabsTrigger>
                <TabsTrigger value="subscription">Assinatura</TabsTrigger>
                <TabsTrigger value="access">Acesso</TabsTrigger>
              </TabsList>

              {/* Tab: Empresa */}
              <TabsContent value="company" className="space-y-6 pt-4">
                {/* Name */}
                <div className="space-y-1">
                  <Label htmlFor="name" className="mb-3 block">Nome da Empresa</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Minha Empresa"
                  />
                </div>

                {/* Cor e Nicho */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="color" className="mb-3 block">Cor Principal</Label>
                    <div className="flex gap-2">
                      <Input
                        id="color"
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-14 h-10 p-1 cursor-pointer shrink-0"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="font-mono flex-1"
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="niche" className="mb-3 block">Nicho</Label>
                    <Select
                      id="niche"
                      value={formData.niche}
                      onChange={(e) => setFormData({ ...formData, niche: e.target.value as TenantNiche })}
                    >
                      {(Object.keys(NICHE_LABELS) as TenantNiche[]).map((key) => (
                        <option key={key} value={key}>{NICHE_LABELS[key]}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Logo */}
                <div className="space-y-1">
                  <Label htmlFor="logo" className="mb-3 block">Logo</Label>
                  <div className="flex items-center gap-4">
                    {formData.logoUrl ? (
                      <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, logoUrl: "" })}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center hover:bg-destructive/80"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 shrink-0">
                        <span className="text-2xl text-muted-foreground">{formData.name ? formData.name.charAt(0).toUpperCase() : "?"}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!ALLOWED_TYPES.includes(file.type)) {
                              toast.error("Formato inválido (apenas imagens).");
                              return;
                            }
                            if (file.size > 2 * 1024 * 1024) {
                              toast.error("Máximo 2MB.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => setFormData({ ...formData, logoUrl: ev.target?.result as string });
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG (Max 2MB)</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Assinatura */}
              <TabsContent value="subscription" className="space-y-6 pt-4">
                <div className="space-y-1">
                  <Label htmlFor="planId" className="mb-3 block">Plano</Label>
                  <Select
                    id="planId"
                    value={formData.planId}
                    onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan.value} value={plan.value}>{plan.label}</option>
                    ))}
                  </Select>
                </div>

                {formData.planId !== "free" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="subscriptionStatus" className="mb-3 block">Status da Assinatura</Label>
                      <Input
                        id="subscriptionStatus"
                        value={
                          formData.subscriptionStatus === "active" ? "Ativa" :
                            formData.subscriptionStatus === "past_due" ? "Em Atraso (Past Due)" :
                              formData.subscriptionStatus === "canceled" ? "Cancelada" :
                                formData.subscriptionStatus === "trialing" ? "Em Teste" :
                                  "Não Paga"
                        }
                        disabled
                        className="bg-muted opacity-100 text-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Status calculado automaticamente pela data.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="currentPeriodEnd" className="mb-3 block">Próximo Pagamento</Label>
                      <Input
                        id="currentPeriodEnd"
                        type="date"
                        value={formData.currentPeriodEnd ? new Date(formData.currentPeriodEnd).toLocaleDateString("en-CA") : ""}
                        onChange={(e) => {
                          // Create date at Local Midnight to avoid timezone shifts
                          const date = new Date(e.target.value + "T00:00:00");
                          setFormData({
                            ...formData,
                            currentPeriodEnd: date.toISOString()
                          });
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Define vencimento/expiração.</p>
                    </div>
                  </div>
                )}
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  {isEditing ? "Alterar o plano recalcula limites." : "O plano define os limites iniciais."}
                </div>
              </TabsContent>

              {/* Tab: Acesso */}
              <TabsContent value="access" className="space-y-6 pt-4">
                <div className="space-y-1">
                  <Label htmlFor="email" className="mb-3 block">Email do Administrador</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin@empresa.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password" className="mb-3 block">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={isEditing ? "Nova senha (opcional)" : "Mínimo 6 caracteres"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isEditing ? "Deixe em branco para manter a atual." : "Credencial de acesso ao painel."}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
