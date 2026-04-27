"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { CreditCard, QrCode, FileText, Loader2, ExternalLink, CheckCircle2, XCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PublicPaymentService,
  type PixPaymentResult,
  type MpPublicConfig,
  type CardPaymentFormData,
  type CardPaymentResult,
} from "@/services/mercadopago-service";
import { PixQrCodeView } from "./pix-qrcode-view";
import { CardPaymentBrick } from "./card-payment-brick";

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
  onPaymentSuccess: () => void;
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
  onPaymentSuccess,
}: PaymentModalProps) {
  const [pixData, setPixData] = React.useState<PixPaymentResult | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = React.useState(false);
  const [isRedirectingBoleto, setIsRedirectingBoleto] = React.useState(false);

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
    setIsRedirectingBoleto(false);
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

  const handlePayBoleto = async () => {
    try {
      setIsRedirectingBoleto(true);
      const result = await PublicPaymentService.createPayment(token, "boleto", {
        backUrl: `${window.location.href}?payment_success=1`,
        transactionId: transaction.id,
      });
      if ("initPoint" in result && result.initPoint) {
        window.location.href = result.initPoint;
      }
    } catch (err) {
      const detail = (err as { data?: { message?: string } }).data?.message;
      toast.error("Erro ao gerar boleto.", { description: detail ?? "Tente novamente." });
      setIsRedirectingBoleto(false);
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
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
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
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
                      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden="true" />
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
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium">Pague com Boleto</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Gere seu boleto para pagar em qualquer banco.
                </p>
              </div>
              <Button
                onClick={handlePayBoleto}
                disabled={isRedirectingBoleto}
                className="w-full"
                style={primaryColor ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
              >
                {isRedirectingBoleto ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isRedirectingBoleto ? "Gerando boleto..." : "Gerar Boleto"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
