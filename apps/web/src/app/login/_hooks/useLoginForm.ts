"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { User } from "@/types";
import { isPathAllowedForUser, resolveUserHome } from "@/lib/auth/resolve-user-home";
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  linkWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { AuthService } from "@/services/auth-service";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { callPublicApi } from "@/lib/api-client";
import { isValidTotpCode } from "@/lib/mfa-helpers";
import { extractEmailFromAuthError } from "../_lib/extract-email-from-auth-error";
import { isDevMfaBypassClientEnabled } from "../_lib/dev-mfa-bypass";
import { shouldReflectWhatsappGate } from "../_lib/should-reflect-whatsapp-gate";
import { useResendCountdown } from "@/hooks/useResendCountdown";
import { getCaptchaToken } from "@/lib/captcha";
import { toast } from "@/lib/toast";
import { ALLOWED_TYPES } from "@/services/storage-service";
import { TenantNiche } from "@/types";

type AuthMode = "login" | "register" | "forgot";
const AUTH_MODES: AuthMode[] = ["login", "register", "forgot"];

// Fallback cooldown when the backend does not return retryAfterSeconds on a
// resend. Mirrors the backend's 60s WhatsApp OTP cooldown.
const WHATSAPP_RESEND_COOLDOWN_SECONDS = 60;

interface ContactValidationResponse {
  success: boolean;
  email?: {
    valid: boolean;
    exists: boolean;
    normalized?: string;
    reason?: string;
  };
  phoneNumber?: {
    valid: boolean;
    exists: boolean;
    normalized?: string;
    reason?: string;
  };
}

interface UseLoginFormReturn {
  // Login fields
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;

  // Register fields - User
  name: string;
  setName: (value: string) => void;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;

  // Register fields - Company
  companyName: string;
  setCompanyName: (value: string) => void;
  companyColor: string;
  setCompanyColor: (value: string) => void;
  companyLogo: string;
  setCompanyLogo: (value: string) => void;
  companyNiche: TenantNiche;
  setCompanyNiche: (value: TenantNiche) => void;

  // State
  error: string;
  setError: (value: string) => void;
  errors: Record<string, string>; // New: specific field errors
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isLoggingIn: boolean;
  isRegistering: boolean;
  mode: AuthMode;
  setMode: (value: AuthMode) => void;
  isLoading: boolean;
  isResetting: boolean;
  resetSent: boolean;
  user: User | null;
  registerSuccessMessage: string;
  smsCode: string;
  setSmsCode: (value: string) => void;
  requiresPhoneVerification: boolean;
  isAwaitingPhoneVerification: boolean;
  isEmailVerificationPending: boolean;
  setIsEmailVerificationPending: (value: boolean) => void;
  isSendingSms: boolean;
  isVerifyingSmsCode: boolean;
  isGoogleLoading: boolean;
  isSessionSynced: boolean;
  redirectReason: string | null;
  requiresMfaCode: boolean;
  mfaLoginCode: string;
  setMfaLoginCode: (value: string) => void;
  isVerifyingMfaCode: boolean;
  // TOTP recovery-code flow (native TOTP screen)
  showTotpRecovery: boolean;
  openTotpRecovery: () => void;
  closeTotpRecovery: () => void;
  totpRecoveryEmail: string;
  setTotpRecoveryEmail: (value: string) => void;
  totpRecoveryCode: string;
  setTotpRecoveryCode: (value: string) => void;
  totpRecoveryPassword: string;
  setTotpRecoveryPassword: (value: string) => void;
  isRecoveringTotp: boolean;
  totpRecoveryError: string;
  totpRecoverySuccess: string;
  requiresWhatsappOtp: boolean;
  whatsappOtpCode: string;
  setWhatsappOtpCode: (value: string) => void;
  whatsappMaskedPhone: string;
  isVerifyingWhatsappOtp: boolean;
  isResendingWhatsappOtp: boolean;
  whatsappResendSecondsLeft: number;
  canResendWhatsapp: boolean;
  whatsappResendNotice: string;
  // WhatsApp recovery-code flow (WhatsApp OTP screen)
  showWhatsappRecovery: boolean;
  openWhatsappRecovery: () => void;
  closeWhatsappRecovery: () => void;
  whatsappRecoveryCode: string;
  setWhatsappRecoveryCode: (value: string) => void;
  isRecoveringWhatsapp: boolean;
  whatsappRecoveryError: string;
  // WhatsApp fallback on the native TOTP screen (alternative to the app code)
  whatsappFallbackAvailable: boolean;
  whatsappFallbackStage: "idle" | "otp";
  whatsappFallbackMaskedPhone: string;
  whatsappFallbackCode: string;
  setWhatsappFallbackCode: (value: string) => void;
  isSendingWhatsappFallback: boolean;
  isVerifyingWhatsappFallback: boolean;
  isResendingWhatsappFallback: boolean;

  // Handlers
  handleLogin: (e?: React.FormEvent) => Promise<void>;
  handleConfirmMfaCode: (e?: React.FormEvent) => Promise<void>;
  handleConfirmWhatsappOtp: (e?: React.FormEvent) => Promise<void>;
  handleResendWhatsappOtp: () => Promise<void>;
  handleRecoverTotpWithCode: (e?: React.FormEvent) => Promise<void>;
  handleConfirmWhatsappRecovery: (e?: React.FormEvent) => Promise<void>;
  handleSwitchToWhatsappFallback: () => Promise<void>;
  handleBackToTotpFromFallback: () => void;
  handleConfirmWhatsappFallback: (e?: React.FormEvent) => Promise<void>;
  handleResendWhatsappFallback: () => Promise<void>;
  handleRegister: (e?: React.FormEvent) => Promise<void>;
  handleForgotPassword: (e?: React.FormEvent) => Promise<void>;
  handleGoogleAuth: () => Promise<void>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmPhoneCode: () => Promise<void>;
  handleResendPhoneCode: () => Promise<void>;
}

