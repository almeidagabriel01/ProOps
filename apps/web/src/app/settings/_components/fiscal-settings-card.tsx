"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  Upload,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FiscalService,
  type FiscalAddress,
  type FiscalSettings,
  type FiscalTaxRegime,
  type FiscalNfsePadrao,
} from "@/services/fiscal-service";
import { cnpj as cnpjValidator } from "cpf-cnpj-validator";
import { humanizeRejection } from "@/lib/fiscal/rejection-messages";

/** ViaCEP devolve o código IBGE em `ibge` — é ele que a SEFAZ valida. */
interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
}

const EMPTY_ADDRESS: FiscalAddress = {
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  codigoIbge: "",
  uf: "",
  cep: "",
};

interface FormState {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cnae: string;
  regimeTributario: FiscalTaxRegime;
  email: string;
  telefone: string;
  endereco: FiscalAddress;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  padraoNfse: FiscalNfsePadrao;
  serieNfe: string;
  proximoNumeroNfe: string;
  serieNfse: string;
  proximoNumeroNfse: string;
  certificadoValidade: string;
  certificadoSenha: string;
}

const INITIAL_FORM: FormState = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  cnae: "",
  regimeTributario: 1,
  email: "",
  telefone: "",
  endereco: { ...EMPTY_ADDRESS },
  habilitaNfe: false,
  habilitaNfse: true,
  padraoNfse: "nacional",
  serieNfe: "",
  proximoNumeroNfe: "",
  serieNfse: "",
  proximoNumeroNfse: "",
  certificadoValidade: "",
  certificadoSenha: "",
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function maskCnpj(value: string): string {
  const d = digits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function hydrate(settings: FiscalSettings): FormState {
  return {
    ...INITIAL_FORM,
    cnpj: settings.cnpj ? maskCnpj(settings.cnpj) : "",
    razaoSocial: settings.razaoSocial ?? "",
    nomeFantasia: settings.nomeFantasia ?? "",
    inscricaoEstadual: settings.inscricaoEstadual ?? "",
    inscricaoMunicipal: settings.inscricaoMunicipal ?? "",
    cnae: settings.cnae ?? "",
    regimeTributario: settings.regimeTributario ?? 1,
    email: settings.email ?? "",
    telefone: settings.telefone ?? "",
    endereco: settings.endereco ?? { ...EMPTY_ADDRESS },
    habilitaNfe: settings.habilitaNfe ?? false,
    habilitaNfse: settings.habilitaNfse ?? true,
    padraoNfse: settings.padraoNfse ?? "nacional",
    serieNfe: settings.serieNfe != null ? String(settings.serieNfe) : "",
    proximoNumeroNfe:
      settings.proximoNumeroNfe != null ? String(settings.proximoNumeroNfe) : "",
    serieNfse: settings.serieNfse ?? "",
    proximoNumeroNfse:
      settings.proximoNumeroNfse != null ? String(settings.proximoNumeroNfse) : "",
    certificadoValidade: settings.certificadoValidade ?? "",
    certificadoSenha: "",
  };
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Incompleto", variant: "secondary" },
  registered: { label: "Aguardando nota de teste", variant: "secondary" },
  ready: { label: "Pronto para emitir", variant: "default" },
  error: { label: "Com erro", variant: "destructive" },
};

interface FiscalSettingsCardProps {
  onLoadingChange?: (loading: boolean) => void;
}

export function FiscalSettingsCard({ onLoadingChange }: FiscalSettingsCardProps) {
  const [settings, setSettings] = React.useState<FiscalSettings | null>(null);
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLookingUp, setIsLookingUp] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isRetryingWebhooks, setIsRetryingWebhooks] = React.useState(false);
  const certificateInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await FiscalService.getSettings();
        if (cancelled) return;
        setSettings(data);
        if (data.configured) setForm(hydrate(data));
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar a configuração fiscal.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          onLoadingChange?.(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onLoadingChange]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setAddress = <K extends keyof FiscalAddress>(key: K, value: FiscalAddress[K]) =>
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, [key]: value } }));

  /**
   * Preenche razão social, endereço, código IBGE e CNAE a partir do CNPJ.
   * O benchmark mostrou que todo ERP pede 40 campos e só depois revela o que
   * faltava — pedir o CNPJ primeiro elimina a maior parte da digitação.
   */
  const handleLookupCnpj = async () => {
    const clean = digits(form.cnpj);
    if (clean.length !== 14) {
      toast.error("Informe um CNPJ completo para buscar.");
      return;
    }
    // Dígito verificador errado é digitação, não CNPJ inexistente — e a
    // diferença importa: "não encontramos" manda o usuário procurar o problema
    // na Receita quando ele está no teclado dele.
    if (!cnpjValidator.isValid(clean)) {
      toast.error("Esse CNPJ não é válido.", {
        description: "Os dígitos verificadores não batem. Confira a digitação.",
      });
      return;
    }
    setIsLookingUp(true);
    try {
      const data = await FiscalService.lookupCnpj(clean);
      setForm((prev) => ({
        ...prev,
        razaoSocial: data.razaoSocial || prev.razaoSocial,
        nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
        cnae: data.cnae || prev.cnae,
        // A Receita sabe se a empresa é optante — melhor fonte que a memória de
        // quem preenche, e errar aqui troca CSOSN por CST na nota inteira.
        regimeTributario: data.regimeTributario ?? prev.regimeTributario,
        endereco: {
          ...prev.endereco,
          logradouro: data.logradouro || prev.endereco.logradouro,
          numero: data.numero || prev.endereco.numero,
          complemento: data.complemento || prev.endereco.complemento,
          bairro: data.bairro || prev.endereco.bairro,
          municipio: data.municipio || prev.endereco.municipio,
          codigoIbge: data.codigoIbge || prev.endereco.codigoIbge,
          uf: data.uf || prev.endereco.uf,
          cep: data.cep || prev.endereco.cep,
        },
      }));
      const situacao = data.situacaoCadastral?.trim();
      if (situacao && situacao.toLowerCase() !== "ativa") {
        // Um CNPJ baixado ou suspenso passa no cadastro e só falha na emissão,
        // quando já há certificado enviado e nota montada.
        toast.error(`CNPJ com situação cadastral "${situacao}".`, {
          description: "Só CNPJ ativo emite nota. Regularize antes de continuar.",
        });
      } else {
        toast.success("Dados da empresa preenchidos.");
      }
    } catch {
      // Falha na consulta é perda de conveniência, não bloqueio.
      toast.error("Não encontramos esse CNPJ. Preencha os dados manualmente.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCepBlur = async () => {
    const cep = digits(form.endereco.cep);
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await res.json()) as ViaCepResponse;
      if (data.erro) return;
      setForm((prev) => ({
        ...prev,
        endereco: {
          ...prev.endereco,
          logradouro: data.logradouro || prev.endereco.logradouro,
          bairro: data.bairro || prev.endereco.bairro,
          municipio: data.localidade || prev.endereco.municipio,
          uf: data.uf || prev.endereco.uf,
          // O código IBGE não é digitável e é uma das rejeições mais comuns
          // quando falta — vem daqui.
          codigoIbge: data.ibge || prev.endereco.codigoIbge,
        },
      }));
    } catch {
      // ViaCEP é auxiliar; falhar em silêncio é melhor que travar o formulário.
    }
  };

  /**
   * Payload de configuração a partir do formulário.
   *
   * Extraído porque o envio do certificado precisa gravar os mesmos dados antes
   * de registrar a empresa — ver `handleCertificateUpload`.
   */
  const buildSettingsPayload = () => ({
        cnpj: digits(form.cnpj),
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        inscricaoEstadual: form.inscricaoEstadual.trim(),
        inscricaoMunicipal: form.inscricaoMunicipal.trim(),
        cnae: form.cnae.trim(),
        regimeTributario: form.regimeTributario,
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        endereco: {
          ...form.endereco,
          cep: digits(form.endereco.cep),
          codigoIbge: digits(form.endereco.codigoIbge),
          uf: form.endereco.uf.toUpperCase(),
        },
        habilitaNfe: form.habilitaNfe,
        habilitaNfse: form.habilitaNfse,
        padraoNfse: form.padraoNfse,
        serieNfe: form.serieNfe ? Number(form.serieNfe) : undefined,
        proximoNumeroNfe: form.proximoNumeroNfe ? Number(form.proximoNumeroNfe) : undefined,
        serieNfse: form.serieNfse.trim(),
        proximoNumeroNfse: form.proximoNumeroNfse
          ? Number(form.proximoNumeroNfse)
          : undefined,
        certificadoSenha: form.certificadoSenha || undefined,
  });

  const handleRetryWebhooks = async () => {
    setIsRetryingWebhooks(true);
    try {
      const updated = await FiscalService.retryWebhooks();
      setSettings(updated);
      toast[updated.webhookStatus?.state === "registered" ? "success" : "error"](
        updated.webhookStatus?.state === "registered"
          ? "Notificação automática registrada."
          : "Ainda não foi possível registrar.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar.");
    } finally {
      setIsRetryingWebhooks(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await FiscalService.saveSettings(buildSettingsPayload());
      setSettings(saved);
      toast.success("Configuração fiscal salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Envia o certificado A1 ao provedor. O arquivo não é guardado pelo ProOps —
   * é lido, transmitido e descartado.
   */
  const handleCertificateUpload = async (file: File) => {
    if (!form.certificadoSenha) {
      toast.error("Informe a senha do certificado antes de enviá-lo.");
      return;
    }
    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });

      // Grava a configuração antes de registrar. O cadastro no provedor é
      // montado a partir dos dados JÁ salvos, então exigir um "Salvar" separado
      // antes deste botão era uma armadilha: quem pulasse recebia
      // "Configure os dados fiscais antes de registrar o emitente" com o
      // formulário inteiro preenchido na frente, sem dizer o que fazer.
      setSettings(await FiscalService.saveSettings(buildSettingsPayload()));

      // Valida tudo antes de criar de verdade: senha, titularidade do CNPJ e
      // prazo do certificado são conferidos pelo provedor sem persistir nada.
      // Se falhar aqui, nenhuma empresa fica meio criada do lado dele.
      await FiscalService.registerIssuer({
        certificadoBase64: base64,
        certificadoSenha: form.certificadoSenha,
        dryRun: true,
      });

      await FiscalService.registerIssuer({
        certificadoBase64: base64,
        certificadoSenha: form.certificadoSenha,
      });

      const refreshed = await FiscalService.getSettings();
      setSettings(refreshed);
      toast.success("Certificado enviado e empresa registrada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const humanized = humanizeRejection(undefined, message);
      toast.error(humanized.titulo, { description: humanized.explicacao });
    } finally {
      setIsUploading(false);
      if (certificateInputRef.current) certificateInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const status = settings?.status ? STATUS_LABEL[settings.status] : undefined;
  const diasParaVencer = settings?.certificadoDiasParaVencer;
  /**
   * Emitente cadastrado cujo gatilho não está confirmado como registrado.
   *
   * Uma constante, e não a condição repetida no JSX, porque ela precisa
   * aparecer em DOIS lugares: no bloco do alerta e na guarda do `CardContent`
   * que o contém. Foi essa duplicação que escondeu o alerta — a guarda externa
   * só considerava `lastError` e validade do certificado, então o aviso existia
   * no código e nunca chegava à tela.
   */
  const gatilhoPendente =
    Boolean(settings?.status) &&
    settings?.status !== "pending" &&
    settings?.webhookStatus?.state !== "registered";

  return (
    <div className="flex flex-col gap-4">
      {/* Estado atual */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Emissão de notas fiscais
              </CardTitle>
              <CardDescription>
                Configure sua empresa para emitir NF-e de produto e NFS-e de serviço.
              </CardDescription>
            </div>
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
        </CardHeader>

        {(settings?.lastError || typeof diasParaVencer === "number" || gatilhoPendente) && (
          <CardContent className="flex flex-col gap-3 pt-0">
            {typeof diasParaVencer === "number" && diasParaVencer <= 30 && (
              <div
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  diasParaVencer < 0
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-amber-500/40 bg-amber-500/5"
                }`}
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {diasParaVencer < 0
                    ? `Seu certificado digital venceu há ${Math.abs(diasParaVencer)} dia(s). Nenhuma nota será emitida até a renovação.`
                    : `Seu certificado digital vence em ${diasParaVencer} dia(s). Renove antes para não interromper a emissão.`}
                </span>
              </div>
            )}
            {/* Ausência de status NÃO é sinal de sucesso: o registro só acontece
                no envio do certificado, então um emitente cadastrado antes desta
                tela nunca teve tentativa nenhuma. Mostrar o alerta só quando há
                falha registrada esconde exatamente o caso mais comum — foi o que
                aconteceu aqui: nenhum gatilho no provedor e nenhum aviso. */}
            {gatilhoPendente && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">
                    {settings?.webhookStatus
                      ? "Notificação automática não registrada"
                      : "Notificação automática ainda não configurada"}
                  </p>
                  <p className="text-muted-foreground">
                    As notas continuam sendo emitidas, mas o resultado só chega pela
                    consulta periódica — pode demorar até 15 minutos para aparecer.
                  </p>
                  {settings?.webhookStatus?.lastError && (
                    <p className="font-mono text-xs text-muted-foreground/80">
                      {settings.webhookStatus?.lastError}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isRetryingWebhooks}
                  onClick={handleRetryWebhooks}
                >
                  {isRetryingWebhooks && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  Tentar de novo
                </Button>
              </div>
            )}
            {settings?.lastError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{humanizeRejection(undefined, settings.lastError).explicacao}</span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Dados da empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da empresa</CardTitle>
          <CardDescription>
            Informe o CNPJ e busque, o resto é preenchido automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="fiscal-cnpj">CNPJ</Label>
            <div className="flex gap-2">
              <Input
                id="fiscal-cnpj"
                value={form.cnpj}
                onChange={(e) => setField("cnpj", maskCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLookupCnpj}
                disabled={isLookingUp}
              >
                {isLookingUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Buscar</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="fiscal-razao">Razão social</Label>
            <Input
              id="fiscal-razao"
              value={form.razaoSocial}
              onChange={(e) => setField("razaoSocial", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-fantasia">Nome fantasia</Label>
            <Input
              id="fiscal-fantasia"
              value={form.nomeFantasia}
              onChange={(e) => setField("nomeFantasia", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-email">E-mail fiscal</Label>
            <Input
              id="fiscal-email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-regime">Regime tributário</Label>
            <Select
              id="fiscal-regime"
              value={String(form.regimeTributario)}
              onChange={(e) =>
                setField("regimeTributario", Number(e.target.value) as FiscalTaxRegime)
              }
            >
              <option value="1">Simples Nacional</option>
              <option value="2">Simples Nacional — excesso de sublimite</option>
              <option value="3">Regime Normal (Presumido ou Real)</option>
              <option value="4">MEI</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-cnae">CNAE principal</Label>
            <Input
              id="fiscal-cnae"
              value={form.cnae}
              onChange={(e) => setField("cnae", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-ie">Inscrição estadual</Label>
            <Input
              id="fiscal-ie"
              value={form.inscricaoEstadual}
              onChange={(e) => setField("inscricaoEstadual", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Obrigatória para NF-e de produto.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-im">Inscrição municipal</Label>
            <Input
              id="fiscal-im"
              value={form.inscricaoMunicipal}
              onChange={(e) => setField("inscricaoMunicipal", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Obrigatória para NFS-e de serviço.</p>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endereço do emitente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-cep">CEP</Label>
            <Input
              id="fiscal-cep"
              value={form.endereco.cep}
              onChange={(e) => setAddress("cep", e.target.value)}
              onBlur={handleCepBlur}
              inputMode="numeric"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-logradouro">Logradouro</Label>
            <Input
              id="fiscal-logradouro"
              value={form.endereco.logradouro}
              onChange={(e) => setAddress("logradouro", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-numero">Número</Label>
            <Input
              id="fiscal-numero"
              value={form.endereco.numero}
              onChange={(e) => setAddress("numero", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-complemento">Complemento</Label>
            <Input
              id="fiscal-complemento"
              value={form.endereco.complemento ?? ""}
              onChange={(e) => setAddress("complemento", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-bairro">Bairro</Label>
            <Input
              id="fiscal-bairro"
              value={form.endereco.bairro}
              onChange={(e) => setAddress("bairro", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-municipio">Município</Label>
            <Input
              id="fiscal-municipio"
              value={form.endereco.municipio}
              onChange={(e) => setAddress("municipio", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-uf">UF</Label>
            <Input
              id="fiscal-uf"
              value={form.endereco.uf}
              onChange={(e) => setAddress("uf", e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fiscal-ibge">Código IBGE do município</Label>
            <Input
              id="fiscal-ibge"
              value={form.endereco.codigoIbge}
              onChange={(e) => setAddress("codigoIbge", e.target.value)}
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              Preenchido pela busca de CEP. A SEFAZ valida o município por este código.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documentos e numeração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos e numeração</CardTitle>
          <CardDescription>
            A numeração precisa continuar de onde a empresa parou, senão a SEFAZ recusa por
            duplicidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">NF-e — nota de produto</p>
              <p className="text-xs text-muted-foreground">Mercadoria, com ICMS.</p>
            </div>
            <Switch
              checked={form.habilitaNfe}
              onCheckedChange={(checked) => setField("habilitaNfe", checked)}
            />
          </div>

          {form.habilitaNfe && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fiscal-serie-nfe">Série da NF-e</Label>
                <Input
                  id="fiscal-serie-nfe"
                  value={form.serieNfe}
                  onChange={(e) => setField("serieNfe", digits(e.target.value))}
                  inputMode="numeric"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fiscal-num-nfe">Próximo número da NF-e</Label>
                <Input
                  id="fiscal-num-nfe"
                  value={form.proximoNumeroNfe}
                  onChange={(e) => setField("proximoNumeroNfe", digits(e.target.value))}
                  inputMode="numeric"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">NFS-e — nota de serviço</p>
              <p className="text-xs text-muted-foreground">Instalação e mão de obra, com ISS.</p>
            </div>
            <Switch
              checked={form.habilitaNfse}
              onCheckedChange={(checked) => setField("habilitaNfse", checked)}
            />
          </div>

          {form.habilitaNfse && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="fiscal-padrao-nfse">Padrão da NFS-e</Label>
                <Select
                  id="fiscal-padrao-nfse"
                  value={form.padraoNfse}
                  onChange={(e) =>
                    setField("padraoNfse", e.target.value as FiscalNfsePadrao)
                  }
                >
                  <option value="nacional">Nacional — portal nfse.gov.br</option>
                  <option value="municipal">Municipal — sistema próprio da prefeitura</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Na dúvida, olhe uma nota que a empresa já emitiu: se o rodapé diz
                  &quot;DANFSe&quot; e aponta para o portal nacional, é Nacional.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fiscal-serie-nfse">Série da NFS-e</Label>
                <Input
                  id="fiscal-serie-nfse"
                  value={form.serieNfse}
                  onChange={(e) => setField("serieNfse", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fiscal-num-nfse">Próximo número da NFS-e</Label>
                <Input
                  id="fiscal-num-nfse"
                  value={form.proximoNumeroNfse}
                  onChange={(e) => setField("proximoNumeroNfse", digits(e.target.value))}
                  inputMode="numeric"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificado digital</CardTitle>
          <CardDescription>
            É preciso um e-CNPJ modelo A1 (arquivo .pfx). O arquivo não fica guardado na ProOps, 
            é enviado ao provedor fiscal, que o custodia. Enviar o certificado também salva
            a configuração acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {settings?.certificadoArmazenado && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Certificado registrado no provedor.</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal-cert-senha">Senha do certificado</Label>
              <Input
                id="fiscal-cert-senha"
                type="password"
                value={form.certificadoSenha}
                onChange={(e) => setField("certificadoSenha", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Validade do certificado</Label>
              {/* Lida do próprio arquivo ao enviar — pedir para digitar
                  arriscaria uma data errada, e o alerta avisaria no dia errado. */}
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                {settings?.certificadoValidade ? (
                  new Date(settings.certificadoValidade).toLocaleDateString("pt-BR")
                ) : (
                  <span className="text-muted-foreground">
                    Detectada ao enviar o certificado
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Avisamos com 30, 15, 7 e 1 dia de antecedência.
              </p>
            </div>
          </div>

          <input
            ref={certificateInputRef}
            type="file"
            accept=".pfx,.p12"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCertificateUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => certificateInputRef.current?.click()}
            disabled={isUploading}
            className="self-start"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Enviar certificado .pfx
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
