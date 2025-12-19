"use client";

import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  ArrowLeft,
  Sun,
  Moon,
  User as UserIcon,
  Building2,
  Upload,
  CheckCircle,
  Mail,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { AdminSkeleton } from "@/app/admin/_components/admin-skeleton";
import { ProductsSkeleton } from "@/app/products/_components/products-skeleton";
import { ProposalsSkeleton } from "@/app/proposals/_components/proposals-skeleton";
import { CustomersSkeleton } from "@/app/customers/_components/customers-skeleton";
import { useLoginForm } from "./_hooks/useLoginForm";
import { CredentialFields } from "./_components/form-fields";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import {
  StepWizard,
  StepCard,
  StepNavigation,
} from "@/components/ui/step-wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NICHE_LABELS, TenantNiche } from "@/types";

function LoginContent() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
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
    errors, // New
    isLoggingIn,
    isRegistering,
    mode,
    setMode,
    isLoading,
    user,
    resetSent,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogoUpload,
  } = useLoginForm();

  // Estado para erros de validação do cadastro
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>(
    {}
  );

  // Validação do Step 1 do cadastro
  const validateRegisterStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!name || name.trim().length < 2) {
      newErrors.name = "Nome deve ter pelo menos 2 caracteres";
      isValid = false;
    }

    if (!email || !email.trim()) {
      newErrors.email = "Email é obrigatório";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email inválido";
      isValid = false;
    }

    if (!password || password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
      isValid = false;
    }

    setRegisterErrors(newErrors);
    return isValid;
  };

  // Validação do Step 2 do cadastro
  const validateRegisterStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!companyName || companyName.trim().length < 2) {
      newErrors.companyName = "Nome da empresa é obrigatório";
      isValid = false;
    }

    setRegisterErrors(newErrors);
    return isValid;
  };

  // Limpar erros quando valores mudam
  useEffect(() => {
    if (name && name.trim().length >= 2 && registerErrors.name) {
      setRegisterErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.name;
        return newErrors;
      });
    }
  }, [name]);

  useEffect(() => {
    if (
      email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      registerErrors.email
    ) {
      setRegisterErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  }, [email]);

  useEffect(() => {
    if (password && password.length >= 6 && registerErrors.password) {
      setRegisterErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    }
  }, [password]);

  useEffect(() => {
    if (
      companyName &&
      companyName.trim().length >= 2 &&
      registerErrors.companyName
    ) {
      setRegisterErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.companyName;
        return newErrors;
      });
    }
  }, [companyName]);

  // Show skeleton loading during initial auth check or page load
  if ((isLoading && !isLoggingIn && !isRegistering) || user) {
    // Determine which skeleton to show based on likely destination
    let content = <DashboardSkeleton />;
    let showSidebar = true;

    if (user?.role === "superadmin") {
      content = <AdminSkeleton />;
      showSidebar = false;
    } else if (
      user?.role === "free" ||
      user?.role === "user" ||
      user?.role === "member"
    ) {
      const perms = user.permissions || {};
      if (perms.dashboard && perms.dashboard.canView === false) {
        if (perms.proposals?.canView) content = <ProposalsSkeleton />;
        else if (perms.products?.canView) content = <ProductsSkeleton />;
        else if (perms.clients?.canView) content = <CustomersSkeleton />;
        else content = <ProposalsSkeleton />;
      }
    }

    return <AppSkeleton showSidebar={showSidebar}>{content}</AppSkeleton>;
  }

  const steps = [
    {
      id: "account",
      title: "Conta",
      description: "Seus dados de acesso",
      icon: UserIcon,
    },
    {
      id: "company",
      title: "Empresa",
      description: "Dados da organização",
      icon: Building2,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative transition-colors duration-300">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div
        className={`w-full ${mode === "register" ? "max-w-xl" : "max-w-md"}`}
      >
        {/* Back Link */}
        <div className="flex justify-center mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a home
          </Link>
        </div>

        {mode === "register" ? (
          // ======================= REGISTER MODE (WIZARD) =======================
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight">
                Criar nova conta
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure seu acesso e sua empresa
              </p>
            </div>

            <StepWizard
              steps={steps}
              onComplete={() => {}}
              indicatorContainerClassName="max-w-xs w-full"
            >
              {/* STEP 1: ACCOUNT INFO */}
              <StepCard>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="reg-name"
                      className="flex items-center gap-1"
                    >
                      Seu Nome <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="reg-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome completo"
                        className={`pl-9 ${registerErrors.name ? "border-destructive" : ""}`}
                      />
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {registerErrors.name && (
                      <p className="text-sm text-destructive">
                        {registerErrors.name}
                      </p>
                    )}
                  </div>
                  <CredentialFields
                    email={email}
                    onEmailChange={setEmail}
                    password={password}
                    onPasswordChange={setPassword}
                    mode="register"
                    error={error}
                    errors={registerErrors}
                  />
                  <StepNavigation
                    showPrev={false}
                    nextLabel="Continuar"
                    onBeforeNext={validateRegisterStep1}
                  />
                  <div className="text-center pt-4">
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-sm text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                    >
                      Já tenho uma conta
                    </button>
                  </div>
                </div>
              </StepCard>

              {/* STEP 2: COMPANY INFO */}
              <StepCard>
                <div className="space-y-4">
                  <form onSubmit={handleRegister}>
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label
                          htmlFor="companyName"
                          className="flex items-center gap-1"
                        >
                          Nome da Empresa{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Minha Empresa"
                            className={`pl-9 ${registerErrors.companyName ? "border-destructive" : ""}`}
                          />
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                        {registerErrors.companyName && (
                          <p className="text-sm text-destructive">
                            {registerErrors.companyName}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="niche">Nicho</Label>
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
                              )
                            )}
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="color">Cor da Marca</Label>
                          <div className="flex gap-2">
                            <Input
                              id="color"
                              type="color"
                              value={companyColor}
                              onChange={(e) => setCompanyColor(e.target.value)}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={companyColor}
                              onChange={(e) => setCompanyColor(e.target.value)}
                              className="font-mono flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="logo">Logo da Empresa</Label>
                        <div className="flex items-center gap-3">
                          {companyLogo ? (
                            <div className="relative w-14 h-14 rounded-lg border border-border overflow-hidden bg-muted/30">
                              <img
                                src={companyLogo}
                                alt="Logo preview"
                                className="w-full h-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => setCompanyLogo("")}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center hover:bg-destructive/90 cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                              <Upload className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1">
                            <Input
                              id="logo"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="cursor-pointer"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Max 2MB.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-destructive font-medium mt-2">
                        {error}
                      </p>
                    )}

                    <StepNavigation
                      onSubmit={handleRegister}
                      isSubmitting={isRegistering}
                      submitLabel="Criar Conta"
                    />
                  </form>
                </div>
              </StepCard>
            </StepWizard>
          </div>
        ) : mode === "forgot" ? (
          // ======================= FORGOT PASSWORD MODE =======================
          <Card className="shadow-xl border-border bg-card">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
              <CardDescription>
                Digite seu email para receber o link de redefinição.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-4">
                {resetSent ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex flex-col items-center text-center gap-2 animate-in fade-in zoom-in-95">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                    <h3 className="font-semibold text-green-600">
                      Email Enviado!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Verifique sua caixa de entrada (e spam) para redefinir sua
                      senha.
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
                        className="pl-9"
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
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                {!resetSent && (
                  <Button type="submit" className="w-full">
                    Enviar Link de Redefinição
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className="w-full"
                >
                  Voltar para o Login
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : (
          // ======================= LOGIN MODE =======================
          <Card className="shadow-xl border-border bg-card">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Entrar</CardTitle>
              <CardDescription>
                Entre com suas credenciais de acesso
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
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
                    className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Não tem uma conta?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                    className="text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                  >
                    Criar conta
                  </button>
                </div>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-3 rounded-full bg-card hover:bg-muted border border-border shadow-lg transition-all duration-300 cursor-pointer text-foreground"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-950">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
