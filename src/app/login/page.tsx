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
import { Loader2, ArrowLeft, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { AdminSkeleton } from "@/app/admin/_components/admin-skeleton";
import { ProductsSkeleton } from "@/app/products/_components/products-skeleton";
import { ProposalsSkeleton } from "@/app/proposals/_components/proposals-skeleton";
import { CustomersSkeleton } from "@/app/customers/_components/customers-skeleton";
import { useLoginForm } from "./_hooks/useLoginForm";
import {
  RegisterFormFields,
  CredentialFields,
} from "./_components/form-fields";

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
    isLoggingIn,
    isRegistering,
    mode,
    setMode,
    isLoading,
    user,
    handleLogin,
    handleRegister,
    handleLogoUpload,
  } = useLoginForm();

  // Show loading during initial auth check or during login/redirect
  // Show loading during initial auth check or during login/redirect
  if (isLoading || isLoggingIn || isRegistering || user) {
    // Determine which skeleton to show based on likely destination
    let content = <DashboardSkeleton />;
    let showSidebar = true;

    if (user?.role === 'superadmin') {
      content = <AdminSkeleton />;
      showSidebar = false;
    } else if (user?.role === 'free' || user?.role === 'user' || user?.role === 'member') {
      const perms = user.permissions || {};
      if (perms.dashboard && perms.dashboard.canView === false) {
        if (perms.proposals?.canView) content = <ProposalsSkeleton />;
        else if (perms.products?.canView) content = <ProductsSkeleton />;
        else if (perms.clients?.canView) content = <CustomersSkeleton />;
        else content = <ProposalsSkeleton />;
      }
    }

    return (
      <AppSkeleton showSidebar={showSidebar}>
        {content}
      </AppSkeleton>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative transition-colors duration-300">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <Card
        className={`w-full bg-card border-border ${mode === "register" ? "max-w-lg" : "max-w-md"} shadow-xl`}
      >
        <CardHeader className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4 justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a home
          </Link>
          <CardTitle className="text-2xl text-foreground">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === "login"
              ? "Entre com suas credenciais de acesso"
              : "Preencha os dados para criar sua conta e empresa"}
          </CardDescription>
        </CardHeader>

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
          <CardContent className="space-y-4">
            {mode === "register" && (
              <RegisterFormFields
                name={name}
                onNameChange={setName}
                companyName={companyName}
                onCompanyNameChange={setCompanyName}
                companyNiche={companyNiche}
                onCompanyNicheChange={setCompanyNiche}
                companyColor={companyColor}
                onCompanyColorChange={setCompanyColor}
                companyLogo={companyLogo}
                onCompanyLogoChange={setCompanyLogo}
                onLogoUpload={handleLogoUpload}
              />
            )}

            <CredentialFields
              email={email}
              onEmailChange={setEmail}
              password={password}
              onPasswordChange={setPassword}
              mode={mode}
              error={error}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              disabled={isLoggingIn || isRegistering}
            >
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  Não tem uma conta?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  Já tem uma conta?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Fazer login
                  </button>
                </>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
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
