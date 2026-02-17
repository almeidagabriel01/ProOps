"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Building2, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { Transaction } from "@/services/transaction-service";
import { formatCurrency } from "@/utils/format";
import { callApi } from "@/lib/api-client";

interface PaymentInitiationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  tenantId: string;
}

export function PaymentInitiationDialog({
  isOpen,
  onClose,
  transaction,
  tenantId,
}: PaymentInitiationDialogProps) {
  const {
    accounts,
    loading: loadingAccounts,
    fetchAccounts,
  } = useConnectedAccounts(tenantId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [receiverName, setReceiverName] = useState<string>("");
  const [receiverTaxNumber, setReceiverTaxNumber] = useState<string>("");
  const [pixKey, setPixKey] = useState<string>("");
  const [isInitiating, setIsInitiating] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchAccounts();
    }
  }, [tenantId, fetchAccounts]);

  // Auto-fill from transaction if available
  useEffect(() => {
    if (transaction) {
      setReceiverName(transaction.description);
    }
  }, [transaction]);

  const handleInitiatePayment = async () => {
    if (!selectedAccountId) {
      toast.warning("Selecione uma conta de origem.");
      return;
    }
    if (!pixKey) {
      toast.warning("Informe a chave Pix do destinatário.");
      return;
    }
    if (!receiverName || !receiverTaxNumber) {
      toast.warning("Nome e CPF/CNPJ do destinatário são obrigatórios.");
      return;
    }

    setIsInitiating(true);
    try {
      const payload = {
        amount: transaction.amount,
        description: transaction.description || "Pagamento via ERP",
        receiver: {
          name: receiverName,
          taxNumber: receiverTaxNumber.replace(/\D/g, ""), // Clean non-digits
          pixKey: pixKey,
          personType:
            receiverTaxNumber.replace(/\D/g, "").length > 11
              ? "LEGAL"
              : "NATURAL",
        },
        callbackUrl: `${window.location.origin}/financial?payment_success=true`,
      };

      const response = await callApi<{
        success: boolean;
        paymentUrl: string; // Updated from authorizationUrl to match backend
        paymentId: string;
      }>("v1/payments/initiate", "POST", payload);

      if (response.success && response.paymentUrl) {
        toast.info("Redirecionando para o banco...");
        window.open(response.paymentUrl, "_blank");
        onClose();
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao iniciar pagamento.");
    } finally {
      setIsInitiating(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pagar com Open Finance</DialogTitle>
          <DialogDescription>
            Inicie um pagamento Pix diretamente pelo ERP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
            <div className="text-sm">
              <p className="text-muted-foreground">Valor a Pagar</p>
              <p className="font-bold text-lg">
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conta de Origem</Label>
            {loadingAccounts ? (
              <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
            ) : (
              <Select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                placeholder="Selecione o banco..."
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName || "Banco Desconhecido"}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Nome do Beneficiário (Quem recebe)</Label>
            <Input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Ex: Loja de Materiais Ltda"
            />
          </div>

          <div className="space-y-2">
            <Label>CPF/CNPJ do Beneficiário</Label>
            <Input
              value={receiverTaxNumber}
              onChange={(e) => setReceiverTaxNumber(e.target.value)}
              placeholder="Apenas números"
            />
          </div>

          {/* Pix Key Input */}
          <div className="space-y-2">
            <Label>Chave Pix</Label>
            <div className="relative">
              <Input
                placeholder="CPF, CNPJ, Celular, Email ou Aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isInitiating}>
            Cancelar
          </Button>
          <Button
            onClick={handleInitiatePayment}
            disabled={
              isInitiating ||
              !selectedAccountId ||
              !pixKey ||
              !receiverName ||
              !receiverTaxNumber
            }
          >
            {isInitiating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                Confirmar e Pagar
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
