"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { QrCode, FileText, Info } from "lucide-react";
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
  PaymentService,
  type PixPaymentResult,
  type BoletoPaymentResult,
  type PayerOverride,
} from "@/services/payment-service";
import { cpf, cnpj } from "cpf-cnpj-validator";
import { cn } from "@/lib/utils";
import { PixQrCodeView } from "./pix-qrcode-view";
import { BoletoView } from "./boleto-view";
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

interface PixPaymentFormProps {
  onSubmit: (payerOverride?: PayerOverride) => Promise<void>;
  isLoading: boolean;
  clientName?: string | null;
  clientHasDocument?: boolean;
  primaryColor?: string;
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

function PixPaymentForm({
  onSubmit,
  isLoading,
  clientName,
  clientHasDocument,
  primaryColor,
}: PixPaymentFormProps) {
  const [documento, setDocumento] = React.useState("");
  const [nome, setNome] = React.useState("");

  const digits = documento.replace(/\D/g, "");
  const docValid = clientHasDocument || isDocumentoValid(digits);
  const canSubmit = docValid && (!!clientName || nome.trim().length > 0);

  const handleDocumentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumento(formatDocumento(e.target.value));
  };

  const handleSubmit = async () => {
    const resolvedName = clientName ?? nome.trim();
    const parts = resolvedName.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "";
    if (clientHasDocument) {
      await onSubmit({ firstName, lastName });
    } else {
      const type = digits.length === 11 ? "CPF" : "CNPJ";
      await onSubmit({ identification: { type, number: digits }, firstName, lastName });
    }
  };

  if (clientHasDocument && clientName) {
    return (
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
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full"
          style={primaryColor ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
        >
          {isLoading ? (
            <Loader size="sm" className="mr-2" />
          ) : (
            <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {isLoading ? "Gerando..." : "Gerar QR Code PIX"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto">
        <QrCode className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground text-center">
        Informe o CPF ou CNPJ do pagador para gerar o QR Code PIX.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pix-documento">CPF / CNPJ</Label>
        <Input
          id="pix-documento"
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
          <Label htmlFor="pix-nome">Nome completo</Label>
          <Input
            id="pix-nome"
            type="text"
            placeholder="Nome do pagador"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label="Nome completo do pagador"
          />
        </div>
      )}
      <Button
        onClick={handleSubmit}
        disabled={isLoading || !canSubmit}
        className="w-full"
        style={primaryColor ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
      >
        {isLoading ? (
          <Loader size="sm" className="mr-2" />
        ) : (
          <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {isLoading ? "Gerando..." : "Gerar QR Code PIX"}
      </Button>
    </div>
  );
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

  const digits = documento.replace(/\D/g, "");
  const docValid = clientHasDocument || isDocumentoValid(digits);
  const canSubmit = docValid && (!!clientName || nome.trim().length > 0);

  const handleDocumentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumento(formatDocumento(e.target.value));
  };

  const handleSubmit = async () => {
    const resolvedName = clientName ?? nome.trim();
    const parts = resolvedName.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "";
    if (clientHasDocument) {
      await onSubmit({ firstName, lastName });
    } else {
      const type = digits.length === 11 ? "CPF" : "CNPJ";
      await onSubmit({ identification: { type, number: digits }, firstName, lastName });
    }
  };

  if (clientHasDocument && clientName) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="font-medium">Pague com Boleto</p>
          <p className="text-sm text-muted-foreground">Clique abaixo para gerar o boleto.</p>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
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
  const [isSandbox, setIsSandbox] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState("pix");

  React.useEffect(() => {
    if (!open) return;
    PaymentService.getPaymentConfig(token)
      .then((config) => setIsSandbox(config.environment === "sandbox"))
      .catch(() => {
        // config opcional — não bloqueia o fluxo de pagamento
      });
  }, [open, token]);

  const resetState = () => {
    setPixData(null);
    setIsGeneratingPix(false);
    setBoletoData(null);
    setIsGeneratingBoleto(false);
    setActiveTab("pix");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleGeneratePix = async (payerOverride?: PayerOverride) => {
    try {
      setIsGeneratingPix(true);
      const result = await PaymentService.createPayment(token, "pix", {
        transactionId: transaction.id,
        payerOverride,
      });
      if (result.method === "pix") {
        setPixData(result);
      }
    } catch (err) {
      const d = (err as { data?: { message?: string; code?: string } }).data;
      if (d?.code === "INVALID_IDENTIFICATION") {
        toast.error("CPF ou CNPJ inválido.", { description: "Verifique os dados e tente novamente." });
      } else {
        toast.error("Erro ao gerar QR Code PIX.", { description: d?.message ?? "Tente novamente." });
      }
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handlePayBoleto = async (payerOverride?: PayerOverride) => {
    try {
      setIsGeneratingBoleto(true);
      const result = await PaymentService.createPayment(token, "boleto", {
        transactionId: transaction.id,
        payerOverride,
      });
      if (result.method === "boleto") {
        setBoletoData(result);
      }
    } catch (err) {
      const d = (err as { data?: { message?: string; code?: string } }).data;
      if (d?.code === "INVALID_IDENTIFICATION") {
        toast.error("CPF ou CNPJ inválido.", { description: "Verifique os dados e tente novamente." });
      } else {
        toast.error("Erro ao gerar boleto.", { description: d?.message ?? "Tente novamente." });
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

        {isSandbox && (
          <Alert className="shrink-0">
            <Info className="h-4 w-4" />
            <AlertTitle>Ambiente de teste ativo</AlertTitle>
            <AlertDescription className="text-xs">
              Os pagamentos realizados aqui são simulados e não geram cobrança real.
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-y-auto min-h-0 flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="pix" className="flex-1">
                <QrCode className="mr-1.5 h-4 w-4" aria-hidden="true" />
                PIX
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
                  onReset={() => setPixData(null)}
                  isSandbox={isSandbox}
                />
              ) : (
                <PixPaymentForm
                  onSubmit={handleGeneratePix}
                  isLoading={isGeneratingPix}
                  clientName={clientName}
                  clientHasDocument={clientHasDocument}
                  primaryColor={primaryColor}
                />
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
