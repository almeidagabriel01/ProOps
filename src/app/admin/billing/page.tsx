"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  Users,
  MoreHorizontal,
  ArrowLeft,
  Building2,
  Package,
  Mail,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { PlanService } from "@/services/plan-service";
import { useAuth } from "@/providers/auth-provider";
import { UserPlan, PlanFeatures } from "@/types";
import { formatPrice } from "@/utils/format";
import { motion } from "motion/react";
import { EditLimitsDialog } from "@/components/admin/edit-limits-dialog";

export default function AdminTenantsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [tenantsData, setTenantsData] = useState<TenantBillingInfo[]>([]);
  const [plans, setPlans] = useState<UserPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Edit Limits State
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    tenantId: string;
    tenantName: string;
    features: PlanFeatures;
  }>({
    open: false,
    tenantId: "",
    tenantName: "",
    features: {} as PlanFeatures,
  });

  const loadData = async () => {
    if (!user) return;
    if (user.role !== "superadmin") {
      router.push("/dashboard");
      return;
    }

    try {
      const [data, plansList] = await Promise.all([
        AdminService.getAllTenantsBilling(),
        PlanService.getPlans(),
      ]);
      setTenantsData(data);
      setPlans(plansList);
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, router]); // Removed loadData from dep array to avoid loops, explicit call

  // Metrics
  const metrics = useMemo(() => {
    const totalTenants = tenantsData.length;
    const totalUsers = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.users,
      0
    );
    const totalProducts = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.products,
      0
    );
    const totalClients = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.clients,
      0
    );
    const totalProposals = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.proposals,
      0
    );
    const activeTenants = tenantsData.filter(
      (t) => t.subscriptionStatus === "active"
    ).length;

    return {
      totalTenants,
      totalUsers,
      totalProducts,
      totalClients,
      totalProposals,
      activeTenants,
    };
  }, [tenantsData]);

  // Filtered Data
  const filteredData = tenantsData.filter((item) => {
    const matchesSearch =
      item.tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.admin.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || item.subscriptionStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const formatLimit = (current: number, max: number | undefined) => {
    if (max === -1 || max === undefined)
      return (
        <div className="flex items-center gap-1">
          <span className="font-semibold">{current}</span>
          <span className="text-muted-foreground text-xs">/ ∞</span>
        </div>
      );
    const isNearLimit = max > 0 && current >= max * 0.9;
    return (
      <div
        className={`flex items-center gap-1 ${isNearLimit ? "text-amber-600" : ""}`}
      >
        <span className="font-semibold">{current}</span>
        <span className="text-muted-foreground text-xs">/ {max}</span>
      </div>
    );
  };

  const handleEditLimits = (item: TenantBillingInfo) => {
    if (!item.planFeatures) return;
    setEditDialog({
      open: true,
      tenantId: item.tenant.id,
      tenantName: item.tenant.name,
      features: item.planFeatures,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-screen w-full bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse">
            Carregando dados das empresas...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Gestão de Empresas
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão completa de todos os inquilinos, recursos e utilização.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Lista
          </Button>
        </div>
      </div>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Empresas
                </CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalTenants}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.activeTenants} ativas
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de acessos
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produtos</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.totalProducts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Em todos catálogos
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Propostas Criadas
                </CardTitle>
                <FileText className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.totalProposals}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Documentos gerados
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Table */}
        <Card className="shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Diretório de Empresas</CardTitle>
              <CardDescription>
                Gerencie acessos, planos e utilização de recursos
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa ou email..."
                  className="pl-8 h-9 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 w-[130px]"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="free">Gratuito</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Propostas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum resultado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => (
                    <TableRow key={item.tenant.id} className="group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            {item.tenant.name}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {item.admin.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {item.planName}
                          </Badge>
                          {item.billingInterval === "yearly" && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-1.5"
                            >
                              Anual
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatLimit(
                          item.usage.users,
                          item.planFeatures?.maxUsers
                        )}
                      </TableCell>
                      <TableCell>
                        {formatLimit(
                          item.usage.products,
                          item.planFeatures?.maxProducts
                        )}
                      </TableCell>
                      <TableCell>
                        {formatLimit(
                          item.usage.clients,
                          item.planFeatures?.maxClients
                        )}
                      </TableCell>
                      <TableCell>
                        {formatLimit(
                          item.usage.proposals,
                          item.planFeatures?.maxProposals
                        )}
                      </TableCell>
                      <TableCell>
                        {item.subscriptionStatus === "active" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-200 shadow-none">
                            Ativo
                          </Badge>
                        ) : item.subscriptionStatus === "free" ? (
                          <Badge
                            variant="secondary"
                            className="text-muted-foreground"
                          >
                            Gratuito
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="bg-rose-500/15 text-rose-600 border-rose-200"
                          >
                            Cancelado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() =>
                                navigator.clipboard.writeText(item.admin.id)
                              }
                            >
                              Copiar ID Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                navigator.clipboard.writeText(item.tenant.id)
                              }
                            >
                              Copiar ID Empresa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleEditLimits(item)}
                            >
                              Editar Limites
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="border-t p-4 text-xs text-muted-foreground flex justify-between">
            <span>Total de {filteredData.length} empresas</span>
            <span>Atualizado em tempo real</span>
          </CardFooter>
        </Card>
      </main>

      <EditLimitsDialog
        open={editDialog.open}
        onClose={() => setEditDialog((prev) => ({ ...prev, open: false }))}
        tenantId={editDialog.tenantId}
        tenantName={editDialog.tenantName}
        currentFeatures={editDialog.features}
        onSaved={loadData}
      />
    </div>
  );
}
