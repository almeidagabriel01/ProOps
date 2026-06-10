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
import { RecoveryCodesService } from "@/services/recovery-codes-service";
import { SecurityCardSkeleton } from "@/app/settings/_components/settings-skeleton";
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
interface TwoFactorSectionProps {
  /** Reports whether the verification-method status is still loading, so the
   *  settings page can skeleton its header + the chrome in sync. */
  onLoadingChange?: (loading: boolean) => void;
}

export function TwoFactorSection({ onLoadingChange }: TwoFactorSectionProps) {
  const { user, forceSyncSession } = useAuth();
  const {
    enabled: whatsappEnabled,
    phone: whatsappPhone,
    loading: whatsappLoading,
    refresh: refreshWhatsapp,
  } = useWhatsappMfaStatus();

  const showWhatsapp = canUseWhatsappMfa(user?.role);
  const recoveryRef = React.useRef<RecoveryCodesSectionHandle>(null);

  // Report status loading up so the page skeletons its header + the chrome.
  React.useEffect(() => {
    onLoadingChange?.(whatsappLoading);
  }, [whatsappLoading, onLoadingChange]);

  // After any first enroll, offer recovery codes if the user has none yet.
  const handleEnrolled = React.useCallback(async () => {
    const section = recoveryRef.current;
    if (!section) return;
    // `refresh()` returns `null` when the status read fails (e.g. 429/network).
    // Pass the total through only when the status is known; an unknown status
    // (`null`) must NOT trigger auto-generation — `shouldAutoOpenRecoveryCodes`
    // treats `null` as fail-safe and returns false.
    const status = await section.refresh();
    if (
      shouldAutoOpenRecoveryCodes({
        hasAnyFactor: true,
        recoveryTotal: status ? status.total : null,
      })
    ) {
      await section.generateAndShow().catch(() => {
        // Failure already surfaces a toast inside the section; nothing to do.
      });
    }
  }, []);

  // After any method is disabled, reconcile the recovery codes (the backend
  // deletes them if no 2FA remains) and refresh the panel so the count
  // reflects the new state — dropping to 0 when the last factor is removed.
  const handleDisabled = React.useCallback(async () => {
    // Disabling a native MFA factor (TOTP unenroll) rotates/revokes the Firebase
    // token. Force a fresh token and re-mint the __session cookie so the client
    // token and the cookie stay consistent with the new factor state — otherwise
    // in-flight/subsequent calls can hit a stale token (transient 401/403).
    try {
      await forceSyncSession();
    } catch {
      // Best-effort: the SDK refreshes the token on the next call regardless.
    }
    try {
      await RecoveryCodesService.reconcileRecoveryCodes();
    } catch {
      // Reconcile is best-effort from the UI's perspective; never block here.
    }
    await recoveryRef.current?.refresh();
  }, [forceSyncSession]);

  // While the verification-method status loads, show the card skeleton so the
  // section matches the rest of /settings (header stays; the card fills in).
  if (whatsappLoading) {
    return <SecurityCardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Métodos de verificação</CardTitle>
        <CardDescription>
          Adicione uma camada extra de segurança ao entrar. Ative o aplicativo
          autenticador, o WhatsApp, ou ambos — e gere códigos de recuperação
          para não perder o acesso à conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        <MfaSection
          onEnrolled={() => void handleEnrolled()}
          onDisabled={() => void handleDisabled()}
        />

        {showWhatsapp ? (
          <WhatsappMfaSection
            isEnabled={whatsappEnabled}
            enabledPhone={whatsappPhone ? maskPhone(whatsappPhone) : undefined}
            onChanged={() => void refreshWhatsapp()}
            onEnrolled={() => void handleEnrolled()}
            onDisabled={() => void handleDisabled()}
          />
        ) : null}

        <RecoveryCodesSection ref={recoveryRef} />
      </CardContent>
    </Card>
  );
}
