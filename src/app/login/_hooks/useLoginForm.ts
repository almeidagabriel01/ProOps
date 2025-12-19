"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { TenantNiche } from "@/types";

type AuthMode = "login" | "register" | "forgot";

interface UseLoginFormReturn {
  // Login fields
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;

  // Register fields - User
  name: string;
  setName: (value: string) => void;

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
  resetSent: boolean;
  user: any;

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

  // Register fields - Company/Tenant
  const [companyName, setCompanyName] = React.useState("");
  const [companyColor, setCompanyColor] = React.useState("#8b5cf6");
  const [companyLogo, setCompanyLogo] = React.useState("");
  const [companyNiche, setCompanyNiche] = React.useState<TenantNiche>("automacao_residencial");



  const [error, setError] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({}); // New: specific field errors
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isRegistering, setIsRegistering] = React.useState(false);
  type AuthMode = "login" | "register" | "forgot";

  // ... (inside function)
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [resetSent, setResetSent] = React.useState(false);

  const handleForgotPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) {
      setError("Digite seu email para redefinir a senha.");
      return;
    }
    
    try {
        const { sendPasswordResetEmail } = await import("firebase/auth");
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
        setError("");
    } catch (err: any) {
        console.error("Reset password error:", err);
        setError("Erro ao enviar email. Verifique se o email está correto.");
    }
  };
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get redirect URL from query params
  const redirectUrl = searchParams.get("redirect");

  const handleRedirectAfterAuth = React.useCallback(() => {
    // If there's a redirect URL, go there
    if (redirectUrl) {
      router.replace(decodeURIComponent(redirectUrl));
      return;
    }

    // Default redirects based on role
    if (user?.role === "superadmin") {
      router.replace("/admin");
    } else if (user?.role === "free") {
      router.replace("/");
    } else {
      const perms = (user as any)?.permissions || {};
      const userRole = (user as any)?.role;
      const isAdmin = ["admin", "superadmin", "MASTER"].includes(userRole);

      const canViewDashboard = isAdmin || perms["dashboard"]?.canView === true;

      if (canViewDashboard) {
        router.replace("/dashboard");
      } else {
        const pages = ["proposals", "clients", "products", "financial", "profile"];
        const firstAllowed = pages.find(page => perms[page]?.canView === true || page === "profile");

        if (firstAllowed) {
          router.replace(`/${firstAllowed}`);
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

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!name.trim()) {
      setError("Por favor, informe seu nome.");
      return;
    }

    if (!companyName.trim()) {
      setError("Por favor, informe o nome da empresa.");
      return;
    }

    setIsRegistering(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Este email já está cadastrado. Tente fazer login.");
        setMode("login");
      } else if (err.code === "auth/weak-password") {
        setError("A senha é muito fraca. Use pelo menos 6 caracteres.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
      setIsRegistering(false);
    }
  };

  return {
    email, setEmail,
    password, setPassword,
    name, setName,
    companyName, setCompanyName,
    companyColor, setCompanyColor,
    companyLogo, setCompanyLogo,
    companyNiche, setCompanyNiche,
    error, setError,
    errors, setErrors,
    isLoggingIn,
    isRegistering,
    mode, setMode,
    isLoading,
    user,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogoUpload,
    resetSent,
  };
}
