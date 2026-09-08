"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { AlertTriangle, FileText, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StepWizard } from "@/components/ui/step-wizard";
import { FormStepCard } from "@/components/ui/form-step-card";
import {
  FiscalService,
  type FiscalAddress,
  type FiscalSettings,
} from "@/services/fiscal-service";
import { cnpj as cnpjValidator } from "cpf-cnpj-validator";
import { humanizeRejection } from "@/lib/fiscal/rejection-messages";
import { Loader } from "@/components/ui/loader";
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
  buildFiscalSettingsPayload,
  type FiscalFormState,
} from "@/lib/fiscal/settings-payload";
import { fiscalSteps } from "./fiscal/fiscal-steps";
import { EmpresaStep } from "./fiscal/empresa-step";
import { EnderecoStep } from "./fiscal/endereco-step";
import { DocumentosStep } from "./fiscal/documentos-step";
import { CertificadoStep } from "./fiscal/certificado-step";
import type { FiscalErrors } from "./fiscal/types";

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

type FormState = FiscalFormState;

const INITIAL_FORM: FormState = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  cnae: "",
  regimeTributario: 1,
  percentualSimplesNacional: "",
  email: "",
  telefone: "",
  endereco: { ...EMPTY_ADDRESS },
  habilitaNfe: false,
  habilitaNfse: true,
  habilitaManifestacao: false,
  dataInicioRecebimento: "",
  padraoNfse: "nacional",
  serieNfe: "",
  proximoNumeroNfe: "",
  serieNfse: "",
  proximoNumeroNfse: "",
  certificadoValidade: "",
  certificadoSenha: "",
};

/**
 * Hoje no fuso LOCAL, não em UTC.
 *
 * `toISOString().slice(0, 10)` adianta o dia toda noite depois das 21h no
 * horário de Brasília — e aqui isso sugeriria uma data futura para um campo
 * que o provedor não deixa corrigir depois.
 */
function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

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
    percentualSimplesNacional:
      settings.percentualTotalTributosSimplesNacional === undefined ||
      settings.percentualTotalTributosSimplesNacional === null
        ? ""
        : String(settings.percentualTotalTributosSimplesNacional),
    email: settings.email ?? "",
    telefone: settings.telefone ?? "",
    endereco: settings.endereco ?? { ...EMPTY_ADDRESS },
    habilitaNfe: settings.habilitaNfe ?? false,
    habilitaNfse: settings.habilitaNfse ?? true,
    habilitaManifestacao: settings.habilitaManifestacao === true,
    dataInicioRecebimento: settings.dataInicioRecebimento ?? "",
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
  /**
   * Conta demo/free: navega os passos como quem já configurou, mas sem editar
   * nem salvar. O `inert` fica no CONTEÚDO de cada passo (e nos blocos fora do
   * wizard), NÃO num wrapper por cima de tudo — `inert` num ancestral comum
   * mataria também os botões de navegação e prenderia a conta no passo 1.
   */
  demoReadOnly?: boolean;
}

