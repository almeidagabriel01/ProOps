"use client";

import * as React from "react";
import { Loader2, Receipt, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import { FiscalService } from "@/services/fiscal-service";
import { TenantFiscalConfig } from "@/types/fiscal";

type FiscalConfigFormProps = {
  isMaster: boolean;
};

type ReadinessState = {
  ready: boolean;
  reasonCode?: string;
  reasonMessage?: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function createEmptyConfig(): TenantFiscalConfig {
  const now = new Date().toISOString();
  return {
    id: "",
    tenantId: "",
    provider: "focus_nfe",
    environment: "homologation",
    onboardingStatus: "incomplete",
    issuer: {
      legalName: "",
      cnpj: "",
      municipalRegistration: "",
      municipalCode: "",
      email: null,
      phone: null,
    },
    nfse: {
      serviceItemCode: "",
      municipalTaxCode: null,
      taxRate: 0,
      natureOperation: "1",
      simpleNational: true,
      culturalIncentive: false,
      specialTaxRegime: null,
      withheldIss: false,
    },
    focus: { companyReference: null },
    createdAt: now,
    updatedAt: now,
  };
}

function deriveOnboardingStatus(
  config: TenantFiscalConfig,
): "ready" | "incomplete" {
  const { issuer, nfse } = config;
  if (
    issuer.legalName.trim() &&
    issuer.cnpj.trim() &&
    issuer.municipalRegistration.trim() &&
    issuer.municipalCode.trim() &&
    nfse.serviceItemCode.trim() &&
    Number.isFinite(nfse.taxRate) &&
    nfse.taxRate > 0
  ) {
    return "ready";
  }
  return "incomplete";
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                        */
/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && (
        <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium break-words">{String(value || "—")}</p>
    </div>
  );
}

function ToggleField({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        {hint && (
          <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                        */
/* ------------------------------------------------------------------ */

export function FiscalConfigForm({ isMaster }: FiscalConfigFormProps) {
  const [formData, setFormData] = React.useState<TenantFiscalConfig>(
    createEmptyConfig(),
  );
  const [initialConfig, setInitialConfig] = React.useState<TenantFiscalConfig>(
    createEmptyConfig(),
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [readiness, setReadiness] = React.useState<ReadinessState>({
    ready: false,
  });

  React.useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await FiscalService.getConfig();
        if (!isMounted) return;

        const nextConfig = response.config || createEmptyConfig();
        setFormData(nextConfig);
        setInitialConfig(nextConfig);
        setReadiness(response.readiness);
      } catch (error) {
        if (!isMounted) return;
        console.error(error);
        toast.error("Erro ao carregar configuração fiscal.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialConfig);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: TenantFiscalConfig = {
        ...formData,
        onboardingStatus: deriveOnboardingStatus(formData),
      };
      const response = await FiscalService.saveConfig(payload);
      const nextConfig = response.config || createEmptyConfig();
      setFormData(nextConfig);
      setInitialConfig(nextConfig);
      setReadiness(response.readiness);
      toast.success("Configuração fiscal atualizada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar configuração fiscal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => setFormData(initialConfig);

  const updateIssuer = (
    field: keyof TenantFiscalConfig["issuer"],
    value: string,
  ) => {
    setFormData((c) => ({ ...c, issuer: { ...c.issuer, [field]: value } }));
  };

  const updateNfse = (
    field: keyof TenantFiscalConfig["nfse"],
    value: string | number | boolean,
  ) => {
    setFormData((c) => ({ ...c, nfse: { ...c.nfse, [field]: value } }));
  };

  const envLabel =
    formData.environment === "production" ? "Produção" : "Homologação";

  /* ---------------------------------------------------------------- */
  /* Read-only view for non-master users                               */
  /* ---------------------------------------------------------------- */
  if (!isMaster) {
    const hasConfig = !!formData.issuer.legalName || !!formData.issuer.cnpj;

    return (
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">
                Configuração Fiscal
              </p>
              <p className="text-sm text-muted-foreground">
                NFS-e — configurado pelo administrador
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : !hasConfig ? (
            <p className="text-sm text-muted-foreground">
              Configuração fiscal ainda não definida.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <ReadOnlyField
                label="Razão social"
                value={formData.issuer.legalName}
              />
              <ReadOnlyField label="CNPJ" value={formData.issuer.cnpj} />
              <ReadOnlyField
                label="Inscrição municipal"
                value={formData.issuer.municipalRegistration}
              />
              <ReadOnlyField
                label="Município IBGE"
                value={formData.issuer.municipalCode}
              />
              <ReadOnlyField
                label="Cód. serviço"
                value={formData.nfse.serviceItemCode}
              />
              <ReadOnlyField
                label="Alíquota ISS"
                value={
                  formData.nfse.taxRate ? `${formData.nfse.taxRate}%` : undefined
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Master / admin editable view                                      */
  /* ---------------------------------------------------------------- */
  const readinessVariant = readiness.ready ? "success" : "warning";
  const readinessLabel = readiness.ready
    ? "Pronto para emitir"
    : "Configuração pendente";

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b border-border/50 pb-5">
        {/* Row 1: icon + title/description */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">
              Configuração Fiscal
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              NFS-e — emissão automática ao aprovar proposta com serviços
            </p>
          </div>
        </div>

        {/* Row 2: badges (always on their own line, wrap freely) */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant={readinessVariant}>{readinessLabel}</Badge>
          <Badge variant="secondary">{envLabel}</Badge>
        </div>

        {/* Readiness message */}
        {!readiness.ready && readiness.reasonMessage && (
          <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
            {readiness.reasonMessage}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando configuração fiscal...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Emitente */}
            <div>
              <p className="mb-3 text-sm font-semibold tracking-tight">
                Dados do emitente
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field id="fiscal-legalName" label="Razão social">
                    <Input
                      id="fiscal-legalName"
                      value={formData.issuer.legalName}
                      onChange={(e) =>
                        updateIssuer("legalName", e.target.value)
                      }
                      placeholder="Nome jurídico da empresa"
                    />
                  </Field>
                </div>
                <Field
                  id="fiscal-cnpj"
                  label="CNPJ"
                  hint="Somente dígitos, ex: 07506399000126"
                >
                  <Input
                    id="fiscal-cnpj"
                    value={formData.issuer.cnpj}
                    onChange={(e) => updateIssuer("cnpj", e.target.value)}
                    placeholder="07506399000126"
                    maxLength={14}
                  />
                </Field>
                <Field
                  id="fiscal-im"
                  label="Inscrição municipal"
                  hint="Somente dígitos"
                >
                  <Input
                    id="fiscal-im"
                    value={formData.issuer.municipalRegistration}
                    onChange={(e) =>
                      updateIssuer("municipalRegistration", e.target.value)
                    }
                    placeholder="12345"
                  />
                </Field>
                <Field
                  id="fiscal-cityCode"
                  label="Código IBGE do município"
                  hint="Ex: 3550308 (São Paulo)"
                >
                  <Input
                    id="fiscal-cityCode"
                    value={formData.issuer.municipalCode}
                    onChange={(e) =>
                      updateIssuer("municipalCode", e.target.value)
                    }
                    placeholder="3550308"
                  />
                </Field>
              </div>
            </div>

            {/* NFS-e */}
            <div>
              <p className="mb-3 text-sm font-semibold tracking-tight">
                Parâmetros da NFS-e
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id="fiscal-serviceCode"
                  label="Código do item de serviço"
                  hint="Aceito pelo seu município"
                >
                  <Input
                    id="fiscal-serviceCode"
                    value={formData.nfse.serviceItemCode}
                    onChange={(e) =>
                      updateNfse("serviceItemCode", e.target.value)
                    }
                    placeholder="0107"
                  />
                </Field>
                <Field id="fiscal-taxRate" label="Alíquota ISS (%)">
                  <Input
                    id="fiscal-taxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.nfse.taxRate || ""}
                    onChange={(e) =>
                      updateNfse("taxRate", Number(e.target.value || 0))
                    }
                    placeholder="5.00"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    id="fiscal-environment"
                    label="Ambiente"
                    hint="Use Homologação para testar sem emitir notas reais"
                  >
                    <select
                      id="fiscal-environment"
                      value={formData.environment}
                      onChange={(e) =>
                        setFormData((c) => ({
                          ...c,
                          environment:
                            e.target.value === "production"
                              ? "production"
                              : "homologation",
                        }))
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="homologation">Homologação (gratuito)</option>
                      <option value="production">Produção</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            {/* Marcadores fiscais */}
            <div>
              <p className="mb-3 text-sm font-semibold tracking-tight">
                Marcadores fiscais
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ToggleField
                  id="fiscal-simpleNational"
                  label="Simples Nacional"
                  hint="Enquadramento padrão do emitente"
                  checked={formData.nfse.simpleNational !== false}
                  onCheckedChange={(v) => updateNfse("simpleNational", v)}
                />
                <ToggleField
                  id="fiscal-withheldIss"
                  label="ISS retido"
                  hint="Ative se o ISS for retido pelo tomador"
                  checked={formData.nfse.withheldIss === true}
                  onCheckedChange={(v) => updateNfse("withheldIss", v)}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {!isLoading && (
        <CardFooter className="border-t border-border/50 bg-muted/10 px-6 py-4">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isSaving || !hasChanges}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="min-w-[160px] gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar configuração
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
