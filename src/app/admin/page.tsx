"use client";

import * as React from "react";
import { TenantService } from "@/services/tenant-service";
import { Tenant } from "@/lib/mock-db"; // Keep using Tenant type for now
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/providers/tenant-provider";
import { Plus, LogIn, Trash2, Pencil, Search, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { TenantDialog, TenantFormData } from "@/components/admin/tenant-dialog";

export default function AdminPage() {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTenant, setEditingTenant] = React.useState<Tenant | null>(null);

  const { setViewingTenant } = useTenant();
  const router = useRouter();

  const loadTenants = async () => {
    try {
      const data = await TenantService.getTenants();
      setTenants(data);
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
        });
        alert("Empresa atualizada com sucesso!");
      } else {
        // Create Mode

        // Validation: Check password length before creating anything
        if (data.password && data.password.length < 6) {
          alert("A senha deve ter pelo menos 6 caracteres.");
          return;
        }

        // Generate a slug-like ID if needed, or let Firestore ID act as primary.
        // Assuming Service handles ID, but we might want to store a slug.
        const newTenant = await TenantService.createTenant({
          name: data.name,
          primaryColor: data.color,
          logoUrl: data.logoUrl,
          slug: data.name
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, ""),
          createdAt: new Date().toISOString(),
        });

        // If email and password provided, create the Admin User for this Tenant
        if (data.email && data.password) {
          try {
            // Dynamic import to avoid SSR issues with Firebase
            const { initializeApp, getApp, getApps, deleteApp } =
              await import("firebase/app");
            const { getAuth, createUserWithEmailAndPassword, signOut } =
              await import("firebase/auth");
            const { getFirestore, doc, setDoc } =
              await import("firebase/firestore");

            // Use a unique name for the secondary app to avoid conflicts
            // We reuse the config from the main app
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

            // Check if already exists (cleanup might have failed previously)
            if (getApps().some((app) => app.name === secondaryAppName)) {
              secondaryApp = getApp(secondaryAppName);
            } else {
              secondaryApp = initializeApp(config, secondaryAppName);
            }

            const secondaryAuth = getAuth(secondaryApp);
            const secondaryDb = getFirestore(secondaryApp);

            // Create the user
            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth,
              data.email,
              data.password
            );
            const user = userCredential.user;

            // Create User Profile in "users" collection linked to the new Tenant
            await setDoc(doc(secondaryDb, "users", user.uid), {
              name: `Admin ${data.name}`,
              email: data.email,
              role: "admin",
              tenantId: newTenant.id,
              createdAt: new Date().toISOString(),
            });

            // Sign out immediately from the secondary app just in case
            await signOut(secondaryAuth);

            // Clean up - important!
            await deleteApp(secondaryApp);

            alert(`Empresa ${data.name} e usuário admin criada!`);
          } catch (authError: any) {
            console.error("Error creating tenant user:", authError);
            // Don't fail the whole operation if just the user creation failed, but warn
            alert(
              `Empresa criada, mas erro ao criar usuário: ${authError.message}`
            );
          }
        } else {
          alert(`Empresa ${data.name} criada (sem usuário vinculado)!`);
        }
      }
      setIsDialogOpen(false);
      loadTenants();
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
    setViewingTenant(tenant); // Immediate context update + localStorage
    router.push("/");
  };

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
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
        <Button
          onClick={openCreate}
          size="lg"
          className="shadow-lg hover:shadown-xl transition-all"
        >
          <Plus className="w-5 h-5 mr-2" /> Nova Empresa
        </Button>
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
        {filteredTenants.map((tenant) => (
          <Card
            key={tenant.id}
            className="overflow-hidden border-t-4 hover:shadow-md transition-shadow group flex flex-col"
            style={{ borderTopColor: tenant.primaryColor }}
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
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  ID: {tenant.slug}
                </p>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span>
                  Ativo desde: {new Date(tenant.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 p-4 border-t">
              <Button
                className="w-full cursor-pointer group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                variant="outline"
                onClick={() => handleLoginAs(tenant)}
              >
                <LogIn className="w-4 h-4 mr-2" /> Acessar Painel
              </Button>
            </CardFooter>
          </Card>
        ))}

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
