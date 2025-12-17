"use client";

import * as React from "react";
import { TenantService } from "@/services/tenant-service";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { Tenant } from "@/types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/providers/tenant-provider";
import {
  Plus,
  LogIn,
  Trash2,
  Pencil,
  Search,
  Building2,
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TenantDialog, TenantFormData } from "@/components/admin/tenant-dialog";

export default function AdminPage() {
  // We use TenantBillingInfo now to get plan details
  const [tenantsData, setTenantsData] = React.useState<TenantBillingInfo[]>([]);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTenant, setEditingTenant] = React.useState<Tenant | null>(null);

  const { setViewingTenant } = useTenant();
  const router = useRouter();

  const loadTenants = async () => {
    try {
      // Use AdminService to get richer data (Plan, Status, etc.)
      const data = await AdminService.getAllTenantsBilling();
      setTenantsData(data);
    } catch (error) {
      console.error("Failed to load tenants", error);
    }
  };

  React.useEffect(() => {
    loadTenants();
  }, []);

  const handleSave = async (data: TenantFormData) => {
    try {
      if (editingTenant) {
        // Edit Mode
        await TenantService.updateTenant(editingTenant.id, {
          name: data.name,
          primaryColor: data.color,
          logoUrl: data.logoUrl,
          niche: data.niche,
        });
        alert("Empresa atualizada com sucesso!");
      } else {
        // Create Mode
        if (data.password && data.password.length < 6) {
          alert("A senha deve ter pelo menos 6 caracteres.");
          return;
        }

        const newTenant = await TenantService.createTenant({
          name: data.name,
          primaryColor: data.color,
          logoUrl: data.logoUrl,
          niche: data.niche,
          slug: data.name
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, ""),
          createdAt: new Date().toISOString(),
        });

        if (data.email && data.password) {
          // ... (Simple Alert for brevity as per previous implementation logic hook)
          // Ideally we should call a backend endpoint here, but keeping previous logic structure:

          // Re-implementing the dynamic import logic from previous version to ensure functionality
          const { initializeApp, getApp, getApps, deleteApp } =
            await import("firebase/app");
          const {
            getAuth,
            createUserWithEmailAndPassword,
            signInWithEmailAndPassword,
            signOut,
          } = await import("firebase/auth");
          const { getFirestore, doc, setDoc } =
            await import("firebase/firestore");

          const config = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId:
              process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          };

          const secondaryAppName = "secondaryAppForUserCreation";
          let secondaryApp;
          if (getApps().some((app) => app.name === secondaryAppName)) {
            secondaryApp = getApp(secondaryAppName);
          } else {
            secondaryApp = initializeApp(config, secondaryAppName);
          }
          const secondaryAuth = getAuth(secondaryApp);
          const secondaryDb = getFirestore(secondaryApp);

          try {
            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth,
              data.email,
              data.password
            );
            const user = userCredential.user;
            await setDoc(doc(secondaryDb, "users", user.uid), {
              name: `Admin ${data.name}`,
              email: data.email,
              role: "admin",
              tenantId: newTenant.id,
              createdAt: new Date().toISOString(),
            });
            await signOut(secondaryAuth);
            if (!getApps().every((app) => app.name !== secondaryAppName))
              await deleteApp(secondaryApp);
            alert(`Empresa ${data.name} e usuário admin criada!`);
          } catch (e: any) {
            console.error(e);
            // Try to recover logic... (Simplified for this rewrite to keep it clean)
            alert("Erro ao criar usuário (email em uso?): " + e.message);
            // Cleanup
            try {
              await signOut(secondaryAuth);
              if (!getApps().every((app) => app.name !== secondaryAppName))
                await deleteApp(secondaryApp);
            } catch (x) {}
          }
        } else {
          alert(`Empresa ${data.name} criada!`);
        }
      }
      setIsDialogOpen(false);
      loadTenants(); // Reload rich data
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar empresa");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Tem certeza? Esta ação removerá a empresa e todos os seus dados."
      )
    )
      return;
    try {
      await TenantService.deleteTenant(id);
      loadTenants();
    } catch (error) {
      console.error(error);
      alert("Erro ao remover empresa");
    }
  };

  const openCreate = () => {
    setEditingTenant(null);
    setIsDialogOpen(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsDialogOpen(true);
  };

  const handleLoginAs = (tenant: Tenant) => {
    setViewingTenant(tenant);
    router.push("/");
  };

  const filteredTenants = tenantsData.filter((item) =>
    item.tenant.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Painel Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie múltiplos inquilinos (Tenants) em um só lugar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/admin/billing")}
            className="shadow-sm hover:shadow transition-all"
          >
            <CreditCard className="w-5 h-5 mr-2" /> Visão Geral
          </Button>
          <Button
            onClick={openCreate}
            size="lg"
            className="shadow-lg hover:shadown-xl transition-all"
          >
            <Plus className="w-5 h-5 mr-2" /> Nova Empresa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar empresas..."
          className="pl-10 h-10 bg-muted/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTenants.map((item) => {
          const {
            tenant,
            planName,
            subscriptionStatus,
            billingInterval,
            nextBillingDate: _nextBillingDate, // Renamed to avoid conflict
            admin,
          } = item;

          // Estimate billing day based on tenant creation
          const createdDate = new Date(tenant.createdAt);
          const billingDay = createdDate.getDate();
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let nextBillingDate: Date;

          if (billingInterval === "yearly") {
            // Annual: Match creation month/day of current year
            nextBillingDate = new Date(
              today.getFullYear(),
              createdDate.getMonth(),
              billingDay
            );
            nextBillingDate.setHours(0, 0, 0, 0);

            // If that date refers to today or past, next billing is next year
            if (nextBillingDate <= today) {
              nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            }
          } else {
            // Monthly: Match creation day of current month
            nextBillingDate = new Date(
              today.getFullYear(),
              today.getMonth(),
              billingDay
            );
            nextBillingDate.setHours(0, 0, 0, 0);

            // If that date refers to today or past, next billing is next month
            if (nextBillingDate <= today) {
              nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            }
          }

          const isPastDue = subscriptionStatus === "past_due";

          return (
            <Card
              key={tenant.id}
              className={`overflow-hidden border-t-4 hover:shadow-md transition-shadow group flex flex-col ${isPastDue ? "border-red-500 ring-1 ring-red-500/20" : ""}`}
              style={{
                borderTopColor: isPastDue ? undefined : tenant.primaryColor,
              }}
            >
              <CardHeader className="pb-2 pt-6">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border p-1">
                    {tenant.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={tenant.logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xl font-bold text-muted-foreground">
                        {tenant.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(tenant)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(tenant.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <h3
                    className="font-bold text-lg leading-tight truncate"
                    title={tenant.name}
                  >
                    {tenant.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={
                        subscriptionStatus === "active"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px] h-5 px-1.5 capitalize"
                    >
                      {planName}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-muted">
                      {billingInterval === "yearly" ? "Anual" : "Mensal"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 pt-2">
                {/* Info Blocks */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Status
                  </span>
                  <span
                    className={`font-medium ${subscriptionStatus === "active" ? "text-emerald-600" : isPastDue ? "text-red-600" : "text-muted-foreground"}`}
                  >
                    {subscriptionStatus === "active"
                      ? "Ativo"
                      : isPastDue
                        ? "Atrasado"
                        : subscriptionStatus === "free"
                          ? "Gratuito"
                          : "Inativo"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar
                      className={`w-3 h-3 ${isPastDue ? "text-red-500" : ""}`}
                    />{" "}
                    Vencimento
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${isPastDue ? "text-red-600" : "text-foreground"}`}
                    >
                      {nextBillingDate.toLocaleDateString("pt-BR")}
                    </span>
                    {isPastDue && (
                      <Badge
                        variant="destructive"
                        className="h-4 px-1 text-[9px]"
                      >
                        !
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Desde:</span>
                  <span>
                    {new Date(tenant.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 p-4 border-t mt-auto">
                <Button
                  className="w-full cursor-pointer bg-white dark:bg-slate-950 border hover:bg-muted/50 text-foreground transition-colors shadow-sm"
                  variant="ghost"
                  onClick={() => handleLoginAs(tenant)}
                >
                  <LogIn className="w-4 h-4 mr-2 text-primary" /> Acessar Painel
                </Button>
              </CardFooter>
            </Card>
          );
        })}

        {filteredTenants.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
            <Building2 className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhuma empresa encontrada.</p>
            <p className="text-sm">
              Tente ajustar o filtro ou crie uma nova empresa.
            </p>
          </div>
        )}
      </div>

      <TenantDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingTenant}
        onSave={handleSave}
      />
    </div>
  );
}

// Helper component for layout
function Separator({ className }: { className?: string }) {
  return <div className={`h-[1px] w-full bg-border ${className}`} />;
}