export function FiscalSettingsCard({
  onLoadingChange,
  demoReadOnly = false,
}: FiscalSettingsCardProps) {
  const [settings, setSettings] = React.useState<FiscalSettings | null>(null);
  const dataRecebimentoBloqueada =
    settings?.dataInicioRecebimentoBloqueada === true;
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<FiscalErrors>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [isLookingUp, setIsLookingUp] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isRetryingWebhooks, setIsRetryingWebhooks] = React.useState(false);

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

  /** Limpa o erro do próprio campo ao digitar — o passo revalida no "Próximo". */
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    clearError(String(key));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setAddress = <K extends keyof FiscalAddress>(
    key: K,
    value: FiscalAddress[K],
  ) => {
    clearError(String(key));
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, [key]: value } }));
  };

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
      setErrors({});
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
   * Validação de cada passo — espelha, campo a campo, o que o
   * `PUT /v1/fiscal/settings` recusa. É o mesmo conjunto de regras; a diferença
   * é o momento: antes eram quatro cards de uma vez e um toast genérico no fim,
   * agora o erro aparece no passo que o causou, ao lado do campo.
   */
  const validateEmpresa = (): boolean => {
    const next: FiscalErrors = {};
    const cnpjLimpo = digits(form.cnpj);
    if (!cnpjValidator.isValid(cnpjLimpo)) {
      next.cnpj =
        cnpjLimpo.length === 14
          ? "Os dígitos verificadores não batem"
          : "Informe o CNPJ completo";
    }
    if (!form.razaoSocial.trim()) next.razaoSocial = "Razão social é obrigatória";
    if (!form.email.trim().includes("@")) next.email = "Informe um e-mail válido";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateEndereco = (): boolean => {
    const next: FiscalErrors = {};
    const { logradouro, numero, bairro, municipio, uf, cep, codigoIbge } =
      form.endereco;
    if (!logradouro.trim()) next.logradouro = "Logradouro é obrigatório";
    if (!numero.trim()) next.numero = "Número é obrigatório";
    if (!bairro.trim()) next.bairro = "Bairro é obrigatório";
    if (!municipio.trim()) next.municipio = "Município é obrigatório";
    if (uf.trim().length !== 2) next.uf = "UF deve ter 2 letras";
    if (digits(cep).length !== 8) next.cep = "CEP deve ter 8 dígitos";
    // A SEFAZ valida o município pelo código, não pelo nome. Sem os 7 dígitos o
    // provedor recusa, e o CEP é quem os traz.
    if (digits(codigoIbge).length !== 7)
      next.codigoIbge = "Deve ter 7 dígitos — confira o CEP";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateDocumentos = (): boolean => {
    const next: FiscalErrors = {};
    if (!form.habilitaNfe && !form.habilitaNfse)
      next.documentos = "Habilite ao menos um tipo de nota (NF-e ou NFS-e).";
    // Sem inscrição municipal a prefeitura não tem a quem cobrar o ISS, e toda
    // emissão de NFS-e falha lá.
    if (form.habilitaNfse && !form.inscricaoMunicipal.trim())
      next.inscricaoMunicipal = "Obrigatória para emitir NFS-e";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Payload de configuração a partir do formulário.
   *
   * Extraído porque o envio do certificado precisa gravar os mesmos dados antes
   * de registrar a empresa — ver `handleCertificateUpload`.
   */
  const buildSettingsPayload = () => buildFiscalSettingsPayload(form);

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

  /**
   * Desconecta e volta o formulário ao estado inicial.
   *
   * Sem limpar o formulário, os campos continuariam preenchidos sobre uma
   * configuração que já não existe — e o próximo "Salvar" recriaria tudo, menos
   * o certificado. Um emitente meio configurado é pior que nenhum.
   */
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await FiscalService.disconnect();
      setSettings(null);
      setForm({ ...INITIAL_FORM, endereco: { ...EMPTY_ADDRESS } });
      setErrors({});
      setConfirmDisconnect(false);
      toast.success("Emissão desconectada.", {
        description: "As notas já emitidas continuam disponíveis.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível desconectar.",
      );
    } finally {
      setIsDisconnecting(false);
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
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader size="md" />
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

  const temAviso =
    Boolean(settings?.lastError) ||
    typeof diasParaVencer === "number" ||
    gatilhoPendente;

  return (
    <div className="flex flex-col gap-6">
      {/* Situação atual — fora do wizard: é o que a pessoa precisa ver antes de
          escolher qual passo abrir, e não é campo de formulário. */}
      {(status || temAviso) && (
        <div className="contents" inert={demoReadOnly || undefined}>
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              {status && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Situação da emissão
                    </span>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              )}

              {typeof diasParaVencer === "number" && diasParaVencer <= 30 && (
                <div
                  className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
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
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
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
                      <Loader size="sm" variant="button" className="mr-2" />
                    )}
                    Tentar de novo
                  </Button>
                </div>
              )}

              {settings?.lastError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{humanizeRejection(undefined, settings.lastError).explicacao}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quatro passos, como todo formulário longo do ERP. `allowClickAhead` só
          para quem já configurou (ou está no demo): aí a tela é edição de algo
          que existe, e obrigar a sequência para trocar uma série seria custo
          sem ganho. Numa configuração nova a ordem importa — o registro no
          provedor depende dos passos anteriores. */}
      <StepWizard
        steps={fiscalSteps}
        allowClickAhead={settings?.configured === true || demoReadOnly}
      >
        <FormStepCard>
          <EmpresaStep
            form={form}
            errors={errors}
            setField={setField}
            maskCnpj={maskCnpj}
            isLookingUp={isLookingUp}
            onLookupCnpj={handleLookupCnpj}
            onBeforeNext={demoReadOnly ? undefined : validateEmpresa}
            contentDisabled={demoReadOnly}
          />
        </FormStepCard>

        <FormStepCard>
          <EnderecoStep
            form={form}
            errors={errors}
            setAddress={setAddress}
            onCepBlur={handleCepBlur}
            onBeforeNext={demoReadOnly ? undefined : validateEndereco}
            contentDisabled={demoReadOnly}
          />
        </FormStepCard>

        <FormStepCard>
          <DocumentosStep
            form={form}
            errors={errors}
            setField={setField}
            hoje={hojeIso()}
            dataRecebimentoBloqueada={dataRecebimentoBloqueada}
            onBeforeNext={demoReadOnly ? undefined : validateDocumentos}
            contentDisabled={demoReadOnly}
          />
        </FormStepCard>

        <FormStepCard>
          <CertificadoStep
            form={form}
            setField={setField}
            certificadoArmazenado={settings?.certificadoArmazenado === true}
            certificadoValidade={settings?.certificadoValidade}
            isUploading={isUploading}
            onUpload={(file) => void handleCertificateUpload(file)}
            isSaving={isSaving}
            onSave={handleSave}
            submitDisabled={demoReadOnly}
            contentDisabled={demoReadOnly}
          />
        </FormStepCard>
      </StepWizard>

      {/* `configured`, não `settings`: o GET nunca devolve null — devolve
          `{ configured: false }` quando nada foi configurado. Testar só o
          objeto mostraria "Desconectar" para quem nunca configurou nada, o que
          é ruído e assusta antes da hora. */}
      {settings?.configured && (
        <div className="contents" inert={demoReadOnly || undefined}>
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base">Desconectar emissão</CardTitle>
              <CardDescription>
                Para parar de emitir por aqui, ou trocar o CNPJ do emitente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-sm text-muted-foreground">
                As notas já emitidas <strong>continuam</strong> disponíveis — elas
                têm guarda legal de 5 anos e não somem com a desconexão.
              </p>
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDisconnect(true)}
                disabled={isDisconnecting}
              >
                {isDisconnecting && (
                  <Loader size="sm" variant="button" className="mr-2" />
                )}
                Desconectar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(open) => !isDisconnecting && setConfirmDisconnect(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar a emissão de notas?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  A emissão para imediatamente. As notas já emitidas continuam
                  aqui — guarda legal de 5 anos.
                </p>
                {/* Estas duas são o que dói na volta, e ninguém adivinha: a
                    senha do certificado é cifrada em KMS e não é recuperável, e
                    numeração errada vira rejeição por duplicidade. */}
                <p>Para reconectar depois, será preciso:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    enviar o certificado <strong>.pfx</strong> de novo, com a
                    senha — ela não fica guardada em texto e não dá para
                    recuperar;
                  </li>
                  <li>
                    reinformar <strong>série e próximo número</strong>, e eles
                    precisam continuar de onde pararam, senão o fisco recusa por
                    duplicidade.
                  </li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDisconnect();
              }}
              disabled={isDisconnecting}
              className="bg-destructive hover:bg-destructive/90 gap-2"
            >
              {isDisconnecting && <Loader size="sm" variant="button" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
