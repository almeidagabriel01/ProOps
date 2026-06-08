"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTotpEnrollment } from "@/hooks/useTotpEnrollment";
import { useWhatsappMfaStatus } from "@/hooks/useWhatsappMfaStatus";
import { canUseWhatsappMfa, maskPhone } from "@/lib/mfa-helpers";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MfaSection } from "./mfa-section";
import { WhatsappMfaSection } from "./whatsapp-mfa-section";

type Method = "totp" | "whatsapp";

/**
 * Two-factor method selector for the profile. Renders the authenticator (TOTP)
 * section or the WhatsApp section — the two methods are mutually exclusive. When
 * one method is active, the other is disabled with a hint. Super admins are
 * TOTP-only, so the WhatsApp option is hidden for them entirely.
 */
export function TwoFactorSection() {
  const { user } = useAuth();
  const { isEnrolled: totpEnrolled } = useTotpEnrollment();
  const {
    enabled: whatsappEnabled,
    phone: whatsappPhone,
    refresh: refreshWhatsapp,
  } = useWhatsappMfaStatus();

  const showWhatsapp = canUseWhatsappMfa(user?.role);

  // Default the active method into view; otherwise default to the recommended
  // TOTP method. WhatsApp can only become the selection when it's offered.
  const [method, setMethod] = React.useState<Method>(() => {
    if (whatsappEnabled && showWhatsapp) return "whatsapp";
    return "totp";
  });

  React.useEffect(() => {
    if (whatsappEnabled && showWhatsapp) {
      setMethod("whatsapp");
    } else if (totpEnrolled) {
      setMethod("totp");
    }
  }, [whatsappEnabled, totpEnrolled, showWhatsapp]);

  // A method that is active locks the other one out (UI-side exclusivity).
  const totpDisabled = whatsappEnabled && showWhatsapp;
  const whatsappDisabled = totpEnrolled;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Verificação em dois fatores</CardTitle>
          <CardDescription>
            Escolha como confirmar sua identidade ao entrar. Você pode ativar
            apenas um método por vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <MethodOption
            label="Aplicativo autenticador — mais seguro (recomendado)"
            description="Use Google Authenticator, Authy ou similar."
            selected={method === "totp"}
            disabled={totpDisabled}
            disabledHint="Desative o método atual primeiro."
            onSelect={() => setMethod("totp")}
            value="totp"
          />
          {showWhatsapp ? (
            <MethodOption
              label="WhatsApp — mais prático (conveniência)"
              description="Receba o código no seu WhatsApp ao entrar."
              selected={method === "whatsapp"}
              disabled={whatsappDisabled}
              disabledHint="Desative o método atual primeiro."
              onSelect={() => setMethod("whatsapp")}
              value="whatsapp"
            />
          ) : null}
        </CardContent>
      </Card>

      {method === "totp" ? (
        <MfaSection />
      ) : (
        <WhatsappMfaSection
          isEnabled={whatsappEnabled}
          enabledPhone={whatsappPhone ? maskPhone(whatsappPhone) : undefined}
          onChanged={() => void refreshWhatsapp()}
          disabledReason={
            whatsappDisabled
              ? "Desative o aplicativo autenticador primeiro para usar o WhatsApp."
              : undefined
          }
        />
      )}
    </div>
  );
}

interface MethodOptionProps {
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  disabledHint: string;
  onSelect: () => void;
  value: Method;
}

function MethodOption({
  label,
  description,
  selected,
  disabled,
  disabledHint,
  onSelect,
  value,
}: MethodOptionProps) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-muted/50",
      )}
    >
      <input
        type="radio"
        name="two-factor-method"
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect()}
        className="mt-1 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="flex flex-col gap-0.5">
        <Label className="cursor-pointer text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">{description}</span>
        {disabled ? (
          <span className="text-xs text-muted-foreground italic">
            {disabledHint}
          </span>
        ) : null}
      </div>
    </label>
  );
}
