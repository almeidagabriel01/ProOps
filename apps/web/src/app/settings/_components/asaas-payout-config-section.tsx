"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/ui/loader";
import { AsaasService, type AsaasPayoutConfig } from "@/services/payment-service";

const PIX_KEY_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Celular" },
  { value: "RANDOM_KEY", label: "Chave aleatória" },
];

const PIX_KEY_PLACEHOLDERS: Record<string, string> = {
  CPF: "000.000.000-00",
  CNPJ: "00.000.000/0001-00",
  EMAIL: "email@exemplo.com",
  PHONE: "(11) 98765-4321",
  RANDOM_KEY: "Chave aleatória gerada pelo banco",
};

function maskCpfCnpj(val: string): string {
  const d = val.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(val: string): string {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (!d.length) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface AsaasPayoutConfigSectionProps {
  initialPayout: AsaasPayoutConfig | null;
  disabled?: boolean;
  onSaved: (next: AsaasPayoutConfig) => void;
}

export function AsaasPayoutConfigSection({
  initialPayout,
  disabled = false,
  onSaved,
}: AsaasPayoutConfigSectionProps) {
  const [payoutEnabled, setPayoutEnabled] = useState(() => initialPayout?.enabled ?? false);
  const [pixAddressKeyType, setPixAddressKeyType] = useState(
    () => initialPayout?.pixAddressKeyType ?? "CPF",
  );
  const [pixAddressKey, setPixAddressKey] = useState(() => initialPayout?.pixAddressKey ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (payoutEnabled && !pixAddressKey.trim()) {
      toast.error("Informe a chave PIX para salvar a configuração de repasse.");
      return;
    }
    try {
      setIsSaving(true);
      const result = await AsaasService.updatePayout({
        enabled: payoutEnabled,
        pixAddressKey: payoutEnabled ? pixAddressKey.trim() : undefined,
        pixAddressKeyType: payoutEnabled ? pixAddressKeyType : undefined,
      });
      if (result.payout) {
        onSaved(result.payout);
      }
      toast.success("Configuração de repasse salva com sucesso!");
    } catch {
      toast.error("Erro ao salvar configuração de repasse.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Repasse automático para sua conta bancária</p>
      <div className="flex items-center gap-3">
        <Switch
          id="payout-enabled"
          checked={payoutEnabled}
          onCheckedChange={setPayoutEnabled}
          disabled={disabled}
        />
        <Label htmlFor="payout-enabled" className="text-sm cursor-pointer">
          Receber repasses automáticos na minha conta
        </Label>
      </div>
      {payoutEnabled ? (
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Tipo de chave PIX</Label>
            <Select
              value={pixAddressKeyType}
              onChange={(e) => {
                setPixAddressKeyType(e.target.value);
                setPixAddressKey("");
              }}
              disabled={disabled}
              className="mt-1"
            >
              {PIX_KEY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-sm">Chave PIX</Label>
            <Input
              value={pixAddressKey}
              onChange={(e) => {
                const raw = e.target.value;
                if (pixAddressKeyType === "CPF" || pixAddressKeyType === "CNPJ") {
                  setPixAddressKey(maskCpfCnpj(raw));
                } else if (pixAddressKeyType === "PHONE") {
                  setPixAddressKey(maskPhone(raw));
                } else {
                  setPixAddressKey(raw);
                }
              }}
              placeholder={PIX_KEY_PLACEHOLDERS[pixAddressKeyType] ?? ""}
              disabled={disabled}
              className="mt-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A cada pagamento recebido, o valor (descontadas as taxas do Asaas) será transferido
            automaticamente para esta chave PIX.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Os valores ficarão retidos na conta Asaas até você ativar o repasse automático.
        </p>
      )}
      <Button
        size="sm"
        onClick={handleSave}
        disabled={disabled || isSaving || (payoutEnabled && !pixAddressKey.trim())}
      >
        {isSaving && <Loader size="sm" className="mr-2" />}
        Salvar configuração de repasse
      </Button>
    </div>
  );
}
