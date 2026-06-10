"use client";

import * as React from "react";
import {
  multiFactor,
  onIdTokenChanged,
  TotpMultiFactorGenerator,
  type MultiFactorInfo,
  type TotpSecret,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { canEnrollMfa, isValidTotpCode } from "@/lib/mfa-helpers";

export type TotpEnrollmentStage = "intro" | "secret" | "done";

const ISSUER = "ProOps";

function readErrorCode(err: unknown): string {
  return err && typeof err === "object" && "code" in err
    ? String((err as { code: unknown }).code)
    : "";
}

function readErrorMessage(err: unknown): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : String(err);
}

/**
 * Encapsulates the generic TOTP enrollment/unenrollment flow shared by the
 * super-admin setup page (`/admin/setup-mfa`) and the user profile MFA section.
 * The login-time TOTP intercept lives in `auth-provider.tsx` and is untouched.
 */
export function useTotpEnrollment() {
  const [stage, setStage] = React.useState<TotpEnrollmentStage>("intro");
  const [secret, setSecret] = React.useState<TotpSecret | null>(null);
  const [code, setCodeState] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [enrolledFactors, setEnrolledFactors] = React.useState<MultiFactorInfo[]>(
    () => (auth.currentUser ? multiFactor(auth.currentUser).enrolledFactors : []),
  );

  React.useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      setEnrolledFactors(user ? multiFactor(user).enrolledFactors : []);
    });
    return unsubscribe;
  }, []);

  const refreshFactors = React.useCallback(() => {
    const user = auth.currentUser;
    setEnrolledFactors(user ? multiFactor(user).enrolledFactors : []);
  }, []);

  const setCode = React.useCallback((value: string) => {
    setCodeState(value.replace(/\D/g, ""));
  }, []);

  const generate = React.useCallback(async () => {
    setError("");
    const user = auth.currentUser;
    const gate = canEnrollMfa(user);
    if (!gate.ok) {
      setError(
        gate.reason === "email-unverified"
          ? "Seu email não está verificado. O Firebase exige email verificado antes de ativar o MFA — verifique seu email e tente de novo."
          : "Sessão não encontrada. Saia e entre novamente.",
      );
      return;
    }
    setBusy(true);
    try {
      const mfaSession = await multiFactor(user!).getSession();
      const totpSecret =
        await TotpMultiFactorGenerator.generateSecret(mfaSession);
      setSecret(totpSecret);
      setStage("secret");
    } catch (err) {
      const codeStr = readErrorCode(err);
      if (codeStr === "auth/requires-recent-login") {
        setError(
          "Sua sessão é antiga. Saia e entre novamente, depois retorne a esta página.",
        );
      } else if (codeStr === "auth/unverified-email") {
        setError(
          "Seu email não está verificado. Verifique seu email antes de ativar o MFA.",
        );
      } else {
        setError(
          `Não foi possível iniciar a configuração do MFA: ${codeStr || readErrorMessage(err)}`,
        );
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const enroll = React.useCallback(async () => {
    setError("");
    if (!secret) return;
    const trimmed = code.trim();
    if (!isValidTotpCode(trimmed)) {
      setError("Digite o código de 6 dígitos do seu aplicativo autenticador.");
      return;
    }
    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("NO_USER");
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        trimmed,
      );
      await multiFactor(user).enroll(assertion, "Authenticator (TOTP)");
      setStage("done");
      refreshFactors();
    } catch {
      setError(
        "Código inválido ou expirado. Confira o horário do dispositivo e tente o código atual.",
      );
    } finally {
      setBusy(false);
    }
  }, [secret, code, refreshFactors]);

  const disable = React.useCallback(async (): Promise<boolean> => {
    setError("");
    const user = auth.currentUser;
    if (!user) {
      setError("Sessão não encontrada. Saia e entre novamente.");
      return false;
    }
    const factors = multiFactor(user).enrolledFactors;
    if (factors.length === 0) return true;
    setBusy(true);
    try {
      for (const factor of factors) {
        await multiFactor(user).unenroll(factor);
      }
      refreshFactors();
      setStage("intro");
      setSecret(null);
      setCodeState("");
      return true;
    } catch (err) {
      const codeStr = readErrorCode(err);
      if (codeStr === "auth/requires-recent-login") {
        setError(
          "Sua sessão é antiga. Saia e entre novamente para desativar a verificação em dois fatores.",
        );
      } else {
        setError(
          "Não foi possível desativar a verificação em dois fatores. Tente novamente.",
        );
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, [refreshFactors]);

  const reset = React.useCallback(() => {
    setStage("intro");
    setSecret(null);
    setCodeState("");
    setError("");
  }, []);

  const otpauthUrl = React.useMemo(() => {
    if (!secret) return "";
    const accountName = auth.currentUser?.email || "usuario";
    return secret.generateQrCodeUrl(accountName, ISSUER);
  }, [secret]);

  return {
    stage,
    secret,
    otpauthUrl,
    code,
    setCode,
    error,
    setError,
    busy,
    isEnrolled: enrolledFactors.length > 0,
    enrolledFactors,
    generate,
    enroll,
    disable,
    reset,
  };
}
