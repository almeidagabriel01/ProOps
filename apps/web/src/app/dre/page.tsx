"use client";

import * as React from "react";
import { BarChart3, EyeOff, Tags } from "lucide-react";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { DRE_PERIOD_OPTIONS, marginOf, presetRange, type DrePeriodPreset } from "@/lib/finance/dre-period";
import { FinanceReportsService, type DreBasis, type DreResult } from "@/services/finance-reports-service";
import { DreTable } from "./_components/dre-table";
import { CategoriesDialog } from "./_components/categories-dialog";
import { DreSkeleton } from "./_components/dre-skeleton";
import { AccountantLinkButton } from "./_components/accountant-link-button";
import { ExportMenu } from "@/components/shared/export-menu";
import { usePageScope, usePermission } from "@/hooks/usePermission";
import { downloadSheet, type SheetFormat } from "@/lib/export/sheet";
import { buildDreSheet } from "@/lib/finance/dre-export";

const BASIS_OPTIONS: Array<{ value: DreBasis; label: string; hint: string }> = [
  { value: "cash", label: "Caixa", hint: "O que de fato entrou e saiu, pela data do pagamento." },
  { value: "accrual", label: "Competência", hint: "O que foi vendido e gasto no mês, pago ou não." },
];

/**
 * DRE: receitas menos impostos, custos e despesas, por mês, pelas categorias
 * dos lançamentos. Mesma permissão de Lançamentos e mesmo plano do
 * financeiro; a conta free vê o exemplo da demonstração.
 */
export default function DrePage() {
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const { user } = useAuth();
  const { isDemo } = usePermissions();
  const { hasFinancial, isLoading: planLoading } = usePlanLimits();
  const canExport = usePermission("transactions", "export");
  // O DRE soma a empresa inteira: é de quem vê todos os lançamentos (o backend recusa os demais).
  const { scope: transactionsScope, isLoading: scopeLoading } = usePageScope("transactions");
  const seesAll = !scopeLoading && transactionsScope === "all";
  const [preset, setPreset] = React.useState<DrePeriodPreset>("last_6");
  const [basis, setBasis] = React.useState<DreBasis>("cash");
  const [dre, setDre] = React.useState<DreResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  const range = React.useMemo(() => presetRange(preset), [preset]);

  React.useEffect(() => {
    if (!hasFinancial || !tenant || !seesAll) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    FinanceReportsService.dre({ ...range, basis })
      .then((result) => {
        if (!cancelled) setDre(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível montar o DRE agora.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasFinancial, tenant, range, basis, version, seesAll]);

  if (!isTenantLoading && !tenant && user?.role === "superadmin") return <SelectTenantState />;

  if (!planLoading && !hasFinancial) {
    return (
      <UpgradeRequired
        feature="DRE"
        description="O DRE mostra quanto sobrou em cada mês: receitas menos impostos, custos e despesas, pelas categorias dos lançamentos. Faça upgrade para o plano Profissional ou adquira o módulo Financeiro."
      />
    );
  }

  if (!scopeLoading && transactionsScope !== "all") {
    return (
      <EmptyState
        icon={EyeOff}
        title="Disponível para quem vê todos os lançamentos"
        description="Seu acesso a Lançamentos mostra só uma parte deles (só receitas ou só os das suas vendas). Este relatório soma a empresa inteira, então fica com quem vê tudo."
      />
    );
  }

  const exportDre = async (format: SheetFormat) => {
    if (!dre) return;
    const sheet = buildDreSheet(dre);
    await downloadSheet({
      format,
      fileName: `dre-${basis === "cash" ? "caixa" : "competencia"}-${range.from}-a-${range.to}`,
      sheetName: "DRE",
      ...sheet,
    });
  };

  const net = dre?.totals.netRevenue.total ?? 0;
  const gross = dre?.totals.grossProfit.total ?? 0;
  const result = dre?.totals.result.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">DRE</h1>
          <p className="mt-1 text-muted-foreground">Quanto sobrou: receitas menos impostos, custos e despesas</p>
          <PageViewSwitcher className="mt-3" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AccountantLinkButton />
          {canExport && <ExportMenu onExport={exportDre} disabled={!dre || dre.count === 0} />}
          <Button type="button" variant="outline" onClick={() => setCategoriesOpen(true)}>
            <Tags className="mr-2 h-4 w-4" />
            Categorias
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          aria-label="Período"
          value={preset}
          onChange={(e) => setPreset(e.target.value as DrePeriodPreset)}
          disableSort
          className="sm:w-56"
        >
          {DRE_PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <div role="group" aria-label="Regime" className="inline-flex rounded-xl border p-1">
          {BASIS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={basis === o.value}
              title={o.hint}
              onClick={() => setBasis(o.value)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm transition",
                basis === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{BASIS_OPTIONS.find((o) => o.value === basis)?.hint}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {loading && !dre ? (
        <DreSkeleton withHeader={false} />
      ) : dre && dre.count === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum lançamento no período"
          description={
            basis === "cash"
              ? "No regime de caixa só entra o que foi pago. Troque para competência para ver o que foi lançado, pago ou não."
              : "Os lançamentos do período aparecem aqui, agrupados pela categoria."
          }
        />
      ) : dre ? (
        <div className={cn("space-y-6", loading && "opacity-60")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Tile label="Receita líquida" value={net} />
            <Tile label="Lucro bruto" value={gross} margin={marginOf(gross, net)} />
            <Tile label="Resultado do período" value={result} margin={marginOf(result, net)} emphasis />
          </div>
          {dre.truncated && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              O período tem lançamentos demais para uma consulta só, e parte ficou de fora. Escolha um período menor.
            </p>
          )}
          <DreTable dre={dre} />
          <p className="text-xs text-muted-foreground">
            Lançamento sem categoria ou com categoria fora da lista entra no grupo padrão: receita em Receita bruta,
            despesa em Despesas operacionais. Ajuste em Categorias.
          </p>
        </div>
      ) : null}

      <CategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        onChanged={() => setVersion((v) => v + 1)}
        readOnly={isDemo}
      />
    </div>
  );
}

function Tile({ label, value, margin, emphasis }: { label: string; value: number; margin?: number | null; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", emphasis && "border-primary/40")}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", value < 0 && "text-destructive")}>
        {formatCurrency(value)}
      </p>
      {margin != null && <p className="text-xs text-muted-foreground">{margin.toLocaleString("pt-BR")}% da receita líquida</p>}
    </div>
  );
}
