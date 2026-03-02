"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { User } from "@/types";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

  // Handlers
  handleLogin: (e?: React.FormEvent) => Promise<void>;
  handleRegister: (e?: React.FormEvent) => Promise<void>;
  handleForgotPassword: (e?: React.FormEvent) => Promise<void>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

  const handleRedirectAfterAuth = React.useCallback(() => {
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
  }, [redirectUrl, router, user]);

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

    const success = await login(email, password);
    if (!success) {
      setError("Falha no login. Verifique suas credenciais.");
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

      // Small delay to ensure Firestore writes propagate before calling profile logic
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (phoneNumber && phoneNumber.trim().length > 0) {
        try {
          const { UserService } = await import("@/services/user-service");
          await UserService.updateProfile({ phoneNumber });
        } catch (err) {
          console.error(
            "Failed to update phone number index on registration:",
            err,
          );
        }
      }
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
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogoUpload,
    resetSent,
    isResetting,
  };
}
