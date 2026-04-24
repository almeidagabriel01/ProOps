"use client";

import * as React from "react";
import { toast } from "sonner";
import { CreditCard, QrCode, FileText, Loader2, ExternalLink, CheckCircle2, XCircle, Info, AlertCircle } from "lucide-react";
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
        onPaymentSuccess();
      } else if (result.status === "rejected") {
        setCardStep("rejected");
      } else {
        // pending/in_process — webhook vai finalizar
        setCardStep("done");
        onPaymentSuccess();
      }
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        (err instanceof Error ? err.message : "Erro ao processar pagamento.");
      setCardError(msg);
      setCardStep("ready");
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
            {cardStep === "idle" && cardError && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <XCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium">Erro ao carregar formulário</p>
                  <p className="text-sm text-muted-foreground mt-1">{cardError}</p>
                </div>
                <Button variant="outline" onClick={() => { setCardError(null); handleCardTabSelect(); }}>
                  Tentar novamente
                </Button>
              </div>
            )}

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
                        Use o e-mail de um comprador de teste diferente. Formato:{" "}
                        <code className="bg-muted px-1 rounded">
                          test_user_&lt;número_do_nickname&gt;@testuser.com
                        </code>
                        . O nickname completo fica visível ao entrar na conta do comprador em mercadopago.com.br.
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
                <p className="font-medium">Pagamento processado!</p>
                <p className="text-sm text-muted-foreground">Aguarde a confirmação em breve.</p>
              </div>
            )}

            {cardStep === "rejected" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium">Pagamento recusado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cardResult?.statusDetail ?? "Verifique os dados do cartão e tente novamente."}
                  </p>
                </div>
                <Button variant="outline" onClick={() => { setCardStep("ready"); setCardError(null); }}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {cardError && cardStep !== "rejected" && cardStep !== "idle" && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível processar</AlertTitle>
                <AlertDescription>{cardError}</AlertDescription>
              </Alert>
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
