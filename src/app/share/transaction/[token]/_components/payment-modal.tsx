"use client";

import * as React from "react";
import { toast } from "sonner";
import { CreditCard, QrCode, FileText, Loader2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  PublicPaymentService,
  type PixPaymentResult,
} from "@/services/mercadopago-service";
import { PixQrCodeView } from "./pix-qrcode-view";

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
  const [isRedirectingCard, setIsRedirectingCard] = React.useState(false);
  const [isRedirectingBoleto, setIsRedirectingBoleto] = React.useState(false);

  const resetState = () => {
    setPixData(null);
    setIsGeneratingPix(false);
    setIsRedirectingCard(false);
    setIsRedirectingBoleto(false);
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

  const handlePayCard = async () => {
    try {
      setIsRedirectingCard(true);
      const result = await PublicPaymentService.createPayment(token, "credit_card", {
        backUrl: `${window.location.href}?payment_success=1`,
        transactionId: transaction.id,
      });
      if ("initPoint" in result && result.initPoint) {
        window.location.href = result.initPoint;
      }
    } catch (err) {
      const detail = (err as { data?: { message?: string } }).data?.message;
      toast.error("Erro ao iniciar pagamento com cartão.", { description: detail ?? "Tente novamente." });
      setIsRedirectingCard(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar {formatCurrency(transaction.amount)}</DialogTitle>
          {transaction.description && (
            <DialogDescription>{transaction.description}</DialogDescription>
          )}
        </DialogHeader>

        <Tabs defaultValue="pix">
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
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <CreditCard className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium">Pague com Cartão</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Você será redirecionado para o checkout seguro do Mercado Pago.
                </p>
              </div>
              <Button
                onClick={handlePayCard}
                disabled={isRedirectingCard}
                className="w-full"
                style={primaryColor ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
              >
                {isRedirectingCard ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isRedirectingCard ? "Redirecionando..." : "Pagar com Cartão"}
              </Button>
            </div>
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
      </DialogContent>
    </Dialog>
  );
}
