"use client";

import * as React from "react";
import { CheckCircle2, Gift, Lock, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/ui/loader";
import { AdminService, type TenantModulesInfo } from "@/services/admin-service";
import { ADDON_DEFINITIONS } from "@/services/addon-service";
import { toast } from "@/lib/toast";

interface TenantModulesDialogProps {
  tenantId: string | null;
  tenantName: string;
  onClose: () => void;
}

function formatLimit(value: number): string {
  return value < 0 ? "Ilimitado" : value.toLocaleString("pt-BR");
}

/**
 * "Plano e modulos" da empresa: o que esta liberado e de onde veio (plano ou
 * add-on), os limites do plano e a concessao de add-on de cortesia.
 * Substitui o "Editar Limites", que chamava uma rota inexistente.
 */
export function TenantModulesDialog({ tenantId, tenantName, onClose }: TenantModulesDialogProps) {
  const [data, setData] = React.useState<TenantModulesInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingAddon, setPendingAddon] = React.useState<string | null>(null);

  const load = React.useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      setData(await AdminService.getTenantModules(id));
    } catch {
      toast.error("Erro ao carregar os módulos da empresa.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (tenantId) {
      setData(null);
      void load(tenantId);
    }
  }, [tenantId, load]);

  const toggleCourtesy = async (addonId: string, enable: boolean) => {
    if (!tenantId) return;
    setPendingAddon(addonId);
    try {
      if (enable) {
        await AdminService.grantCourtesyAddon(tenantId, addonId);
        toast.success("Add-on concedido como cortesia.");
      } else {
        await AdminService.revokeCourtesyAddon(tenantId, addonId);
        toast.success("Cortesia removida.");
      }
      await load(tenantId);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Erro ao alterar o add-on.");
    } finally {
      setPendingAddon(null);
    }
  };

  const addonRows = data
    ? ADDON_DEFINITIONS.filter((def) =>
        data.availableAddons.some((a) => a.id === def.id),
      ).map((def) => {
        const record = data.addons.find(
          (a) => a.addonId === def.id && a.status !== "cancelled",
        );
        const availableForTier =
          data.availableAddons
            .find((a) => a.id === def.id)
            ?.availableForTiers.includes(data.tier) ?? false;
        return { def, record, availableForTier };
      })
    : [];

  return (
    <Dialog open={Boolean(tenantId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plano e módulos</DialogTitle>
          <DialogDescription>
            {tenantName}
            {data && (
              <>
                {" · plano "}
                <strong>{data.tierLabel}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && !data ? (
          <div className="flex justify-center py-10">
            <Loader size="md" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Módulos</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(data.capabilityLabels).map(([key, label]) => {
                  const enabled = data.capabilities[key] === true;
                  const fromPlan = data.tierCapabilities[key] === true;
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {enabled ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                        )}
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {enabled ? (fromPlan ? "Plano" : "Add-on") : "Bloqueado"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Limites do plano</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {Object.entries(data.limitLabels).map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-2 border-b py-1">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{formatLimit(data.limits[key] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Add-ons</h3>
              <p className="text-xs text-muted-foreground">
                A cortesia libera o módulo sem cobrança e fica registrada na
                auditoria. Add-on pago pelo cliente é gerenciado pela assinatura
                dele e não pode ser alterado aqui.
              </p>
              <ul className="space-y-2">
                {addonRows.map(({ def, record, availableForTier }) => {
                  const isPaid = record?.source === "stripe";
                  const isCourtesy = Boolean(record) && !isPaid;
                  return (
                    <li
                      key={def.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2">
                          {def.name}
                          {isPaid && (
                            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                              <Sparkles className="h-3 w-3" /> Pago
                            </Badge>
                          )}
                          {isCourtesy && (
                            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                              <Gift className="h-3 w-3" /> Cortesia
                            </Badge>
                          )}
                        </p>
                        {!availableForTier && !record && (
                          <p className="text-xs text-muted-foreground">
                            Não é vendido para o plano {data.tierLabel}; já vem incluso ou não se aplica.
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={Boolean(record)}
                        disabled={isPaid || pendingAddon !== null || (!record && !availableForTier)}
                        onCheckedChange={(checked) => toggleCourtesy(def.id, checked)}
                        aria-label={`Cortesia: ${def.name}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
