"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { deleteUser, onAuthStateChanged, signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { ALLOWED_TYPES } from "@/services/storage-service";
import { NICHE_LABELS, TenantNiche } from "@/types";
import { ArrowLeft, Building2, Loader2, Upload } from "lucide-react";

function GoogleSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirectReason = searchParams.get("redirect_reason");
  const selectedPlan = searchParams.get("plan");
  const selectedInterval = searchParams.get("interval") || "monthly";

  const resolveRedirectTarget = useCallback(() => {
    if (redirectParam) {
      try {
        return decodeURIComponent(redirectParam);
      } catch {
        return redirectParam;
      }
    }

    if (selectedPlan) {
      return `/subscribe?plan=${encodeURIComponent(selectedPlan)}&interval=${encodeURIComponent(selectedInterval)}`;
    }

    return "/";
  }, [redirectParam, selectedPlan, selectedInterval]);

  const getLoginTarget = useCallback(() => {
    const params = new URLSearchParams();
    if (redirectParam) {
      params.set("redirect", redirectParam);
    }
    if (redirectReason) {
      params.set("redirect_reason", redirectReason);
    }
    if (selectedPlan) {
      params.set("plan", selectedPlan);
      params.set("interval", selectedInterval);
    }
    const query = params.toString();
    return query ? `/login?${query}` : "/login";
  }, [redirectParam, redirectReason, selectedPlan, selectedInterval]);

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyColor, setCompanyColor] = useState("#8b5cf6");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyNiche, setCompanyNiche] = useState<TenantNiche>(
    "automacao_residencial",
  );

  const canSubmit = useMemo(
    () => companyName.trim().length >= 2,
    [companyName],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          router.replace(getLoginTarget());
          return;
        }

        const isGoogleAccount = firebaseUser.providerData.some(
          (provider) => provider.providerId === "google.com",
        );

        if (!isGoogleAccount) {
          router.replace("/register");
          return;
        }

        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data?.tenantId && data.tenantId !== "default-tenant") {
            router.replace(resolveRedirectTarget());
            return;
          }
        }

        setUserEmail(firebaseUser.email || "");
        setUserName(firebaseUser.displayName || "");
      } catch (checkError) {
        console.error("Failed to validate Google setup state:", checkError);
        setError("Nao foi possivel validar sua conta Google. Tente novamente.");
      } finally {
        setIsCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [getLoginTarget, resolveRedirectTarget, router]);

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(
          "O arquivo deve ser uma imagem valida (JPEG, PNG, GIF, WebP ou SVG).",
        );
        e.target.value = "";
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setError("O logo deve ter no maximo 2MB.");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setCompanyLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    setError("");

    if (!canSubmit) {
      setError("Informe o nome da empresa.");
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setError("Sua sessao expirou. Entre novamente com Google.");
      router.replace(getLoginTarget());
      return;
    }

    setIsSubmitting(true);

    try {
      const tenantId = `tenant_${firebaseUser.uid}`;
      const slug = companyName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");

      const tenantRef = doc(db, "tenants", tenantId);
      const tenantSnap = await getDoc(tenantRef);

      if (!tenantSnap.exists()) {
        await setDoc(tenantRef, {
          tenantId,
          name: companyName.trim(),
          slug,
          primaryColor: companyColor,
          logoUrl: companyLogo || "",
          niche: companyNiche,
          createdAt: new Date().toISOString(),
        });
      }

      await setDoc(
        doc(db, "users", firebaseUser.uid),
        {
          name:
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            "Usuario",
          email: firebaseUser.email || "",
          photoUrl: firebaseUser.photoURL || undefined,
          role: "free",
          tenantId,
          companyId: tenantId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      const target = resolveRedirectTarget();
      if (redirectReason === "session_expired") {
        window.location.replace(target);
      } else {
        router.replace(target);
      }
    } catch (submitError) {
      console.error("Failed to complete Google setup:", submitError);
      setError("Nao foi possivel finalizar a configuracao da empresa.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    companyColor,
    companyLogo,
    companyName,
    companyNiche,
    getLoginTarget,
    redirectReason,
    resolveRedirectTarget,
    router,
  ]);

  const handleBackToLogin = useCallback(async () => {
    const currentUser = auth.currentUser;

    try {
      if (currentUser) {
        await deleteUser(currentUser);
      }
    } catch (signOutError) {
      const errorCode = (signOutError as { code?: string })?.code;

      // Fallback to signOut when account deletion is temporarily blocked.
      if (errorCode === "auth/requires-recent-login") {
        await signOut(auth);
      } else {
        console.error(
          "Failed to delete provisional Google account from setup page:",
          signOutError,
        );
        await signOut(auth);
      }
    } finally {
      router.replace(getLoginTarget());
    }
  }, [getLoginTarget, router]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50">
        <AnimatedThemeToggler className="p-3 rounded-full bg-card hover:bg-muted border border-border shadow-lg transition-all duration-300 text-foreground" />
      </div>

      <div className="w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </button>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Terminar de configurar empresa
          </h1>
          <p className="text-muted-foreground">
            Falta so definir os dados da sua organizacao para continuar.
          </p>
        </div>

        <Card className="shadow-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Conta Google conectada</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>{userName || "Usuario Google"}</p>
            <p>{userEmail}</p>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Dados da organizacao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName" className="flex items-center gap-1">
                Nome da Empresa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Minha Empresa"
              />
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
                  {(Object.keys(NICHE_LABELS) as TenantNiche[]).map((key) => (
                    <option key={key} value={key}>
                      {NICHE_LABELS[key]}
                    </option>
                  ))}
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      x
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
                  <p className="text-xs text-muted-foreground mt-1">Max 2MB.</p>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                "Finalizar Configuracao"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function GoogleSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }
    >
      <GoogleSetupContent />
    </Suspense>
  );
}
