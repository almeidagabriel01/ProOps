"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { User } from "@/types";
import {
  createUserWithEmailAndPassword,
  linkWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { callPublicApi } from "@/lib/api-client";
import { ALLOWED_TYPES } from "@/services/storage-service";
import { TenantNiche } from "@/types";

type AuthMode = "login" | "register" | "forgot";
const AUTH_MODES: AuthMode[] = ["login", "register", "forgot"];

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
  isSendingSms: boolean;
  isVerifyingSmsCode: boolean;

  // Handlers
  handleLogin: (e?: React.FormEvent) => Promise<void>;
  handleRegister: (e?: React.FormEvent) => Promise<void>;
  handleForgotPassword: (e?: React.FormEvent) => Promise<void>;
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
  const [isSendingSms, setIsSendingSms] = React.useState(false);
  const [isVerifyingSmsCode, setIsVerifyingSmsCode] = React.useState(false);
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
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
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
      const { sendPasswordResetEmail } = await import("firebase/auth");
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
    } catch (err: unknown) {
      console.warn("Password reset request finished with non-fatal error", err);
    } finally {
      setResetSent(true);
      setError("");
      setIsResetting(false);
    }
  };
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const modeParam = searchParams.get("mode");
  const mode: AuthMode =
    pathname === "/register"
      ? "register"
      : pathname === "/forgot-password"
        ? "forgot"
        : AUTH_MODES.includes(modeParam as AuthMode)
          ? (modeParam as AuthMode)
          : "login";

  const setMode = React.useCallback(
    (value: AuthMode) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === "register") {
        params.delete("mode");
        const query = params.toString();
        router.replace(query ? `/register?${query}` : "/register", {
          scroll: false,
        });
        return;
      }

      if (value === "forgot") {
        params.delete("mode");
        const query = params.toString();
        router.replace(
          query ? `/forgot-password?${query}` : "/forgot-password",
          { scroll: false },
        );
        return;
      }

      if (value === "login") {
        params.delete("mode");
      }

      const query = params.toString();
      router.replace(query ? `/login?${query}` : "/login", { scroll: false });
    },
    [router, searchParams],
  );

  // Get redirect URL from query params
  const redirectUrl = searchParams.get("redirect");

  const buildEmailPendingPath = React.useCallback(() => {
    const params = new URLSearchParams();

    if (redirectUrl) {
      params.set("redirect", redirectUrl);
    }

    const query = params.toString();
    return query
      ? `/email-verification-pending?${query}`
      : "/email-verification-pending";
  }, [redirectUrl]);

  const handleRedirectAfterAuth = React.useCallback(() => {
    const currentUser = auth.currentUser;
    if (currentUser && !currentUser.emailVerified) {
      router.replace(buildEmailPendingPath());
      return;
    }

    // If there's a redirect URL, go there
    if (redirectUrl) {
      const target = decodeURIComponent(redirectUrl);
      router.replace(target);
      return;
    }

    // Default redirects based on role
    if (user?.role === "superadmin") {
      router.replace("/admin");
    } else if (user?.role === "free") {
      router.replace("/");
    } else {
      const perms = user?.permissions || {};
      const userRole = user?.role;
      const isAdmin = ["admin", "superadmin", "MASTER"].includes(
        userRole || "",
      );

      const canViewDashboard = isAdmin || perms["dashboard"]?.canView === true;

      if (canViewDashboard) {
        router.replace("/dashboard");
      } else {
        const pages = [
          "kanban",
          "proposals",
          "clients",
          "products",
          "services",
          "spreadsheets",
          "transactions",
          "wallet",
          "financial", // fallback for older perms
          "profile",
        ];

        const routeMap: Record<string, string> = {
          kanban: "/kanban",
          proposals: "/proposals",
          clients: "/contacts",
          products: "/products",
          services: "/services",
          spreadsheets: "/spreadsheets",
          transactions: "/financial",
          wallet: "/wallets",
          financial: "/financial",
          profile: "/profile",
        };

        const firstAllowed = pages.find(
          (page) => perms[page]?.canView === true || page === "profile",
        );

        if (firstAllowed && routeMap[firstAllowed]) {
          router.replace(routeMap[firstAllowed]);
        } else {
          router.replace("/403");
        }
      }
    }
  }, [buildEmailPendingPath, redirectUrl, router, user]);

  // If already logged in, redirect
  React.useEffect(() => {
    if (!isLoading && user) {
      handleRedirectAfterAuth();
    }
  }, [user, isLoading, handleRedirectAfterAuth]);

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

    const result = await login(email, password);
    if (!result.success) {
      if (result.code === "email-not-verified") {
        setError(
          "Seu email ainda não foi confirmado. Enviamos um novo link de verificação.",
        );
      } else {
        setError("Falha no login. Verifique suas credenciais.");
      }
      setIsLoggingIn(false);
    }
  };

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
      const contactValidation = await callPublicApi<ContactValidationResponse>(
        "v1/validation/contact",
        "POST",
        {
          email,
          phoneNumber: phoneNumber || undefined,
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
      await setDoc(doc(db, "tenants", tenantId), {
        name: companyName.trim(),
        slug: slug,
        primaryColor: companyColor,
        logoUrl: companyLogo || "",
        niche: companyNiche,
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, "users", firebaseUser.uid), {
        name: name.trim(),
        email: email,
        role: "free",
        tenantId: tenantId,
        createdAt: new Date().toISOString(),
      });

      const emailPendingPath = buildEmailPendingPath();

      await sendEmailVerification(firebaseUser, {
        url: `${window.location.origin}${emailPendingPath}`,
      });

      setIsRegistering(false);
      router.replace(emailPendingPath);
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
    isSendingSms,
    isVerifyingSmsCode,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogoUpload,
    handleConfirmPhoneCode,
    handleResendPhoneCode,
    resetSent,
    isResetting,
  };
}
