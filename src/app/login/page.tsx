"use client";

import * as React from "react";
import { Suspense } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { TenantNiche, NICHE_LABELS } from "@/types";

function LoginContent() {
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
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [mode, setMode] = React.useState<"login" | "register">("login");

  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get redirect URL from query params
  const redirectUrl = searchParams.get("redirect");

  // If already logged in, redirect
  React.useEffect(() => {
    if (!isLoading && user) {
      handleRedirectAfterAuth();
    }
  }, [user, isLoading]);

  const handleRedirectAfterAuth = () => {
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
      router.replace("/dashboard");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);

    const success = await login(email, password);
    if (!success) {
      setError("Falha no login. Verifique suas credenciais.");
      setIsLoggingIn(false);
    }
    // Redirect handled by useEffect when user state updates
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 300 * 1024) {
        setError("O logo deve ter no máximo 300KB.");
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Generate slug from company name
      const slug = companyName
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");

      // Create tenant document first
      const tenantId = `tenant_${firebaseUser.uid}`;
      await setDoc(doc(db, "tenants", tenantId), {
        name: companyName.trim(),
        slug: slug,
        primaryColor: companyColor,
        logoUrl: companyLogo || "",
        niche: companyNiche,
        createdAt: new Date().toISOString(),
      });

      // Create user document in Firestore with role 'free' and tenant reference
      await setDoc(doc(db, "users", firebaseUser.uid), {
        name: name.trim(),
        email: email,
        role: "free",
        tenantId: tenantId,
        createdAt: new Date().toISOString(),
      });

      // The auth state change will trigger the redirect via useEffect
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

  // Show loading during initial auth check or during login/redirect
  if (isLoading || isLoggingIn || isRegistering || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
          <p className="text-neutral-400 text-sm animate-pulse">
            {isLoggingIn ? "Entrando..." : isRegistering ? "Criando sua conta..." : "Carregando..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <Card className={`w-full bg-neutral-900 border-neutral-800 ${mode === "register" ? "max-w-lg" : "max-w-md"}`}>
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm mb-4 justify-center">
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
              <>
                {/* User Info Section */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-neutral-300 border-b border-neutral-700 pb-2">Dados Pessoais</p>
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-neutral-300">Seu Nome</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>
                </div>

                {/* Company Info Section */}
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-neutral-300 border-b border-neutral-700 pb-2">Dados da Empresa</p>

                  <div className="grid gap-2">
                    <Label htmlFor="companyName" className="text-neutral-300">Nome da Empresa</Label>
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Minha Empresa"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      className="bg-neutral-800 border-neutral-700 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="niche" className="text-neutral-300">Nicho</Label>
                      <Select
                        id="niche"
                        value={companyNiche}
                        onChange={(e) => setCompanyNiche(e.target.value as TenantNiche)}
                        className="bg-neutral-800 border-neutral-700 text-white"
                      >
                        {(Object.keys(NICHE_LABELS) as TenantNiche[]).map((key) => (
                          <option key={key} value={key}>
                            {NICHE_LABELS[key]}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="color" className="text-neutral-300">Cor da Marca</Label>
                      <div className="flex gap-2">
                        <Input
                          id="color"
                          type="color"
                          value={companyColor}
                          onChange={(e) => setCompanyColor(e.target.value)}
                          className="w-12 h-10 p-1 cursor-pointer bg-neutral-800 border-neutral-700"
                        />
                        <Input
                          value={companyColor}
                          onChange={(e) => setCompanyColor(e.target.value)}
                          className="font-mono bg-neutral-800 border-neutral-700 text-white flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="logo" className="text-neutral-300">Logo da Empresa</Label>
                    <div className="flex items-center gap-3">
                      {companyLogo ? (
                        <div className="relative w-14 h-14 rounded-lg border border-neutral-700 overflow-hidden bg-neutral-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={companyLogo}
                            alt="Logo preview"
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setCompanyLogo("")}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-400"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg border-2 border-dashed border-neutral-700 flex items-center justify-center bg-neutral-800/50">
                          <Upload className="w-5 h-5 text-neutral-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="cursor-pointer bg-neutral-800 border-neutral-700 text-white"
                        />
                        <p className="text-xs text-neutral-500 mt-1">PNG, JPG ou SVG. Máx 300KB.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-700 pt-3"></div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email" className="text-neutral-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-neutral-300">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            )}
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
                    onClick={() => { setMode("register"); setError(""); }}
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
                    onClick={() => { setMode("login"); setError(""); }}
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
