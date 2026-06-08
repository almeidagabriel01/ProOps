"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User as UserIcon, Building2, Upload, CheckCircle, Mail, Palette, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useLoginForm } from "./_hooks/useLoginForm";
import { CredentialFields } from "./_components/form-fields";
import {
  validateNameValue,
  validateCompanyNameValue,
  validateEmailValue,
  validatePasswordValue,
  validatePhoneValue,
} from "./_lib/register-validation";
import { callPublicApi } from "@/lib/api-client";
import { getCaptchaToken, mountCaptcha } from "@/lib/captcha";

interface ContactFieldValidation {
  valid: boolean;
  exists: boolean;
  reason?: string;
}
interface ContactValidationResponse {
  success: boolean;
  email?: ContactFieldValidation;
  phoneNumber?: ContactFieldValidation;
}
import { EmailVerificationPending } from "@/components/auth/email-verification-pending";
import {
  StepWizard,
  StepCard,
  StepNavigation,
} from "@/components/ui/step-wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NICHE_LABELS, TenantNiche } from "@/types";
import { PhoneInput } from "@/components/ui/phone-input";
import { AuthLayout } from "./_components/auth-layout";
import { motion, AnimatePresence } from "framer-motion";
import { Loader } from "@/components/ui/loader";

function LoginContent() {
  const {
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
    registerSuccessMessage,
    smsCode,
    setSmsCode,
    requiresPhoneVerification,
    isAwaitingPhoneVerification,
    isSendingSms,
    isVerifyingSmsCode,
    isEmailVerificationPending,
    setIsEmailVerificationPending,
    isLoggingIn,
    isRegistering,
    mode,
    setMode,
    isLoading,
    user,
    handleLogin,
    isResetting,
    resetSent,
    handleRegister,
    handleForgotPassword,
    handleGoogleAuth,
    handleLogoUpload,
    handleConfirmPhoneCode,
    handleResendPhoneCode,
    isGoogleLoading,
    sessionRecoveryFailed,
    requiresMfaCode,
    mfaLoginCode,
    setMfaLoginCode,
    isVerifyingMfaCode,
    handleConfirmMfaCode,
  } = useLoginForm();

  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>(
    {},
  );

  const validateRegisterStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameError = validateNameValue(name);
    if (nameError) newErrors.name = nameError;

    const emailError = validateEmailValue(email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validatePasswordValue(password);
    if (passwordError) newErrors.password = passwordError;

    setRegisterErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegisterStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    const companyNameError = validateCompanyNameValue(companyName);
    if (companyNameError) newErrors.companyName = companyNameError;

    setRegisterErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegisterStep3 = (): boolean => {
    return true; // Optional fields (color, logo)
  };

  const setRegisterFieldError = (field: string, message: string | null) => {
    setRegisterErrors((prev) => {
      const newErrors = { ...prev };
      if (message) {
        newErrors[field] = message;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  };

  const clearRegisterError = (field: string) => {
    if (registerErrors[field]) {
      setRegisterErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Sequence guards so a slow validation response for a stale value never
  // overwrites the error for what the user has since typed.
  const contactSeqRef = useRef<{ email: number; phoneNumber: number }>({
    email: 0,
    phoneNumber: 0,
  });

  // Loading state per contact field while the backend availability/validity
  // check is in flight — drives the in-input spinner, the field lock and the
  // "Continuar" button disabled state.
  const [contactValidating, setContactValidating] = useState<{
    email: boolean;
    phoneNumber: boolean;
  }>({ email: false, phoneNumber: false });

  // Mount the Turnstile widget inline in the signup form (so a challenge shows
  // below the password field, not floating in the corner) and warm it up so the
  // first on-blur validation doesn't pay the script-load + render cost inline.
  // A callback ref fires exactly when the node attaches/detaches, which is
  // robust to the step's enter animation (a [mode] effect could run before the
  // animated content mounts, leaving the widget to fall back to the corner).
  const captchaContainerRef = useCallback((el: HTMLDivElement | null) => {
    mountCaptcha(el);
  }, []);

  // Whether step 1 (account) is ready to advance: all required fields valid by
  // format AND no pending field error (e.g. email/phone already in use from the
  // backend check). Phone is optional, so an empty phone passes. Drives the
  // "Continuar" disabled state so it only enables when everything is OK.
  const isRegisterStep1Valid =
    !validateNameValue(name) &&
    !validateEmailValue(email) &&
    !validatePasswordValue(password) &&
    !validatePhoneValue(phoneNumber) &&
    !registerErrors.name &&
    !registerErrors.email &&
    !registerErrors.password &&
    !registerErrors.phoneNumber;

  // On-blur validation for contact fields: instant client-side format check,
  // then a backend availability/validity check (email already registered,
  // phone already in use) via the rate-limited public endpoint — so the user
  // sees the problem when leaving the field, not only at "Finalizar".
  const validateContactField = async (
    field: "email" | "phoneNumber",
    value: string,
  ) => {
    const formatError =
      field === "email" ? validateEmailValue(value) : validatePhoneValue(value);
    if (formatError) {
      setRegisterFieldError(field, formatError);
      return;
    }
    // Phone is optional and empty already passed the format check above.
    if (field === "phoneNumber" && !value.trim()) {
      setRegisterFieldError("phoneNumber", null);
      return;
    }

    const seq = ++contactSeqRef.current[field];
    setContactValidating((prev) => ({ ...prev, [field]: true }));
    try {
      const captchaToken = await getCaptchaToken();
      const res = await callPublicApi<ContactValidationResponse>(
        "v1/validation/contact",
        "POST",
        field === "email"
          ? { email: value, captchaToken }
          : { phoneNumber: value, captchaToken },
      );
      if (seq !== contactSeqRef.current[field]) return; // stale response
      const result = field === "email" ? res.email : res.phoneNumber;
      if (result && !result.valid) {
        setRegisterFieldError(
          field,
          result.reason ||
            (field === "email" ? "Email inválido" : "Telefone inválido"),
        );
      } else {
        setRegisterFieldError(field, null);
      }
    } catch {
      // Network/validation error: don't block the user mid-form. The submit
      // path re-runs this check authoritatively.
      if (seq === contactSeqRef.current[field]) {
        setRegisterFieldError(field, null);
      }
    } finally {
      // Only the most recent validation for this field clears the loading flag,
      // so a stale response can't unlock a field that's validating again.
      if (seq === contactSeqRef.current[field]) {
        setContactValidating((prev) => ({ ...prev, [field]: false }));
      }
    }
  };

  if (isLoading && !isLoggingIn && !isRegistering && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  // Email verification pending must take precedence over the logged-in
  // redirect gate below: right after registration, refreshUser() makes `user`
  // truthy (role "free") before the redirect/session-sync settles, and the
  // free-user branch returns null — a blank (black) screen — swallowing the
  // pending screen until a manual reload. Checking pending first avoids that.
  if (isEmailVerificationPending) {
    return (
      <AuthLayout reverse={mode === "register"}>
        <EmailVerificationPending
          email={email}
          onCancel={() => {
            setIsEmailVerificationPending(false);
            setMode("login");
          }}
          onVerified={() => {
            window.location.reload();
          }}
        />
      </AuthLayout>
    );
  }

  if (user && !isLoggingIn && !isRegistering && !sessionRecoveryFailed) {
    if (user.role === "free") return null;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (requiresMfaCode) {
    return (
      <AuthLayout reverse={false}>
        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-2xl font-semibold mb-2">Verificação em duas etapas</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Digite o código de 6 dígitos do seu aplicativo autenticador.
          </p>
          <form onSubmit={handleConfirmMfaCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="mfa-login-code">Código</Label>
              <Input
                id="mfa-login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaLoginCode}
                onChange={(e) => setMfaLoginCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              disabled={isVerifyingMfaCode || mfaLoginCode.trim().length !== 6}
              className="cursor-pointer"
            >
              {isVerifyingMfaCode ? "Verificando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </AuthLayout>
    );
  }

  const steps = [
    { id: "account", title: "Conta", icon: UserIcon },
    { id: "company", title: "Empresa", icon: Building2 },
    { id: "brand", title: "Marca", icon: Palette },
  ];

  return (
    <AuthLayout reverse={mode === "register"}>
      <div className="w-full">
        <div className="flex justify-start mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {mode === "register" ? (
            <motion.div
              key="register"
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{
                opacity: 1,
                filter: "blur(0px)",
                transition: { duration: 0.5, delay: 0.2 },
              }}
              exit={{
                opacity: 0,
                filter: "blur(4px)",
                transition: { duration: 0.2 },
              }}
              className="space-y-3"
            >
              <div className="text-left mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                  Criar conta
                </h1>
                <p className="text-muted-foreground mt-2">
                  Configure seu acesso e sua empresa em poucos passos.
                </p>
              </div>

              <StepWizard
                steps={steps}
                onComplete={() => {}}
                indicatorContainerClassName="w-full mb-6"
              >
                {/* STEP 1: ACCOUNT INFO */}
                <StepCard className="border-none shadow-none p-0 bg-transparent">
                  <div className="space-y-2">
                    <div className="grid gap-2">
                      <Label htmlFor="reg-name">Seu Nome *</Label>
                      <div className="relative">
                        <Input
                          id="reg-name"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (e.target.value.trim().length >= 2)
                              clearRegisterError("name");
                          }}
                          onBlur={() =>
                            setRegisterFieldError("name", validateNameValue(name))
                          }
                          placeholder="Nome completo"
                          className={`pl-10 h-11 ${registerErrors.name ? "border-destructive" : ""}`}
                        />
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                      {registerErrors.name && (
                        <p className="text-sm text-destructive">
                          {registerErrors.name}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reg-phone">WhatsApp / Telefone</Label>
                      <div className="relative">
                        <PhoneInput
                          id="reg-phone"
                          name="reg-phone"
                          value={phoneNumber}
                          disabled={contactValidating.phoneNumber}
                          className={
                            contactValidating.phoneNumber ? "pr-10" : undefined
                          }
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            clearRegisterError("phoneNumber");
                          }}
                          onBlur={() =>
                            validateContactField("phoneNumber", phoneNumber)
                          }
                        />
                        {contactValidating.phoneNumber && (
                          <Loader2
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
                            aria-hidden
                          />
                        )}
                      </div>
                      {registerErrors.phoneNumber && (
                        <p className="text-sm text-destructive">
                          {registerErrors.phoneNumber}
                        </p>
                      )}
                    </div>
                    <CredentialFields
                      email={email}
                      onEmailChange={(val) => {
                        setEmail(val);
                        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
                          clearRegisterError("email");
                      }}
                      onEmailBlur={() => validateContactField("email", email)}
                      isEmailValidating={contactValidating.email}
                      password={password}
                      onPasswordChange={(val) => {
                        setPassword(val);
                        if (val.length >= 6) clearRegisterError("password");
                      }}
                      mode="register"
                      error={error}
                      errors={registerErrors}
                    />
                    {/* Turnstile renders here (below the password field) when a
                        challenge is required; invisible otherwise. */}
                    <div
                      ref={captchaContainerRef}
                      className="flex justify-center"
                    />

                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          ou
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11"
                      onClick={handleGoogleAuth}
                      disabled={isGoogleLoading || isRegistering}
                    >
                      {isGoogleLoading ? (
                        <Loader size="sm" className="mr-2" />
                      ) : (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="w-4 h-4 mr-2"
                        >
                          <path
                            fill="#EA4335"
                            d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.4l2.7-2.6C16.9 2.8 14.6 2 12 2 6.9 2 2.8 6.3 2.8 11.6S6.9 21.2 12 21.2c6.9 0 9.2-4.9 9.2-7.4 0-.5-.1-.8-.1-1.2H12z"
                          />
                        </svg>
                      )}
                      Cadastrar com Google
                    </Button>

                    <StepNavigation
                      showPrev={false}
                      nextLabel="Continuar"
                      nextDisabled={
                        contactValidating.email ||
                        contactValidating.phoneNumber ||
                        !isRegisterStep1Valid
                      }
                      onBeforeNext={validateRegisterStep1}
                    />

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="text-sm text-primary hover:underline font-medium cursor-pointer"
                      >
                        Já tenho uma conta
                      </button>
                    </div>
                  </div>
                </StepCard>

                {/* STEP 2: COMPANY INFO */}
                <StepCard className="border-none shadow-none p-0 bg-transparent">
                  <div className="space-y-2">
                    <div className="grid gap-2">
                      <Label htmlFor="companyName">Nome da Empresa *</Label>
                      <div className="relative">
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={(e) => {
                            setCompanyName(e.target.value);
                            if (e.target.value.trim().length >= 2)
                              clearRegisterError("companyName");
                          }}
                          onBlur={() =>
                            setRegisterFieldError(
                              "companyName",
                              validateCompanyNameValue(companyName),
                            )
                          }
                          placeholder="Minha Empresa"
                          className={`pl-10 h-11 ${registerErrors.companyName ? "border-destructive" : ""}`}
                        />
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                      {registerErrors.companyName && (
                        <p className="text-sm text-destructive">
                          {registerErrors.companyName}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="niche">Nicho de Atuação</Label>
                      <Select
                        id="niche"
                        value={companyNiche}
                        onChange={(e) =>
                          setCompanyNiche(e.target.value as TenantNiche)
                        }
                      >
                        {(Object.keys(NICHE_LABELS) as TenantNiche[]).map(
                          (key) => (
                            <option key={key} value={key}>
                              {NICHE_LABELS[key]}
                            </option>
                          ),
                        )}
                      </Select>
                    </div>

                    <StepNavigation onBeforeNext={validateRegisterStep2} />
                  </div>
                </StepCard>

                {/* STEP 3: BRANDING */}
                <StepCard className="border-none shadow-none p-0 bg-transparent">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor="color">Cor da Marca</Label>
                      <div className="flex gap-3">
                        <Input
                          id="color"
                          type="color"
                          value={companyColor}
                          onChange={(e) => setCompanyColor(e.target.value)}
                          className="w-14 h-11 p-1 cursor-pointer rounded-lg"
                        />
                        <Input
                          value={companyColor}
                          onChange={(e) => setCompanyColor(e.target.value)}
                          className="font-mono flex-1 h-11"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="logo">Logo da Empresa (Opcional)</Label>
                      <div className="flex items-center gap-4 p-4 border border-dashed rounded-xl border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                        {companyLogo ? (
                          <div className="relative w-16 h-16 rounded-xl border border-border overflow-hidden bg-white">
                            <Image
                              src={companyLogo}
                              alt="Logo"
                              width={64}
                              height={64}
                              unoptimized
                              className="w-full h-full object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => setCompanyLogo("")}
                              className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl border border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <Input
                            id="logo"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="cursor-pointer text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Formatos aceitos: JPG, PNG. Max 2MB.
                          </p>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-destructive font-medium">
                        {error}
                      </p>
                    )}
                    {registerSuccessMessage && (
                      <p className="text-sm text-green-600 font-medium">
                        {registerSuccessMessage}
                      </p>
                    )}

                    {requiresPhoneVerification && (
                      <div className="mt-4 p-5 border border-border rounded-xl bg-muted/20 space-y-3">
                        <p className="text-sm font-semibold">
                          Confirmação de telefone por SMS
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Digite o código enviado por SMS para confirmar.
                        </p>
                        <Input
                          value={smsCode}
                          onChange={(e) => setSmsCode(e.target.value)}
                          placeholder="000000"
                          className="text-center tracking-widest font-mono text-lg"
                          maxLength={6}
                        />
                        <div className="flex gap-2 pt-2">
                          <Button
                            type="button"
                            onClick={handleConfirmPhoneCode}
                            disabled={isVerifyingSmsCode || !smsCode.trim()}
                            className="flex-1"
                          >
                            {isVerifyingSmsCode
                              ? "Confirmando..."
                              : "Confirmar"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleResendPhoneCode}
                            disabled={isSendingSms}
                          >
                            {isSendingSms ? "Enviando..." : "Reenviar"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {!isAwaitingPhoneVerification &&
                      !requiresPhoneVerification && (
                        <StepNavigation
                          onSubmit={handleRegister}
                          onBeforeNext={validateRegisterStep3}
                          isSubmitting={isRegistering}
                          submitLabel="Finalizar"
                        />
                      )}
                  </form>
                </StepCard>
              </StepWizard>
            </motion.div>
          ) : mode === "forgot" ? (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{
                opacity: 1,
                filter: "blur(0px)",
                transition: { duration: 0.5, delay: 0.2 },
              }}
              exit={{
                opacity: 0,
                filter: "blur(4px)",
                transition: { duration: 0.2 },
              }}
            >
              <div className="text-left mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                  Redefinir Senha
                </h1>
                <p className="text-muted-foreground mt-2">
                  Digite seu email cadastrado para receber o link de
                  recuperação.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                {resetSent ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 flex flex-col items-center text-center gap-3">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                    <h3 className="font-semibold text-green-600 text-lg">
                      Solicitação recebida!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Se o email estiver cadastrado, você receberá instruções
                      para redefinir sua senha. Verifique o spam.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 h-11"
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive font-medium">
                        {error}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-4">
                  {!resetSent && (
                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isResetting}
                    >
                      {isResetting ? (
                        <Loader size="sm" className="mr-2" />
                      ) : (
                        "Enviar Link de Redefinição"
                      )}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="w-full h-11"
                  >
                    Voltar para o Login
                  </Button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{
                opacity: 1,
                filter: "blur(0px)",
                transition: { duration: 0.5, delay: 0.2 },
              }}
              exit={{
                opacity: 0,
                filter: "blur(4px)",
                transition: { duration: 0.2 },
              }}
            >
              <div className="text-left mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Entrar</h1>
                <p className="text-muted-foreground mt-2">
                  Bem-vindo de volta! Insira suas credenciais.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <CredentialFields
                  email={email}
                  onEmailChange={setEmail}
                  password={password}
                  onPasswordChange={setPassword}
                  mode="login"
                  error={error}
                  errors={errors}
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                    }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer font-medium"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <div className="pt-2 flex flex-col gap-4">
                  <Button
                    type="submit"
                    className="w-full h-11 shadow-lg shadow-primary/20 text-md font-medium"
                    disabled={isLoggingIn || isGoogleLoading}
                  >
                    {isLoggingIn ? (
                      <Loader size="sm" className="mr-2" />
                    ) : (
                      "Entrar"
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-3 text-muted-foreground font-medium">
                        ou
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 font-medium"
                    onClick={handleGoogleAuth}
                    disabled={isGoogleLoading || isLoggingIn}
                  >
                    {isGoogleLoading ? (
                      <Loader size="sm" className="mr-2" />
                    ) : (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="w-4 h-4 mr-2"
                      >
                        <path
                          fill="#EA4335"
                          d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.4l2.7-2.6C16.9 2.8 14.6 2 12 2 6.9 2 2.8 6.3 2.8 11.6S6.9 21.2 12 21.2c6.9 0 9.2-4.9 9.2-7.4 0-.5-.1-.8-.1-1.2H12z"
                        />
                      </svg>
                    )}
                    Entrar com Google
                  </Button>

                  <div className="text-center text-sm text-muted-foreground mt-4">
                    Não tem uma conta?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setError("");
                      }}
                      className="text-primary hover:underline font-semibold transition-colors cursor-pointer"
                    >
                      Criar agora
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div id="recaptcha-container" className="hidden" />
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader size="lg" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
