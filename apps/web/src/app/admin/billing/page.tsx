"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "@/lib/toast";

function formatBRL(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

interface DriftRow {
  item: TenantBillingInfo;
  selected: boolean;
}

export default function AdminBillingMigrationPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [rows, setRows] = React.useState<DriftRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMigrating, setIsMigrating] = React.useState(false);
  const [migratingIds, setMigratingIds] = React.useState<Set<string>>(
    new Set(),
  );

  const loadData = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const all = await AdminService.getAllTenantsBilling();
      const withDrift = all.filter((t) => Boolean(t.priceChangeNotifiedFor));
      setRows(withDrift.map((item) => ({ item, selected: false })));
    } catch {
      toast.error("Erro ao carregar tenants com drift de preço.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user && user.role !== "superadmin") {
      router.push("/dashboard");
      return;
    }
    loadData();
  }, [user, router, loadData]);

  const allSelected =
    rows.length > 0 && rows.every((r) => r.selected);

  const toggleAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  };

  const toggleRow = (tenantId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.item.tenant.id === tenantId ? { ...r, selected: !r.selected } : r,
      ),
    );
  };

  const migrateSingle = async (tenantId: string) => {
    setMigratingIds((prev) => new Set(prev).add(tenantId));
    try {
      const result = await AdminService.migrateTenantPrices([tenantId]);
      const outcome = result.results[0];
      if (outcome?.status === "migrated") {
        toast.success("Preço migrado com sucesso.");
        setRows((prev) => prev.filter((r) => r.item.tenant.id !== tenantId));
      } else if (outcome?.status === "skipped") {
        toast.info(`Ignorado: ${outcome.reason ?? "sem drift"}.`);
      } else {
        toast.error(`Falha: ${outcome?.reason ?? "erro desconhecido"}.`);
      }
    } catch {
      toast.error("Erro ao migrar preço.");
    } finally {
      setMigratingIds((prev) => {
        const next = new Set(prev);
        next.delete(tenantId);
        return next;
      });
    }
  };

  const migrateSelected = async () => {
    const selectedIds = rows
      .filter((r) => r.selected)
      .map((r) => r.item.tenant.id);

    if (selectedIds.length === 0) {
      toast.info("Nenhuma empresa selecionada.");
      return;
    }
    if (selectedIds.length > 50) {
      toast.error("Selecione no máximo 50 empresas por vez.");
      return;
    }

    const confirmed = window.confirm(
      `Migrar preço de ${selectedIds.length} empresa(s) selecionada(s)?\n\nA migração atualiza as assinaturas Stripe imediatamente sem prorateamento.`,
    );
    if (!confirmed) return;

    setIsMigrating(true);
    try {
      const result = await AdminService.migrateTenantPrices(selectedIds);
      toast.success(
        `Migração concluída: ${result.migrated} migrado(s), ${result.skipped} ignorado(s), ${result.failed} com falha.`,
      );
      const migratedIds = new Set(
        result.results
          .filter((r) => r.status === "migrated")
          .map((r) => r.tenantId),
      );
      setRows((prev) =>
        prev.filter((r) => !migratedIds.has(r.item.tenant.id)),
      );
    } catch {
      toast.error("Erro ao migrar preços em lote.");
    } finally {
      setIsMigrating(false);
    }
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ArrowRightLeft className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Migração de Preços
              </h1>
              <p className="text-sm text-muted-foreground">
                Empresas com preço desatualizado em relação ao plano atual
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="shadow-sm hover:shadow transition-all"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={migrateSelected}
            disabled={selectedCount === 0 || isMigrating}
            className="shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            {isMigrating
              ? "Migrando..."
              : `Migrar selecionados${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="px-6 py-5">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Carregando..."
              : rows.length === 0
                ? "Nenhuma empresa com drift de preço encontrada."
                : `${rows.length} empresa(s) com preço desatualizado`}
          </p>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-0">
                  <TableHead className="pl-6 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={rows.length === 0}
                      aria-label="Selecionar todos"
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Empresa
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Plano
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preço atual
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Renovação
                  </TableHead>
                  <TableHead className="pr-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Nenhuma empresa com drift de preço.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ item, selected }) => {
                    const isBusy = migratingIds.has(item.tenant.id);
                    return (
                      <TableRow
                        key={item.tenant.id}
                        className="border-b border-muted/50 hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="pl-6 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleRow(item.tenant.id)}
                            aria-label={`Selecionar ${item.tenant.name}`}
                            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">
                              {item.tenant.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.admin.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-sm">
                          {item.planName}
                          {item.billingInterval && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ·{" "}
                              {item.billingInterval === "yearly"
                                ? "Anual"
                                : "Mensal"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-sm">
                          {formatBRL(item.unitAmount)}
                        </TableCell>
                        <TableCell className="py-4 text-sm">
                          {formatDate(item.admin.currentPeriodEnd)}
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => migrateSingle(item.tenant.id)}
                            disabled={isBusy || isMigrating}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-400"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                            {isBusy ? "Migrando..." : "Migrar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="border-t bg-muted/20 px-6 py-4">
          <span className="text-sm text-muted-foreground">
            {rows.length} empresa(s) com preço desatualizado
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
