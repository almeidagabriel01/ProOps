import { Skeleton } from "@/components/ui/skeleton";

/** Tela do DRE carregando: cabeçalho, filtros, três totais e a tabela. */
export function DreSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div className="space-y-6" data-testid="dre-skeleton">
      {withHeader && (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-12 w-full sm:w-56" />
            <Skeleton className="h-11 w-56" />
          </div>
        </>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
