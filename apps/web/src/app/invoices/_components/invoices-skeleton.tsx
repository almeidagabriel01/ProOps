import { Skeleton } from "@/components/ui/skeleton";

/** Linhas da tabela de notas, no lugar do spinner enquanto a lista chega. */
export function InvoicesTableSkeleton() {
  return (
    <div
      className="rounded-xl border bg-card"
      data-testid="invoices-table-skeleton"
    >
      <div className="hidden border-b px-4 py-3 md:grid md:grid-cols-12 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-3/4 md:col-span-2" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, row) => (
        <div
          key={row}
          className="flex flex-col gap-2 border-b px-4 py-4 last:border-b-0 md:grid md:grid-cols-12 md:gap-4"
        >
          {Array.from({ length: 6 }).map((_, col) => (
            <Skeleton key={col} className="h-4 w-full md:col-span-2" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Tela de Notas Fiscais carregando: cabeçalho, seletor e tabela. */
export function InvoicesSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:p-8"
      data-testid="invoices-skeleton"
    >
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-48 max-w-full rounded-full" />
          <Skeleton className="h-10 w-44 max-w-full" />
        </div>
      </div>
      <InvoicesTableSkeleton />
    </div>
  );
}