export function useLoginForm(): UseLoginFormReturn {
  // Login fields
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // Register fields - User
  const [name, setName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");

  // Register fields - Company/Tenant
  const [companyName, setCompanyName] = React.useState("");
  const [companyColor, setCompanyColor] = React.useState("#8b5cf6");
  const [companyLogo, setCompanyLogo] = React.useState("");
  const [companyNiche, setCompanyNiche] = React.useState<TenantNiche>(
    "automacao_residencial",
  );

  const [error, setError] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({}); // New: specific field errors
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [registerSuccessMessage, setRegisterSuccessMessage] =
    React.useState("");
  const [smsCode, setSmsCode] = React.useState("");
  const [smsVerificationId, setSmsVerificationId] = React.useState("");
  const [requiresPhoneVerification, setRequiresPhoneVerification] =
    React.useState(false);
  const [isAwaitingPhoneVerification, setIsAwaitingPhoneVerification] =
    React.useState(false);
  const [isEmailVerificationPending, setIsEmailVerificationPending] =
    React.useState(false);
  const [isSendingSms, setIsSendingSms] = React.useState(false);
  const [isVerifyingSmsCode, setIsVerifyingSmsCode] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [requiresMfaCode, setRequiresMfaCode] = React.useState(false);
  const [mfaLoginCode, setMfaLoginCode] = React.useState("");
  const [isVerifyingMfaCode, setIsVerifyingMfaCode] = React.useState(false);
  // TOTP recovery-code flow (native TOTP screen)
  const [showTotpRecovery, setShowTotpRecovery] = React.useState(false);
  const [totpRecoveryEmail, setTotpRecoveryEmail] = React.useState("");
  const [totpRecoveryCode, setTotpRecoveryCode] = React.useState("");
  const [totpRecoveryPassword, setTotpRecoveryPassword] = React.useState("");
  const [isRecoveringTotp, setIsRecoveringTotp] = React.useState(false);
  const [totpRecoveryError, setTotpRecoveryError] = React.useState("");
  const [totpRecoverySuccess, setTotpRecoverySuccess] = React.useState("");
  // WhatsApp recovery-code flow (WhatsApp OTP screen)
  const [showWhatsappRecovery, setShowWhatsappRecovery] = React.useState(false);
  const [whatsappRecoveryCode, setWhatsappRecoveryCode] = React.useState("");
  const [isRecoveringWhatsapp, setIsRecoveringWhatsapp] = React.useState(false);
  const [whatsappRecoveryError, setWhatsappRecoveryError] = React.useState("");
  const [requiresWhatsappOtp, setRequiresWhatsappOtp] = React.useState(false);
  const [whatsappOtpCode, setWhatsappOtpCode] = React.useState("");
  const [whatsappMaskedPhone, setWhatsappMaskedPhone] = React.useState("");
  const [isVerifyingWhatsappOtp, setIsVerifyingWhatsappOtp] =
    React.useState(false);
  const [isResendingWhatsappOtp, setIsResendingWhatsappOtp] =
    React.useState(false);
  const [whatsappResendNotice, setWhatsappResendNotice] = React.useState("");
  const {
    secondsLeft: whatsappResendSecondsLeft,
    canResend: canResendWhatsapp,
    start: startWhatsappResendCountdown,
  } = useResendCountdown();
  // WhatsApp fallback on the native TOTP screen: when an account has BOTH TOTP
  // and WhatsApp MFA, the user may choose to receive the code via WhatsApp
  // instead of the authenticator app. `mfaEmail` identifies the account at this
  // pre-sign-in stage (the form email is empty on Google sign-in, so it is also
  // captured from the MFA error). Reuses the WhatsApp resend countdown above.
  const [mfaEmail, setMfaEmail] = React.useState("");
  const [whatsappFallbackAvailable, setWhatsappFallbackAvailable] =
    React.useState(false);
  const [whatsappFallbackMaskedPhone, setWhatsappFallbackMaskedPhone] =
    React.useState("");
  const [whatsappFallbackStage, setWhatsappFallbackStage] = React.useState<
    "idle" | "otp"
  >("idle");
  const [whatsappFallbackCode, setWhatsappFallbackCode] = React.useState("");
  const [isSendingWhatsappFallback, setIsSendingWhatsappFallback] =
    React.useState(false);
  const [isVerifyingWhatsappFallback, setIsVerifyingWhatsappFallback] =
    React.useState(false);
  const [isResendingWhatsappFallback, setIsResendingWhatsappFallback] =
    React.useState(false);
  // Tracks the email already probed for availability so the effect runs once.
  const fallbackCheckedEmailRef = React.useRef<string>("");

  const recaptchaRef = React.useRef<RecaptchaVerifier | null>(null);

  const normalizePhoneToE164 = React.useCallback((value: string): string => {
    let digits = String(value || "").replace(/\D/g, "");

    if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`;
    }

    if (digits.length === 12 && digits.startsWith("55")) {
      const ddd = digits.substring(2, 4);
      const subscriber = digits.substring(4);
      if (!subscriber.startsWith("9") && subscriber.length === 8) {
        digits = `55${ddd}9${subscriber}`;
      }
    }

    return digits.startsWith("+") ? digits : `+${digits}`;
  }, []);

  const getRecaptchaVerifier = React.useCallback((): RecaptchaVerifier => {
    if (typeof window === "undefined") {
      throw new Error("RECAPTCHA_UNAVAILABLE");
    }

    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
        },
      );
    }

    return recaptchaRef.current;
  }, []);

  const sendPhoneVerificationCode = React.useCallback(
    async (rawPhone: string): Promise<boolean> => {
      try {
        setIsSendingSms(true);
        setError("");

        const e164Phone = normalizePhoneToE164(rawPhone);
        const appVerifier = getRecaptchaVerifier();
        const provider = new PhoneAuthProvider(auth);
        const verificationId = await provider.verifyPhoneNumber(
          e164Phone,
          appVerifier,
        );

        setSmsVerificationId(verificationId);
        setIsAwaitingPhoneVerification(true);
        setRegisterSuccessMessage(
          "Enviamos um SMS com código para confirmar seu telefone.",
        );
        return true;
      } catch (smsError) {
        console.error("Failed to send SMS verification:", smsError);
        setError(
          "Não foi possível enviar o SMS de confirmação agora. Tente reenviar.",
        );
        return false;
      } finally {
        setIsSendingSms(false);
      }
    },
    [getRecaptchaVerifier, normalizePhoneToE164],
  );

  const handleForgotPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) {
      setError("Digite seu email para redefinir a senha.");
      return;
    }

    setIsResetting(true);

    try {
      await AuthService.requestPasswordReset(email);
    } catch (err: unknown) {
      console.warn("Password reset request finished with non-fatal error", err);
    } finally {
      setResetSent(true);
      setError("");
      setIsResetting(false);
    }
  };
  const { login, resolveTotpLogin, resolveWhatsappLogin, resolveWhatsappRecovery, signInWithRecoveryToken, resendWhatsappOtp, completeSessionAfterSignIn, prepareMfaChallenge, user, isLoading, isSessionSynced, whatsappMfaPending, refreshUser } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive initial mode from current path, then keep it in local state
  // so that switching modes does NOT cause a route navigation (which would
  // unmount the page and kill CSS slide transitions).
  const [mode, setModeState] = React.useState<AuthMode>(() => {
    if (pathname === "/register") return "register";
    if (pathname === "/forgot-password") return "forgot";
    const modeParam = searchParams.get("mode");
    if (AUTH_MODES.includes(modeParam as AuthMode))
      return modeParam as AuthMode;
    return "login";
  });

  // Update the browser URL bar (without navigation) when mode changes
  const setMode = React.useCallback(
    (value: AuthMode) => {
      setModeState(value);

      // Build the new URL path without causing a Next.js navigation
      const params = new URLSearchParams(searchParams.toString());
      params.delete("mode");
      const query = params.toString();

      let newPath: string;
      if (value === "register") {
        newPath = query ? `/register?${query}` : "/register";
      } else if (value === "forgot") {
        newPath = query ? `/forgot-password?${query}` : "/forgot-password";
      } else {
        newPath = query ? `/login?${query}` : "/login";
      }

      // replaceState updates the URL bar without any navigation / re-mount
      window.history.replaceState(null, "", newPath);
    },
    [searchParams],
  );

  // On mount: clear sticky ?redirect_reason param left over from an explicit logout
  React.useEffect(() => {
    try {
      if (sessionStorage.getItem("proops_just_logged_out")) {
        sessionStorage.removeItem("proops_just_logged_out");
        const params = new URLSearchParams(window.location.search);
        if (params.has("redirect_reason")) {
          params.delete("redirect_reason");
          const query = params.toString();
          window.history.replaceState(null, "", query ? `/login?${query}` : "/login");
        }
      }
    } catch {
      // noop — SSR or storage disabled
    }
  }, []);

  const redirectReason = searchParams.get("redirect_reason");

  const getGoogleSetupTarget = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    // Keep ?redirect= so a new Google user who came from a plan card is sent to
    // the Stripe checkout (/subscribe) after finishing company setup — not the
    // free demo ERP. google-setup validates it (payment-flow paths only).
    const query = params.toString();
    return query ? `/register/google-setup?${query}` : "/register/google-setup";
  }, [searchParams]);

  const handleRedirectAfterAuth = React.useCallback(() => {
    const currentUser = auth.currentUser;
    const skipEmailVerification =
      process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
    if (currentUser && !currentUser.emailVerified && !skipEmailVerification) {
      setIsEmailVerificationPending(true);
      return;
    }

    // Superadmins always land on /admin
    if (user?.role === "superadmin") {
      window.location.replace("/admin");
      return;
    }

    // Only honour ?redirect= for explicit payment-flow paths
    // (e.g. /login?redirect=/subscribe?plan=pro from the pricing page).
    // Arbitrary ERP routes (/proposals, /dashboard, /contacts, etc.) are
    // intentionally ignored so that a user always lands on their role-based
    // home after login, regardless of URL params.
    const REDIRECT_ALLOWED_PREFIXES = ["/subscribe", "/checkout-success"];
    const redirectParam = searchParams.get("redirect");
    if (redirectParam) {
      const decoded = (() => {
        try {
          return decodeURIComponent(redirectParam);
        } catch {
          return redirectParam;
        }
      })();
      const isInternal = decoded.startsWith("/") && !decoded.startsWith("//");
      const base = decoded.split("?")[0];
      const isPaymentFlow = REDIRECT_ALLOWED_PREFIXES.some(
        (prefix) => base === prefix || base.startsWith(prefix + "/"),
      );
      if (isInternal && isPaymentFlow && isPathAllowedForUser(decoded, user ?? null)) {
        router.replace(decoded);
        return;
      }
    }

    // Fallback: role-based home resolution. resolveUserHome handles
    // free → "/dashboard", subscription-blocked → "/subscription-blocked",
    // admin/MASTER → "/dashboard", MEMBER → first-allowed page.
    const home = resolveUserHome(user ?? null);
    router.replace(home.path);
  }, [router, user, searchParams]);

  // If already logged in, redirect
  React.useEffect(() => {
    // While a WhatsApp OTP challenge is pending the cookie is withheld; never
    // redirect (a racing background session sync could otherwise flip
    // isSessionSynced before the OTP is entered).
    if (requiresWhatsappOtp) return;
    if (!isLoading) {
      if (user) {
        const currentUser = auth.currentUser;
        const isGoogleAccount =
          currentUser?.providerData?.some(
            (provider) => provider.providerId === "google.com",
          ) || false;

        if (
          isGoogleAccount &&
          (!user.tenantId || user.tenantId === "default-tenant")
        ) {
          router.replace(getGoogleSetupTarget());
          return;
        }

        // Always wait for the session cookie before redirecting.
        // Without this, the middleware rejects the navigation (no cookie),
        // redirects to /login?session_expired, and creates a redirect loop.
        if (!isSessionSynced) {
          return;
        }

        handleRedirectAfterAuth();
      } else if (auth.currentUser) {
        const skipEmailVerification =
          process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
        if (!auth.currentUser.emailVerified && !skipEmailVerification) {
          setIsEmailVerificationPending(true);
        }
      }
    }
  }, [
    user,
    isLoading,
    router,
    isSessionSynced,
    handleRedirectAfterAuth,
    getGoogleSetupTarget,
    setIsEmailVerificationPending,
    requiresWhatsappOtp,
  ]);

  // NOTE: in-place session recovery for `redirect_reason=session_expired` used to
  // live here as a fixed 4000ms setTimeout → forceSyncSession. It was racy (could
  // report failure mid-sync) and could hang. Recovery now happens deterministically
  // in the /auth/refresh interstitial (the proxy routes expired sessions there).
  // Only the "session expired" toast for the terminal re-auth case remains below.
  React.useEffect(() => {
    if (isLoading) return;
    if (user) return;
    if (redirectReason !== "session_expired") return;
    // Defer by one tick so the Toaster (mounted in providers.tsx after children)
    // is guaranteed to be in the DOM and able to render the queued toast. Without
    // this, an early toast.warning call during initial hydration can be dropped.
    const id = window.setTimeout(() => {
      toast.warning("Sua sessão expirou. Entre novamente para continuar.");
    }, 0);
    return () => window.clearTimeout(id);
  }, [redirectReason, user, isLoading]);

  // Reload survival for the WhatsApp OTP screen. On F5 the local
  // requiresWhatsappOtp state is lost, but the still-signed-in Firebase user
  // makes the background session sync re-detect the gate and set
  // whatsappMfaPending on the provider. Reflect it back into the local OTP
  // screen so the user sees the code form (with the correct remaining cooldown)
  // instead of hanging on the logged-in loader. The guard (!requiresWhatsappOtp)
  // prevents conflict with the foreground login paths (which already set it) and
  // prevents a re-render loop. We do NOT trigger a new send here — the backend's
  // retryAfterSeconds reflects the true remaining cooldown.
  React.useEffect(() => {
    if (
      shouldReflectWhatsappGate({
        hasWhatsappMfaPending: Boolean(whatsappMfaPending),
        requiresWhatsappOtp,
      })
    ) {
      setWhatsappMaskedPhone(whatsappMfaPending?.maskedPhone || "");
      setRequiresWhatsappOtp(true);
      startWhatsappResendCountdown(whatsappMfaPending?.retryAfterSeconds ?? 0);
    }
  }, [whatsappMfaPending, requiresWhatsappOtp, startWhatsappResendCountdown]);

  // LOCAL DEV ONLY. Attempts the superadmin MFA bypass on localhost. Calls the
  // Next.js dev route (server-side, NODE_ENV-gated — inert on Vercel) which mints
  // a SESSION-SCOPED custom token without touching the account, then signs in
  // with it (which skips the native TOTP challenge). The TOTP factor stays
  // enrolled, so preview/prod still require MFA. Returns false (not localhost/dev,
  // not a superadmin, wrong password, or the route refused) so the caller falls
  // back to the native TOTP screen.
  const tryDevMfaBypass = async (
    accountEmail: string,
    accountPassword: string,
  ): Promise<boolean> => {
    if (
      !isDevMfaBypassClientEnabled(
        typeof window !== "undefined" ? window.location.hostname : undefined,
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      )
    ) {
      return false;
    }
    try {
      const response = await fetch("/api/dev/mfa-bypass", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: accountEmail, password: accountPassword }),
      });
      if (!response.ok) return false;
      const { customToken } = (await response.json()) as {
        customToken?: string;
      };
      if (!customToken) return false;
      const result = await signInWithRecoveryToken(customToken);
      return result.success === true;
    } catch {
      // Route refused (not a superadmin, wrong password, gate off) — fall back to
      // the normal TOTP screen.
      return false;
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setErrors({});
    setRegisterSuccessMessage("");

    // Manual validation
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = "Email é obrigatório";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Senha é obrigatória";
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = "A senha deve ter pelo menos 6 caracteres";
      isValid = false;
    }

    if (!isValid) {
      setErrors(newErrors);
      return;
    }

    setIsLoggingIn(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        if (result.code === "email-not-verified") {
          setIsEmailVerificationPending(true);
        } else if (result.code === "mfa-required") {
          // LOCAL DEV ONLY: on localhost against the erp-softcode dev project,
          // try to skip the native TOTP challenge for the superadmin. The backend
          // refuses (404/403) for anything else, so we just fall through to the
          // normal TOTP screen when the bypass is not applicable.
          const bypassed = await tryDevMfaBypass(email, password);
          if (!bypassed) {
            setMfaEmail(email);
            setRequiresMfaCode(true);
          }
        } else if (result.code === "whatsapp-mfa-required") {
          setWhatsappMaskedPhone(result.maskedPhone || "");
          setRequiresWhatsappOtp(true);
          startWhatsappResendCountdown(result.retryAfterSeconds ?? 0);
        } else if (result.code === "session-sync-failed") {
          // Credentials were valid but the __session cookie could not be minted
          // even after the bounded retry. Surface a real, retryable error instead
          // of hanging on the loader.
          setError("Não foi possível concluir o login. Tente novamente.");
        } else {
          setError("Falha no login. Verifique suas credenciais.");
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConfirmMfaCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const trimmed = mfaLoginCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Digite o código de 6 dígitos do seu aplicativo autenticador.");
      return;
    }

    setIsVerifyingMfaCode(true);
    try {
      const result = await resolveTotpLogin(trimmed);
      if (result.success) {
        // The user-state effect handles the post-login redirect.
        setRequiresMfaCode(false);
        setMfaLoginCode("");
      } else {
        setError("Código inválido ou expirado. Tente o código atual do app.");
      }
    } finally {
      setIsVerifyingMfaCode(false);
    }
  };

  // Silent availability probe: once the native TOTP screen is shown and we know
  // the account email, ask the backend (reusing the form password when present)
  // whether WhatsApp can serve as an alternative. Only reveals the option when
  // truly available. Runs once per email; non-fatal failures hide the option.
  React.useEffect(() => {
    if (!requiresMfaCode || !mfaEmail) return;
    if (whatsappFallbackStage !== "idle") return;
    if (fallbackCheckedEmailRef.current === mfaEmail) return;
    fallbackCheckedEmailRef.current = mfaEmail;
    let cancelled = false;
    void (async () => {
      try {
        const res = await AuthService.checkWhatsappLoginFallback(
          mfaEmail,
          password || undefined,
        );
        if (cancelled || !res.available) return;
        setWhatsappFallbackAvailable(true);
        setWhatsappFallbackMaskedPhone(res.maskedPhone || "");
      } catch {
        // non-fatal: silently leave the option hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requiresMfaCode, mfaEmail, password, whatsappFallbackStage]);

  // User chose to receive the 2FA code via WhatsApp: send the OTP and switch the
  // TOTP screen into the WhatsApp code-entry stage.
  const handleSwitchToWhatsappFallback = async () => {
    setError("");
    setWhatsappResendNotice("");
    setIsSendingWhatsappFallback(true);
    try {
      const res = await AuthService.sendWhatsappLoginFallback(
        mfaEmail,
        password || undefined,
      );
      if (!res.available) {
        setError("Não foi possível enviar o código por WhatsApp.");
        return;
      }
      setWhatsappFallbackMaskedPhone(
        res.maskedPhone || whatsappFallbackMaskedPhone,
      );
      setWhatsappFallbackCode("");
      setWhatsappFallbackStage("otp");
      startWhatsappResendCountdown(
        res.retryAfterSeconds ?? WHATSAPP_RESEND_COOLDOWN_SECONDS,
      );
    } catch {
      setError("Não foi possível enviar o código por WhatsApp. Tente novamente.");
    } finally {
      setIsSendingWhatsappFallback(false);
    }
  };

  // Back from the WhatsApp stage to the authenticator-app code input.
  const handleBackToTotpFromFallback = () => {
    setWhatsappFallbackStage("idle");
    setWhatsappFallbackCode("");
    setError("");
  };

  const handleConfirmWhatsappFallback = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const trimmed = whatsappFallbackCode.trim();
    if (!isValidTotpCode(trimmed)) {
      setError("Digite o código de 6 dígitos enviado para o seu WhatsApp.");
      return;
    }

    setIsVerifyingWhatsappFallback(true);
    try {
      const { customToken } = await AuthService.verifyWhatsappLoginFallback(
        mfaEmail,
        trimmed,
      );
      if (!customToken) {
        setError("Não foi possível concluir a verificação.");
        return;
      }

      // The custom token carries `whatsapp_login`, so the session gate does NOT
      // re-challenge WhatsApp. TOTP stays enrolled; the post-login redirect
      // effect takes over once the session is synced.
      const result = await signInWithRecoveryToken(customToken);
      if (result.success) {
        setRequiresMfaCode(false);
        setWhatsappFallbackStage("idle");
        setWhatsappFallbackCode("");
        setMfaLoginCode("");
      } else if (result.code === "whatsapp-mfa-required") {
        // Defensive: should not happen (claim skips the gate). Hand off to the
        // standard WhatsApp OTP screen if it ever does.
        setRequiresMfaCode(false);
        setWhatsappFallbackStage("idle");
        setWhatsappMaskedPhone(result.maskedPhone || "");
        setRequiresWhatsappOtp(true);
        startWhatsappResendCountdown(result.retryAfterSeconds ?? 0);
      } else {
        setError("Não foi possível concluir o login. Tente novamente.");
      }
    } catch (verifyError: unknown) {
      const attemptsLeft = (verifyError as { attemptsLeft?: number })
        ?.attemptsLeft;
      if (typeof attemptsLeft === "number") {
        setError(
          attemptsLeft > 0
            ? `Código inválido. Tentativas restantes: ${attemptsLeft}.`
            : "Código inválido. Solicite um novo código.",
        );
      } else {
        setError("Código inválido ou expirado. Tente novamente.");
      }
    } finally {
      setIsVerifyingWhatsappFallback(false);
    }
  };

  const handleResendWhatsappFallback = async () => {
    if (!canResendWhatsapp) return;
    setError("");
    setWhatsappResendNotice("");
    setWhatsappFallbackCode("");
    setIsResendingWhatsappFallback(true);
    try {
      const { otpSent, retryAfterSeconds } =
        await AuthService.sendWhatsappLoginFallback(
          mfaEmail,
          password || undefined,
          true,
        );
      startWhatsappResendCountdown(
        retryAfterSeconds ?? WHATSAPP_RESEND_COOLDOWN_SECONDS,
      );
      setWhatsappResendNotice(
        otpSent ? "Novo código enviado." : "Aguarde para reenviar o código.",
      );
    } catch {
      setError("Não foi possível reenviar o código. Tente novamente.");
    } finally {
      setIsResendingWhatsappFallback(false);
    }
  };

  const handleConfirmWhatsappOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const trimmed = whatsappOtpCode.trim();
    if (!isValidTotpCode(trimmed)) {
      setError("Digite o código de 6 dígitos enviado para o seu WhatsApp.");
      return;
    }

    setIsVerifyingWhatsappOtp(true);
    try {
      const result = await resolveWhatsappLogin(trimmed);
      if (result.success) {
        // The user-state effect handles the post-login redirect once the cookie
        // is in sync.
        setRequiresWhatsappOtp(false);
        setWhatsappOtpCode("");
      } else if (typeof result.attemptsLeft === "number") {
        setError(
          result.attemptsLeft > 0
            ? `Código inválido. Tentativas restantes: ${result.attemptsLeft}.`
            : "Código inválido. Solicite um novo código.",
        );
      } else {
        setError("Código inválido ou expirado. Tente novamente.");
      }
    } finally {
      setIsVerifyingWhatsappOtp(false);
    }
  };

  const handleResendWhatsappOtp = async () => {
    // The countdown owns the gate: while seconds remain, resend is disabled.
    if (!canResendWhatsapp) return;
    setError("");
    setWhatsappResendNotice("");
    setWhatsappOtpCode("");
    setIsResendingWhatsappOtp(true);
    try {
      // Explicit resend forces a fresh code (resend: true) subject to the
      // backend cooldown/cap. otpSent === false means the cooldown/cap blocked a
      // new send; we still restart the countdown from the backend's authoritative
      // retryAfterSeconds so the button reflects the true wait.
      const { otpSent, retryAfterSeconds } = await resendWhatsappOtp();
      startWhatsappResendCountdown(
        retryAfterSeconds ?? WHATSAPP_RESEND_COOLDOWN_SECONDS,
      );
      setWhatsappResendNotice(
        otpSent ? "Novo código enviado." : "Fora realizadas várias tentativas em um curto período. Aguarde para reenviar.",
      );
    } catch {
      // Network/transient error — keep the screen usable and let the user retry.
      setError("Não foi possível reenviar o código. Tente novamente.");
    } finally {
      setIsResendingWhatsappOtp(false);
    }
  };

  // Reveal the TOTP recovery-code form, prefilling the email from the login form
  // when available (it is editable — on Google sign-in the form `email` is empty,
  // so the user must type it). The native TOTP screen is reached BEFORE the
  // Firebase sign-in completes (the multi-factor challenge is pending), so there
  // is no signed-in user email to fall back to here.
  const openTotpRecovery = React.useCallback(() => {
    setTotpRecoveryError("");
    setTotpRecoverySuccess("");
    setTotpRecoveryCode("");
    setTotpRecoveryPassword("");
    setTotpRecoveryEmail((prev) => prev || email);
    setShowTotpRecovery(true);
  }, [email]);

  // Return from the recovery-code form back to the authenticator-app code input.
  const closeTotpRecovery = React.useCallback(() => {
    setShowTotpRecovery(false);
    setTotpRecoveryError("");
    setTotpRecoveryCode("");
    setTotpRecoveryPassword("");
  }, []);

  const handleRecoverTotpWithCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTotpRecoveryError("");
    setTotpRecoverySuccess("");

    const trimmedEmail = totpRecoveryEmail.trim();
    const trimmedCode = totpRecoveryCode.trim();
    if (!trimmedEmail) {
      setTotpRecoveryError("Informe o e-mail da sua conta.");
      return;
    }
    if (!trimmedCode) {
      setTotpRecoveryError("Informe um código de recuperação.");
      return;
    }

    setIsRecoveringTotp(true);
    try {
      const password = totpRecoveryPassword.trim();
      const { customToken } = await AuthService.recoverTotpWithCode(
        trimmedEmail,
        trimmedCode,
        password ? password : undefined,
      );
      if (!customToken) {
        setTotpRecoveryError("Não foi possível usar o código de recuperação.");
        return;
      }

      // The recovery code is valid: sign the user in directly with the custom
      // token (TOTP stays enrolled). If the account also has WhatsApp 2FA,
      // finalizeLogin surfaces the gate and we route into the OTP screen.
      const result = await signInWithRecoveryToken(customToken);
      if (result.success) {
        // Signed in. Clear the recovery/TOTP screens; the post-login redirect
        // effect takes over from here.
        setRequiresMfaCode(false);
        setShowTotpRecovery(false);
        setMfaLoginCode("");
        setTotpRecoveryCode("");
        setTotpRecoveryPassword("");
        setError("");
        setTotpRecoveryError("");
        setTotpRecoverySuccess("Entrando...");
      } else if (result.code === "whatsapp-mfa-required") {
        // Account also has WhatsApp 2FA — hand off to the WhatsApp OTP screen.
        setRequiresMfaCode(false);
        setShowTotpRecovery(false);
        setMfaLoginCode("");
        setTotpRecoveryCode("");
        setTotpRecoveryPassword("");
        setTotpRecoveryError("");
        setWhatsappMaskedPhone(result.maskedPhone || "");
        setRequiresWhatsappOtp(true);
        startWhatsappResendCountdown(result.retryAfterSeconds ?? 0);
      } else {
        setTotpRecoveryError(
          "Não foi possível concluir o login com o código de recuperação.",
        );
      }
    } catch (recoverError: unknown) {
      const message =
        recoverError instanceof Error
          ? recoverError.message
          : "Não foi possível usar o código de recuperação.";
      setTotpRecoveryError(message);
    } finally {
      setIsRecoveringTotp(false);
    }
  };

  const openWhatsappRecovery = React.useCallback(() => {
    setWhatsappRecoveryError("");
    setWhatsappRecoveryCode("");
    setShowWhatsappRecovery(true);
  }, []);

  // Return from the recovery-code form back to the WhatsApp OTP input.
  const closeWhatsappRecovery = React.useCallback(() => {
    setShowWhatsappRecovery(false);
    setWhatsappRecoveryError("");
    setWhatsappRecoveryCode("");
  }, []);

  const handleConfirmWhatsappRecovery = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setWhatsappRecoveryError("");

    const trimmedCode = whatsappRecoveryCode.trim();
    if (!trimmedCode) {
      setWhatsappRecoveryError("Informe um código de recuperação.");
      return;
    }

    setIsRecoveringWhatsapp(true);
    try {
      const result = await resolveWhatsappRecovery(trimmedCode);
      if (result.success) {
        // The user-state effect handles the post-login redirect once the cookie
        // is in sync.
        setRequiresWhatsappOtp(false);
        setShowWhatsappRecovery(false);
        setWhatsappOtpCode("");
        setWhatsappRecoveryCode("");
      } else {
        setWhatsappRecoveryError("Código de recuperação inválido.");
      }
    } finally {
      setIsRecoveringWhatsapp(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setErrors({});
    setRegisterSuccessMessage("");
    setIsGoogleLoading(true);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const isMobile =
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
        navigator.userAgent,
      );

    if (isMobile) {
      await signInWithRedirect(auth, provider);
      return;
    }

    // Watch the popup window and release the loading state the moment
    // the user closes it, without waiting for Firebase's own polling delay.
    let popupClosedEarly = false;
    let popupWatchInterval: ReturnType<typeof setInterval> | null = null;

    const watchPopup = (popupWindow: Window | null) => {
      if (!popupWindow) return;
      popupWatchInterval = setInterval(() => {
        if (popupWindow.closed) {
          clearInterval(popupWatchInterval!);
          popupClosedEarly = true;
          setIsGoogleLoading(false);
        }
      }, 300);
    };

    // signInWithPopup opens the popup internally; we intercept it by patching
    // window.open temporarily so we can grab a reference to the popup window.
    const originalOpen = window.open.bind(window);
    let popupRef: Window | null = null;
    window.open = (...args) => {
      popupRef = originalOpen(...args);
      watchPopup(popupRef);
      return popupRef;
    };

    try {
      const userCredential = await signInWithPopup(auth, provider);

      // Popup completed successfully — stop watching.
      if (popupWatchInterval) clearInterval(popupWatchInterval);
      window.open = originalOpen;

      const firebaseUser = userCredential.user;
      const additionalInfo = getAdditionalUserInfo(userCredential);

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      const hasTenant = Boolean(userDoc.exists() && userDoc.data()?.tenantId);

      if (additionalInfo?.isNewUser || !hasTenant) {
        router.replace(getGoogleSetupTarget());
      } else {
        // Existing tenant user: drive session creation so the WhatsApp-MFA gate
        // can route into the OTP screen instead of silently withholding access.
        const session = await completeSessionAfterSignIn();
        if (session.code === "whatsapp-mfa-required") {
          setWhatsappMaskedPhone(session.maskedPhone || "");
          setRequiresWhatsappOtp(true);
          startWhatsappResendCountdown(session.retryAfterSeconds ?? 0);
          setIsGoogleLoading(false);
        }
      }
    } catch (googleError: unknown) {
      if (popupWatchInterval) clearInterval(popupWatchInterval);
      window.open = originalOpen;

      // If we already detected the popup was closed early, ignore the error.
      if (popupClosedEarly) return;

      const code = (googleError as { code?: string })?.code;
      // User intentionally closed or cancelled the popup — just stop silently.
      const silentCodes = [
        "auth/popup-closed-by-user",
        "auth/cancelled-popup-request",
      ];
      if (code && silentCodes.includes(code)) {
        setIsGoogleLoading(false);
        return;
      }

      // Account has MFA enrolled — route to the TOTP code screen instead of
      // failing. The auth-provider stashes the resolver for resolveTotpLogin.
      if (prepareMfaChallenge(googleError)) {
        setMfaEmail(extractEmailFromAuthError(googleError));
        setRequiresMfaCode(true);
        setIsGoogleLoading(false);
        return;
      }

      // Popup was blocked by the browser — fall back to full-page redirect.
      const fallbackCodes = [
        "auth/popup-blocked",
        "auth/operation-not-supported-in-this-environment",
      ];
      if (code && fallbackCodes.includes(code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error("Google auth failed:", googleError);
      setError("Não foi possível entrar com Google. Tente novamente.");
      setIsGoogleLoading(false);
    }
  };

  React.useEffect(() => {
    getRedirectResult(auth)
      .then(async (userCredential) => {
        if (!userCredential) return;
        setIsGoogleLoading(true);
        const firebaseUser = userCredential.user;
        const additionalInfo = getAdditionalUserInfo(userCredential);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        const hasTenant = Boolean(userDoc.exists() && userDoc.data()?.tenantId);
        if (additionalInfo?.isNewUser || !hasTenant) {
          router.replace(getGoogleSetupTarget());
        } else {
          const session = await completeSessionAfterSignIn();
          if (session.code === "whatsapp-mfa-required") {
            setWhatsappMaskedPhone(session.maskedPhone || "");
            setRequiresWhatsappOtp(true);
            startWhatsappResendCountdown(session.retryAfterSeconds ?? 0);
            setIsGoogleLoading(false);
          }
        }
      })
      .catch((err) => {
        // MFA-enrolled account returning from the redirect fallback — prompt
        // for the TOTP code instead of surfacing a generic error.
        if (prepareMfaChallenge(err)) {
          setMfaEmail(extractEmailFromAuthError(err));
          setRequiresMfaCode(true);
          setIsGoogleLoading(false);
          return;
        }
        console.error("getRedirectResult error:", err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear login errors on change
  React.useEffect(() => {
    if (errors.email && email.trim()) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  }, [email, errors.email]);

  React.useEffect(() => {
    if (errors.password && password) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    }
  }, [password, errors.password]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(
          "O arquivo deve ser uma imagem válida (JPEG, PNG, GIF, WebP ou SVG).",
        );
        e.target.value = "";
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError("O logo deve ter no máximo 2MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCompanyLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setErrors({});
    setRegisterSuccessMessage("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!name.trim()) {
      setError("Por favor, informe seu nome.");
      return;
    }

    if (!companyName.trim() || companyName.trim().length < 2) {
      setErrors((prev) => ({
        ...prev,
        companyName: "Nome da empresa é obrigatório",
      }));
      return;
    }

    try {
      // Submit is the authoritative check: allow an interactive challenge here
      // (the on-blur checks never force one) so the user can complete it.
      const captchaToken = await getCaptchaToken({ interactive: true });
      const contactValidation = await callPublicApi<ContactValidationResponse>(
        "v1/validation/contact",
        "POST",
        {
          email,
          phoneNumber: phoneNumber || undefined,
          captchaToken,
        },
      );

      const newErrors: Record<string, string> = {};

      if (contactValidation.email && !contactValidation.email.valid) {
        newErrors.email =
          contactValidation.email.reason || "Email inválido para cadastro.";
      }

      if (phoneNumber && contactValidation.phoneNumber) {
        if (!contactValidation.phoneNumber.valid) {
          newErrors.phoneNumber =
            contactValidation.phoneNumber.reason ||
            "Telefone inválido para cadastro.";
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...newErrors }));
        setError(
          newErrors.email ||
            newErrors.phoneNumber ||
            "Verifique os dados de contato informados.",
        );
        return;
      }
    } catch (validationError) {
      console.error("Contact validation failed:", validationError);
      setError(
        "Não foi possível validar email/telefone agora. Tente novamente.",
      );
      return;
    }

    setIsRegistering(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const firebaseUser = userCredential.user;

      const slug = companyName
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");

      const tenantId = `tenant_${firebaseUser.uid}`;
      const now = new Date().toISOString();

      await setDoc(doc(db, "tenants", tenantId), {
        name: companyName.trim(),
        slug: slug,
        primaryColor: companyColor,
        logoUrl: companyLogo || "",
        niche: companyNiche,
        createdAt: now,
      });

      await setDoc(doc(db, "users", firebaseUser.uid), {
        name: name.trim(),
        email: email,
        role: "free",
        tenantId: tenantId,
        companyId: tenantId,
        ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
        onboarding: {
          version: "core-v1",
          status: "active",
          completedStepIds: [],
          currentStepId: "dashboard",
          startedAt: now,
          updatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      });

      // createUserWithEmailAndPassword already signed the user in and fired the
      // auth listener before these writes landed, so the context may hold a
      // degraded fallback. Re-read the freshly-written profile now instead of
      // forcing the user to reload the page.
      try {
        await refreshUser();
      } catch (refreshErr) {
        console.error("Failed to refresh user after registration:", refreshErr);
      }

      try {
        await AuthService.sendVerificationEmail();
      } catch (sendErr) {
        console.error(
          "Failed to send verification email after registration:",
          sendErr,
        );
      }

      setIsRegistering(false);
      setIsEmailVerificationPending(true);
      return;
    } catch (err: unknown) {
      const error = err as { code?: string };
      console.error("Registration error:", err);
      if (error.code === "auth/email-already-in-use") {
        setError("Este email já está cadastrado. Tente fazer login.");
        setMode("login");
      } else if (error.code === "auth/weak-password") {
        setError("A senha é muito fraca. Use pelo menos 6 caracteres.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
      setIsRegistering(false);
    }
  };

  const handleConfirmPhoneCode = async () => {
    if (!smsVerificationId || !smsCode.trim()) {
      setError("Digite o código SMS para confirmar o telefone.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Sua sessão expirou. Faça login novamente para confirmar.");
      return;
    }

    try {
      setIsVerifyingSmsCode(true);
      setError("");

      const credential = PhoneAuthProvider.credential(
        smsVerificationId,
        smsCode.trim(),
      );

      await linkWithCredential(currentUser, credential);

      const { UserService } = await import("@/services/user-service");
      await UserService.updateProfile({
        phoneNumber: phoneNumber,
      });

      setIsAwaitingPhoneVerification(false);
      setRequiresPhoneVerification(false);
      setSmsCode("");
      setSmsVerificationId("");
      await signOut(auth);
      setMode("login");
      setError(
        "Telefone confirmado com sucesso! Agora confirme o email no link enviado para finalizar seu acesso.",
      );
    } catch (verifyError: unknown) {
      console.error("Phone verification confirmation failed:", verifyError);
      const code = (verifyError as { code?: string })?.code;

      if (code === "auth/invalid-verification-code") {
        setError("Código SMS inválido. Confira e tente novamente.");
      } else if (code === "auth/code-expired") {
        setError("Código expirado. Solicite um novo SMS.");
      } else if (code === "auth/provider-already-linked") {
        setError("Telefone já confirmado nesta conta.");
      } else {
        setError("Não foi possível confirmar o telefone. Tente novamente.");
      }
    } finally {
      setIsVerifyingSmsCode(false);
    }
  };

  const handleResendPhoneCode = async () => {
    const phone = phoneNumber;
    if (!phone) {
      setError("Informe um telefone para reenviar o SMS.");
      return;
    }

    await sendPhoneVerificationCode(phone);
  };

  // Effective OTP-screen flag. The reflection effect above sets the local state
  // asynchronously, so on the very first render after a reload the provider can
  // already hold the gate while requiresWhatsappOtp is still false. OR-ing the
  // provider gate in here means the OTP screen wins over the logged-in loader on
  // that first render too, eliminating any loader flash.
  const effectiveRequiresWhatsappOtp =
    requiresWhatsappOtp || Boolean(whatsappMfaPending);

  return {
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
    phoneNumber,
    setPhoneNumber,
    companyName,
    setCompanyName,
    companyColor,
    setCompanyColor,
    companyLogo,
    setCompanyLogo,
    companyNiche,
    setCompanyNiche,
    error,
    setError,
    errors,
    setErrors,
    isLoggingIn,
    isRegistering,
    mode,
    setMode,
    isLoading,
    user,
    registerSuccessMessage,
    smsCode,
    setSmsCode,
    requiresPhoneVerification,
    isAwaitingPhoneVerification,
    isEmailVerificationPending,
    setIsEmailVerificationPending,
    isSendingSms,
    isVerifyingSmsCode,
    isGoogleLoading,
    isSessionSynced,
    redirectReason,
    requiresMfaCode,
    mfaLoginCode,
    setMfaLoginCode,
    isVerifyingMfaCode,
    showTotpRecovery,
    openTotpRecovery,
    closeTotpRecovery,
    totpRecoveryEmail,
    setTotpRecoveryEmail,
    totpRecoveryCode,
    setTotpRecoveryCode,
    totpRecoveryPassword,
    setTotpRecoveryPassword,
    isRecoveringTotp,
    totpRecoveryError,
    totpRecoverySuccess,
    requiresWhatsappOtp: effectiveRequiresWhatsappOtp,
    whatsappOtpCode,
    setWhatsappOtpCode,
    whatsappMaskedPhone,
    isVerifyingWhatsappOtp,
    isResendingWhatsappOtp,
    whatsappResendSecondsLeft,
    canResendWhatsapp,
    whatsappResendNotice,
    showWhatsappRecovery,
    openWhatsappRecovery,
    closeWhatsappRecovery,
    whatsappRecoveryCode,
    setWhatsappRecoveryCode,
    isRecoveringWhatsapp,
    whatsappRecoveryError,
    whatsappFallbackAvailable,
    whatsappFallbackStage,
    whatsappFallbackMaskedPhone,
    whatsappFallbackCode,
    setWhatsappFallbackCode,
    isSendingWhatsappFallback,
    isVerifyingWhatsappFallback,
    isResendingWhatsappFallback,
    handleConfirmMfaCode,
    handleConfirmWhatsappOtp,
    handleResendWhatsappOtp,
    handleRecoverTotpWithCode,
    handleConfirmWhatsappRecovery,
    handleSwitchToWhatsappFallback,
    handleBackToTotpFromFallback,
    handleConfirmWhatsappFallback,
    handleResendWhatsappFallback,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleGoogleAuth,
    handleLogoUpload,
    handleConfirmPhoneCode,
    handleResendPhoneCode,
    resetSent,
    isResetting,
  };
}
