"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <Card
        className={`w-full bg-neutral-900 border-neutral-800 ${mode === "register" ? "max-w-lg" : "max-w-md"}`}
      >
        <CardHeader className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm mb-4 justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a home
          </Link>
          <CardTitle className="text-2xl text-white">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </CardTitle>
          <CardDescription className="text-neutral-400">
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
              className="w-full bg-violet-600 hover:bg-violet-500 text-white"
              disabled={isLoggingIn || isRegistering}
            >
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
            <div className="text-center text-sm text-neutral-400">
              {mode === "login" ? (
                <>
                  Não tem uma conta?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                    className="text-violet-400 hover:text-violet-300 font-medium"
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
                    className="text-violet-400 hover:text-violet-300 font-medium"
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
