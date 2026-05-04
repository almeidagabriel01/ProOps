"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { CreditCard, QrCode, FileText, CheckCircle2, XCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PublicPaymentService,
  type PixPaymentResult,
  type BoletoPaymentResult,
  type MpPublicConfig,
  type CardPaymentFormData,
  type CardPaymentResult,
  type PayerOverride,
} from "@/services/mercadopago-service";
import { cpf, cnpj } from "cpf-cnpj-validator";
import { cn } from "@/lib/utils";
import { PixQrCodeView } from "./pix-qrcode-view";
import { BoletoView } from "./boleto-view";
import { CardPaymentBrick } from "./card-payment-brick";
import { Loader } from "@/components/ui/loader";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  transaction: {
    id: string;
    amount: number;
    description?: string;
    status: string;
  };
  primaryColor?: string;
  clientName?: string | null;
  clientHasDocument?: boolean;
  onPaymentSuccess: () => void;
}

interface BoletoPaymentFormProps {
  onSubmit: (payerOverride?: PayerOverride) => Promise<void>;
  isLoading: boolean;
  clientName?: string | null;
  clientHasDocument?: boolean;
  primaryColor?: string;
}

function formatDocumento(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function isDocumentoValid(digits: string): boolean {
  if (digits.length === 11) return cpf.isValid(digits);
  if (digits.length === 14) return cnpj.isValid(digits);
  return false;
}

function BoletoPaymentForm({
  onSubmit,
  isLoading,
  clientName,
  clientHasDocument,
  primaryColor,
}: BoletoPaymentFormProps) {
  const [documento, setDocumento] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [cep, setCep] = React.useState("");
  const [rua, setRua] = React.useState("");
  const [numero, setNumero] = React.useState("");
  const [bairro, setBairro] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [estado, setEstado] = React.useState("");

  const digits = documento.replace(/\D/g, "");
  const docValid = clientHasDocument || isDocumentoValid(digits);
  const addressValid = cep.replace(/\D/g, "").length >= 8 && rua.trim().length > 0 && numero.trim().length > 0 && bairro.trim().length > 0 && cidade.trim().length > 0 && estado.trim().length === 2;
  const canSubmit = docValid && (!!clientName || nome.trim().length > 0) && addressValid;

  const handleDocumentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumento(formatDocumento(e.target.value));
  };

  const handleSubmit = async () => {
    const resolvedName = clientName ?? nome.trim();
    const parts = resolvedName.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "";
    const address = {
      zipCode: cep.replace(/\D/g, ""),
      streetName: rua.trim(),
      streetNumber: numero.trim(),
      neighborhood: bairro.trim(),
      city: cidade.trim(),
      federalUnit: estado.trim().toUpperCase(),
    };
    if (clientHasDocument) {
      await onSubmit({ firstName, lastName, address });
    } else {
      const type = digits.length === 11 ? "CPF" : "CNPJ";
      await onSubmit({ identification: { type, number: digits }, firstName, lastName, address });
    }
  };

  const addressFields = (
    <>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">Endereço para o boleto</p>
      <div className="flex gap-2">
        <div className="flex flex-col gap-2 w-32 shrink-0">
          <Label htmlFor="boleto-cep">CEP</Label>
          <Input id="boleto-cep" type="text" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} maxLength={9} />
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <Label htmlFor="boleto-rua">Rua / Avenida</Label>
          <Input id="boleto-rua" type="text" placeholder="Nome da rua" value={rua} onChange={(e) => setRua(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col gap-2 w-24 shrink-0">
          <Label htmlFor="boleto-numero">Número</Label>
          <Input id="boleto-numero" type="text" placeholder="123" value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <Label htmlFor="boleto-bairro">Bairro</Label>
          <Input id="boleto-bairro" type="text" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col gap-2 flex-1">
          <Label htmlFor="boleto-cidade">Cidade</Label>
          <Input id="boleto-cidade" type="text" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 w-20 shrink-0">
          <Label htmlFor="boleto-estado">UF</Label>
          <Input id="boleto-estado" type="text" placeholder="SP" value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
        </div>
      </div>
    </>
  );

  if (clientHasDocument && clientName) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="font-medium">Pague com Boleto</p>
          <p className="text-sm text-muted-foreground">Informe o endereço para emitir o boleto.</p>
        </div>
        {addressFields}
        <Button
          onClick={handleSubmit}
          disabled={isLoading || !addressValid}
          className="w-full"
          style={primaryColor ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
        >
          {isLoading ? <Loader size="sm" className="mr-2" /> : <FileText className="mr-2 h-4 w-4" aria-hidden="true" />}
          {isLoading ? "Gerando boleto..." : `Gerar Boleto para ${clientName}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto">
        <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground text-center">
        Preencha os dados para emitir o boleto bancário.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="boleto-documento">CPF / CNPJ</Label>
        <Input
          id="boleto-documento"
          type="text"
          inputMode="numeric"
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          value={documento}
          onChange={handleDocumentoChange}
          maxLength={18}
          aria-label="CPF ou CNPJ do pagador"
        />
      </div>
      {!clientName && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="boleto-nome">Nome completo</Label>
          <Input
            id="boleto-nome"
            type="text"
            placeholder="Nome do pagador"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label="Nome completo do pagador"
          />
        </div>
      )}
      {addressFields}
      <Button
        onClick={handleSubmit}
        disabled={isLoading || !canSubmit}
        className={cn("w-full")}
        style={primaryColor ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
      >
        {isLoading ? (
          <Loader size="sm" className="mr-2" />
        ) : (
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {isLoading ? "Gerando boleto..." : "Gerar Boleto"}
      </Button>
    </div>
  );
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

function mapStatusDetail(detail?: string | null): string {
  switch (detail) {
    case "accredited": return "Pagamento aprovado com sucesso.";
    case "cc_rejected_bad_filled_card_number": return "Número do cartão incorreto.";
    case "cc_rejected_bad_filled_date": return "Data de vencimento incorreta.";
    case "cc_rejected_bad_filled_other": return "Dados do cartão incorretos.";
    case "cc_rejected_bad_filled_security_code": return "Código de segurança incorreto.";
    case "cc_rejected_blacklist": return "Cartão não autorizado pelo banco.";
    case "cc_rejected_call_for_authorize": return "Entre em contato com o banco para autorizar.";
    case "cc_rejected_card_disabled": return "Cartão desativado. Entre em contato com o banco.";
    case "cc_rejected_card_error": return "Erro no cartão. Tente outro cartão.";
    case "cc_rejected_duplicated_payment": return "Pagamento duplicado detectado.";
    case "cc_rejected_high_risk": return "Transação recusada por segurança.";
    case "cc_rejected_insufficient_amount": return "Saldo insuficiente.";
    case "cc_rejected_invalid_installments": return "Número de parcelas inválido.";
    case "cc_rejected_max_attempts": return "Limite de tentativas atingido. Tente mais tarde.";
    case "cc_rejected_other_reason": return "Cartão recusado. Tente outro cartão.";
    case "pending_review_manual": return "Pagamento em análise. Você será notificado.";
    default: return "Verifique os dados do cartão e tente novamente.";
  }
}

export function PaymentModal({
  open,
  onOpenChange,
  token,
  transaction,
  primaryColor,
  clientName,
  clientHasDocument,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [pixData, setPixData] = React.useState<PixPaymentResult | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = React.useState(false);
  const [boletoData, setBoletoData] = React.useState<BoletoPaymentResult | null>(null);
  const [isGeneratingBoleto, setIsGeneratingBoleto] = React.useState(false);

  type CardStep = "idle" | "loading-config" | "ready" | "processing" | "done" | "rejected";
  const [cardStep, setCardStep] = React.useState<CardStep>("idle");
  const [mpConfig, setMpConfig] = React.useState<MpPublicConfig | null>(null);
  const [cardResult, setCardResult] = React.useState<CardPaymentResult | null>(null);
  const [cardError, setCardError] = React.useState<string | null>(null);

  const [activeTab, setActiveTab] = React.useState("pix");

  const isSubmittingRef = React.useRef(false);

  // Fire a toast when the card form fails to load (cardStep stays "idle" after error)
  React.useEffect(() => {
    if (cardError && cardStep === "idle") {
      toast.error("Não foi possível carregar o formulário de pagamento. Tente recarregar a página.");
    }
  }, [cardError, cardStep]);

  const resetState = () => {
    setPixData(null);
    setIsGeneratingPix(false);
    setBoletoData(null);
    setIsGeneratingBoleto(false);
    setCardStep("idle");
    setMpConfig(null);
    setCardResult(null);
    setCardError(null);
    setActiveTab("pix");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleGeneratePix = async () => {
    try {
      setIsGeneratingPix(true);
      const result = await PublicPaymentService.createPayment(token, "pix", { transactionId: transaction.id });
      if (result.method === "pix") {
        setPixData(result);
      }
    } catch (err) {
      const d = (err as { data?: { message?: string; mpError?: { message?: string; cause?: Array<{ description?: string }> } } }).data;
      const detail = d?.mpError?.cause?.[0]?.description ?? d?.mpError?.message ?? d?.message;
      toast.error("Erro ao gerar QR Code PIX.", { description: detail ?? "Tente novamente." });
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCardTabSelect = async () => {
    if (mpConfig || cardStep !== "idle") return;
    setCardStep("loading-config");
    try {
      const config = await PublicPaymentService.getMpConfig(token);
      setMpConfig(config);
      setCardStep("ready");
    } catch {
      setCardError("Não foi possível carregar o formulário de pagamento. Tente novamente.");
      setCardStep("idle");
    }
  };

  const handleCardSubmit = async (formData: CardPaymentFormData) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setCardStep("processing");
    setCardError(null);
    try {
      const result = await PublicPaymentService.processCardPayment(token, {
        cardToken: formData.token,
        paymentMethodId: formData.payment_method_id,
        issuerId: formData.issuer_id,
        installments: formData.installments,
        payerEmail: formData.payer.email,
        payerIdentification:
          formData.payer.identification &&
          (formData.payer.identification.type === "CPF" ||
            formData.payer.identification.type === "CNPJ")
            ? {
                type: formData.payer.identification.type,
                number: formData.payer.identification.number,
              }
            : undefined,
        transactionId: transaction.id,
      });
      setCardResult(result);
      if (result.status === "approved") {
        setCardStep("done");
        setTimeout(() => onPaymentSuccess(), 1500);
      } else if (result.status === "rejected") {
        setCardStep("rejected");
        toast.error("Pagamento recusado", {
          description: mapStatusDetail(result.statusDetail),
        });
      } else {
        // pending/in_process
        setCardStep("done");
        setTimeout(() => onPaymentSuccess(), 1500);
      }
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string; code?: string } })?.data;
      const msg = data?.message ?? (err instanceof Error ? err.message : "Erro ao processar pagamento.");
      setCardError(msg);
      setCardStep("ready");
      toast.error("Erro ao processar pagamento", { description: msg });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handlePayBoleto = async (payerOverride?: PayerOverride) => {
    try {
      setIsGeneratingBoleto(true);
      const result = await PublicPaymentService.createPayment(token, "boleto", {
        transactionId: transaction.id,
        payerOverride,
      });
      if (result.method === "boleto") {
        setBoletoData(result);
      }
    } catch (err) {
      const d = (err as { data?: { message?: string; code?: string; mpError?: { message?: string; cause?: Array<{ description?: string }> } } }).data;
      if (d?.code === "INVALID_IDENTIFICATION") {
        toast.error("CPF ou CNPJ inválido.", { description: "Verifique os dados e tente novamente." });
      } else {
        const detail = d?.mpError?.cause?.[0]?.description ?? d?.mpError?.message ?? d?.message;
        toast.error("Erro ao gerar boleto.", { description: detail ?? "Tente novamente." });
      }
    } finally {
      setIsGeneratingBoleto(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Pagar {formatCurrency(transaction.amount)}</DialogTitle>
          {transaction.description && (
            <DialogDescription>{transaction.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 flex-1">
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); if (val === "card") handleCardTabSelect(); }}>
          <TabsList className="w-full">
            <TabsTrigger value="pix" className="flex-1">
              <QrCode className="mr-1.5 h-4 w-4" aria-hidden="true" />
              PIX
            </TabsTrigger>
            <TabsTrigger value="card" className="flex-1">
              <CreditCard className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Cartão
            </TabsTrigger>
            <TabsTrigger value="boleto" className="flex-1">
              <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Boleto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pix" className="mt-4">
            {pixData ? (
              <PixQrCodeView
                token={token}
                paymentId={pixData.paymentId}
                qrCode={pixData.qrCode}
                qrCodeBase64={pixData.qrCodeBase64}
                amount={pixData.amount}
                expiresAt={pixData.expiresAt}
                onPaymentApproved={onPaymentSuccess}
                primaryColor={primaryColor}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <QrCode className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium">Pague via PIX</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aprovação instantânea, 24h por dia.
                  </p>
                </div>
                <Button
                  onClick={handleGeneratePix}
                  disabled={isGeneratingPix}
                  className="w-full"
                  style={primaryColor ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
                >
                  {isGeneratingPix ? (
                    <Loader size="sm" className="mr-2" />
                  ) : (
                    <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {isGeneratingPix ? "Gerando..." : "Gerar QR Code PIX"}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="card" className="mt-4">
            {cardStep === "loading-config" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader size="lg" />
                <p className="text-sm text-muted-foreground">Carregando formulário...</p>
              </div>
            )}

            {(cardStep === "ready" || cardStep === "processing") && mpConfig && (
              <div>
                {mpConfig.environment === "sandbox" && (
                  <Alert className="mb-3">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Ambiente de teste ativo</AlertTitle>
                    <AlertDescription className="space-y-1 text-xs">
                      {mpConfig.sellerTestEmail && (
                        <p>
                          E-mail do vendedor:{" "}
                          <code className="bg-muted px-1 rounded">{mpConfig.sellerTestEmail}</code>{" "}
                          — <strong>não use este e-mail</strong>.
                        </p>
                      )}
                      <p>
                        Use qualquer e-mail comum (ex:{" "}
                        <code className="bg-muted px-1 rounded">comprador.teste@gmail.com</code>),{" "}
                        diferente do e-mail do vendedor acima.{" "}
                        <strong>Não use e-mails @testuser.com</strong> — o Mercado Pago rejeita esse formato no formulário de cartão.
                      </p>
                      <p>
                        Cartão de teste:{" "}
                        <code className="bg-muted px-1 rounded">5031 4332 1540 6351</code>{" "}
                        (MASTER, qualquer vencimento, CVV{" "}
                        <code className="bg-muted px-1 rounded">123</code>).
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="relative">
                  <CardPaymentBrick
                    publicKey={mpConfig.publicKey}
                    amount={transaction.amount}
                    onSubmit={handleCardSubmit}
                    onError={(e) => {
                      setCardError("Erro no formulário de pagamento.");
                      setCardStep("idle");
                      console.error("CardPaymentBrick error", e);
                    }}
                  />
                  {cardStep === "processing" && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/90 backdrop-blur-[1px]">
                      <Loader size="md" />
                      <div className="text-center">
                        <p className="text-sm font-medium">Processando pagamento</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Não feche esta janela.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {cardStep === "done" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {cardResult?.status === "approved" ? "Pagamento aprovado!" : "Pagamento processado!"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cardResult?.status === "approved"
                      ? "Lançamento marcado como pago."
                      : "Aguarde a confirmação em breve."}
                  </p>
                </div>
              </div>
            )}

            {cardStep === "rejected" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium">Pagamento recusado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {mapStatusDetail(cardResult?.statusDetail)}
                  </p>
                </div>
                <Button variant="outline" onClick={() => { setCardStep("ready"); setCardError(null); }}>
                  Tentar novamente
                </Button>
              </div>
            )}

          </TabsContent>

          <TabsContent value="boleto" className="mt-4">
            {boletoData ? (
              <BoletoView
                barcodeContent={boletoData.barcodeContent}
                boletoUrl={boletoData.boletoUrl}
                expiresAt={boletoData.expiresAt}
                amount={boletoData.amount}
                primaryColor={primaryColor}
              />
            ) : (
              <BoletoPaymentForm
                onSubmit={handlePayBoleto}
                isLoading={isGeneratingBoleto}
                clientName={clientName}
                clientHasDocument={clientHasDocument}
                primaryColor={primaryColor}
              />
            )}
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
