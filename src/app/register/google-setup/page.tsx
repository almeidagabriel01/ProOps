"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { deleteUser, onAuthStateChanged, signOut } from "firebase/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  StepCard,
  StepNavigation,
  StepWizard,
} from "@/components/ui/step-wizard";
import { ALLOWED_TYPES } from "@/services/storage-service";
import { NICHE_LABELS, TenantNiche } from "@/types";
import { ArrowLeft, Building2, Loader2, Palette, Upload } from "lucide-react";
import { AuthLayout } from "@/app/login/_components/auth-layout";
import { motion } from "framer-motion";
import Image from "next/image";

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
    if (redirectParam) params.set("redirect", redirectParam);
    if (redirectReason) params.set("redirect_reason", redirectReason);
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
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
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

  const clearStepError = useCallback((field: string) => {
    setStepErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validateCompanyStep = useCallback(() => {
    const nextErrors: Record<string, string> = {};

    if (!companyName.trim() || companyName.trim().length < 2) {
      nextErrors.companyName = "Nome da empresa e obrigatorio";
    }

    setStepErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [companyName]);

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
      if (errorCode === "auth/requires-recent-login") {
        await signOut(auth);
      } else {
        console.error(
          "Failed to delete provisional Google account:",
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
    <AuthLayout>
      <div className="w-full">
        <div className="flex justify-start mb-8">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          <div className="text-left mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Quase la!</h1>
            <p className="text-muted-foreground mt-2">
              Falta so definir os dados da sua organizacao para continuar.
            </p>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
              {userName ? userName[0].toUpperCase() : "U"}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {userName || "Usuario Google"}
              </p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>

          <StepWizard
            steps={[
              { id: "company", title: "Empresa", icon: Building2 },
              { id: "brand", title: "Marca", icon: Palette },
            ]}
            indicatorContainerClassName="mx-auto mb-2 w-full max-w-[240px]"
          >
            <StepCard className="border-none shadow-none p-0 bg-transparent">
              <div className="space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Nome da Empresa *</Label>
                  <div className="relative">
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (e.target.value.trim().length >= 2) {
                          clearStepError("companyName");
                        }
                      }}
                      placeholder="Sua Empresa"
                      className={`pl-10 h-11 ${stepErrors.companyName ? "border-destructive" : ""}`}
                    />
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {stepErrors.companyName && (
                    <p className="text-sm text-destructive">
                      {stepErrors.companyName}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="niche">Nicho de Atuacao</Label>
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

                {error && (
                  <p className="text-sm text-destructive font-medium">{error}</p>
                )}

                <StepNavigation
                  showPrev={false}
                  nextLabel="Continuar"
                  onBeforeNext={validateCompanyStep}
                />
              </div>
            </StepCard>

            <StepCard className="border-none shadow-none p-0 bg-transparent">
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="color">Cor Principal</Label>
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
                  <Label htmlFor="logo">Logo da Empresa</Label>
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
                          x
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
                        Max 2MB. JPG, PNG, WEBP.
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive font-medium">{error}</p>
                )}

                <StepNavigation
                  onSubmit={handleSubmit}
                  onBeforeNext={validateCompanyStep}
                  isSubmitting={isSubmitting}
                  submitDisabled={!canSubmit}
                  submitLabel="Concluir Configuracao"
                />
              </div>
            </StepCard>
          </StepWizard>
        </motion.div>
      </div>
    </AuthLayout>
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
