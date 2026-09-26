import { Skeleton } from "@/components/ui/skeleton";

/** Fluxo de caixa carregando: cabeçalho, cenários, três saldos, gráfico e tabela. */
export function CashFlowSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div className="space-y-6" data-testid="cash-flow-skeleton">
      {withHeader && (
        <>
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 w-full sm:w-80" />
            <Skeleton className="h-12 w-full sm:w-44" />
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
        </>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
