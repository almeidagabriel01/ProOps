"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useWhatsappMfaStatus } from "@/hooks/useWhatsappMfaStatus";
import {
  canUseWhatsappMfa,
  maskPhone,
  shouldAutoOpenRecoveryCodes,
} from "@/lib/mfa-helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MfaSection } from "./mfa-section";
import { WhatsappMfaSection } from "./whatsapp-mfa-section";
import {
  RecoveryCodesSection,
  type RecoveryCodesSectionHandle,
} from "./recovery-codes-section";

/**
 * Two-factor settings for the profile. TOTP and WhatsApp are independent blocks
 * — the user may activate either, both, or neither at the same time. Super
 * admins are TOTP-only, so the WhatsApp block is hidden for them. Below the
 * methods, the recovery-codes panel lets the user generate/regenerate codes,
 * and the first time a method is enrolled with no codes yet we auto-offer them.
 */
export function TwoFactorSection() {
  const { user } = useAuth();
  const {
    enabled: whatsappEnabled,
    phone: whatsappPhone,
    refresh: refreshWhatsapp,
  } = useWhatsappMfaStatus();

  const showWhatsapp = canUseWhatsappMfa(user?.role);
  const recoveryRef = React.useRef<RecoveryCodesSectionHandle>(null);

  // After any first enroll, offer recovery codes if the user has none yet.
  const handleEnrolled = React.useCallback(async () => {
    const section = recoveryRef.current;
    if (!section) return;
    const status = await section.refresh();
    if (
      shouldAutoOpenRecoveryCodes({
        hasAnyFactor: true,
        recoveryTotal: status?.total ?? 0,
      })
    ) {
      await section.generateAndShow().catch(() => {
        // Failure already surfaces a toast inside the section; nothing to do.
      });
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Verificação em dois fatores</CardTitle>
          <CardDescription>
            Adicione uma camada extra de segurança ao entrar. Você pode ativar o
            aplicativo autenticador, o WhatsApp, ou ambos.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="flex flex-col gap-1">
            <li>Aplicativo autenticador — mais seguro (recomendado).</li>
            {showWhatsapp ? (
              <li>WhatsApp — mais prático (conveniência).</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <MfaSection onEnrolled={() => void handleEnrolled()} />

      {showWhatsapp ? (
        <WhatsappMfaSection
          isEnabled={whatsappEnabled}
          enabledPhone={whatsappPhone ? maskPhone(whatsappPhone) : undefined}
          onChanged={() => void refreshWhatsapp()}
          onEnrolled={() => void handleEnrolled()}
        />
      ) : null}

      <RecoveryCodesSection ref={recoveryRef} />
    </div>
  );
}
