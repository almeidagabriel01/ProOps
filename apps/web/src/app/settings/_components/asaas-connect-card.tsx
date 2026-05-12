"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { CreditCard, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  AsaasService,
  type AsaasConnectionStatus,
  type AsaasOnboardingData,
} from "@/services/payment-service";
import { Loader } from "@/components/ui/loader";

const COMPANY_TYPES = [
  { value: "MEI", label: "MEI (Microempreendedor Individual)" },
  { value: "INDIVIDUAL", label: "Empresário Individual" },
  { value: "LIMITED", label: "Sociedade Limitada" },
  { value: "ASSOCIATION", label: "Associação" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  companyType: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  cpfCnpj: "",
  mobilePhone: "",
  companyType: "",
  postalCode: "",
  address: "",
  addressNumber: "",
  province: "",
};

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
}

export function AsaasConnectCard() {
  const [status, setStatus] = React.useState<AsaasConnectionStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true);
  const [showOnboardDialog, setShowOnboardDialog] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [isFetchingCep, setIsFetchingCep] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const data = await AsaasService.getStatus();
      setStatus(data);
    } catch {
      toast.error("Erro ao carregar status do Asaas.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleCepBlur = async () => {
    const cep = form.postalCode.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      setIsFetchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await res.json()) as ViaCepResponse;
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          address: data.logradouro || prev.address,
          province: data.bairro || prev.province,
        }));
        setErrors((prev) => {
          const next = { ...prev };
          if (data.logradouro) delete next.address;
          if (data.bairro) delete next.province;
          return next;
        });
      }
    } catch {
      // ViaCEP is non-critical — silently ignore errors
    } finally {
      setIsFetchingCep(false);
    }
  };

  const validateForm = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) nextErrors.name = "Nome é obrigatório";
    if (!form.email.trim()) nextErrors.email = "E-mail é obrigatório";
    else if (!EMAIL_RE.test(form.email.trim())) nextErrors.email = "E-mail inválido";

    const cpfCnpj = form.cpfCnpj.replace(/\D/g, "");
    if (!cpfCnpj) nextErrors.cpfCnpj = "CPF/CNPJ é obrigatório";
    else if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)
      nextErrors.cpfCnpj = "CPF deve ter 11 dígitos ou CNPJ 14 dígitos";

    if (!form.mobilePhone.replace(/\D/g, "")) nextErrors.mobilePhone = "Telefone é obrigatório";

    const postalCode = form.postalCode.replace(/\D/g, "");
    if (!postalCode) nextErrors.postalCode = "CEP é obrigatório";
    else if (postalCode.length !== 8) nextErrors.postalCode = "CEP deve ter 8 dígitos";

    if (!form.address.trim()) nextErrors.address = "Endereço é obrigatório";
    if (!form.addressNumber.trim()) nextErrors.addressNumber = "Número é obrigatório";
    if (!form.province.trim()) nextErrors.province = "Bairro é obrigatório";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsConnecting(true);
      const data: AsaasOnboardingData = {
        name: form.name.trim(),
        email: form.email.trim(),
        cpfCnpj: form.cpfCnpj,
        mobilePhone: form.mobilePhone,
        companyType: form.companyType || undefined,
        postalCode: form.postalCode,
        address: form.address.trim(),
        addressNumber: form.addressNumber.trim(),
        province: form.province.trim(),
      };
      await AsaasService.connect(data);
      toast.success("Pagamentos online habilitados com sucesso!");
      setShowOnboardDialog(false);
      setForm(INITIAL_FORM);
      setErrors({});
      await loadStatus();
    } catch {
      toast.error("Erro ao habilitar pagamentos. Verifique os dados e tente novamente.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setShowOnboardDialog(open);
    if (!open) {
      setForm(INITIAL_FORM);
      setErrors({});
    }
  };

  const handleConfirmDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await AsaasService.disconnect();
      toast.success("Pagamentos online desativados.");
      setStatus({ connected: false });
    } catch {
      toast.error("Erro ao desativar pagamentos.");
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  return (
    <>
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar pagamentos online?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso desativará os pagamentos nos links compartilhados. Você poderá reativar a
              qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisconnect} disabled={isDisconnecting}>
              {isDisconnecting && <Loader size="sm" className="mr-2" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showOnboardDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Habilitar Pagamentos Online</DialogTitle>
            <DialogDescription>
              Preencha os dados da sua empresa. A conta de recebimentos é criada automaticamente —
              seus dados são enviados diretamente ao Asaas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConnect} noValidate>
            <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1 py-1">
              <div>
                <Label>Nome / Razão Social</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Empresa ABC Ltda"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <span className="text-sm text-destructive mt-1 block">{errors.name}</span>
                )}
              </div>

              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="financeiro@empresa.com"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <span className="text-sm text-destructive mt-1 block">{errors.email}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CPF / CNPJ</Label>
                  <Input
                    value={form.cpfCnpj}
                    onChange={(e) => setField("cpfCnpj", e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className={errors.cpfCnpj ? "border-destructive" : ""}
                  />
                  {errors.cpfCnpj && (
                    <span className="text-sm text-destructive mt-1 block">{errors.cpfCnpj}</span>
                  )}
                </div>
                <div>
                  <Label>Telefone / WhatsApp</Label>
                  <Input
                    value={form.mobilePhone}
                    onChange={(e) => setField("mobilePhone", e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={errors.mobilePhone ? "border-destructive" : ""}
                  />
                  {errors.mobilePhone && (
                    <span className="text-sm text-destructive mt-1 block">
                      {errors.mobilePhone}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label>
                  Tipo de Empresa{" "}
                  <span className="text-muted-foreground text-xs">(opcional)</span>
                </Label>
                <Select
                  value={form.companyType}
                  onChange={(e) => setField("companyType", e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {COMPANY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>CEP</Label>
                <div className="relative">
                  <Input
                    value={form.postalCode}
                    onChange={(e) => setField("postalCode", e.target.value)}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    maxLength={9}
                    className={errors.postalCode ? "border-destructive pr-8" : "pr-8"}
                  />
                  {isFetchingCep && (
                    <Loader2
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {errors.postalCode && (
                  <span className="text-sm text-destructive mt-1 block">{errors.postalCode}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder="Rua / Avenida..."
                    className={errors.address ? "border-destructive" : ""}
                  />
                  {errors.address && (
                    <span className="text-sm text-destructive mt-1 block">{errors.address}</span>
                  )}
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={form.addressNumber}
                    onChange={(e) => setField("addressNumber", e.target.value)}
                    placeholder="123"
                    className={errors.addressNumber ? "border-destructive" : ""}
                  />
                  {errors.addressNumber && (
                    <span className="text-sm text-destructive mt-1 block">
                      {errors.addressNumber}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label>Bairro</Label>
                <Input
                  value={form.province}
                  onChange={(e) => setField("province", e.target.value)}
                  placeholder="Nome do bairro"
                  className={errors.province ? "border-destructive" : ""}
                />
                {errors.province && (
                  <span className="text-sm text-destructive mt-1 block">{errors.province}</span>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isConnecting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isConnecting} className="gap-2">
                {isConnecting && <Loader size="sm" />}
                {isConnecting ? "Criando conta..." : "Habilitar Pagamentos"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
                <CreditCard className="h-5 w-5 text-sky-500" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Pagamentos Online (Asaas)</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  Aceite PIX e boleto nos links compartilhados
                </CardDescription>
              </div>
            </div>
            {!isLoadingStatus && status && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {status.connected && status.environment === "sandbox" && (
                  <Badge variant="warning">Sandbox</Badge>
                )}
                <Badge variant={status.connected ? "success" : "secondary"}>
                  {status.connected ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Ativo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                      Inativo
                    </span>
                  )}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader size="sm" />
              Carregando status...
            </div>
          ) : status?.connected ? (
            <>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                {status.environment && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ambiente</span>
                    <span>{status.environment === "production" ? "Produção" : "Sandbox"}</span>
                  </div>
                )}
                {status.connectedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ativado em</span>
                    <span>
                      {new Date(status.connectedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={isDisconnecting}
              >
                {isDisconnecting && <Loader size="sm" className="mr-2" />}
                Desativar
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Habilite para aceitar PIX e boleto bancário nos links compartilhados. A conta de
                recebimentos é criada automaticamente — você não precisa criar uma conta no Asaas.
              </p>
              <Button size="sm" onClick={() => setShowOnboardDialog(true)}>
                <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                Habilitar Pagamentos
              </Button>
            </>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
            Cada transação paga está sujeita às taxas do Asaas. O ProOps não cobra taxa adicional.
            Você é responsável pela declaração fiscal dos valores recebidos.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
