import { Skeleton } from "@/components/ui/skeleton";

/** Calendário carregando: cabeçalho com o seletor da Agenda, barra de navegação e a grade do mês. */
export function CalendarSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-[32px] border border-border/60 bg-card/95 xl:h-[calc(100dvh-8rem)]"
      data-testid="calendar-skeleton"
    >
      <div className="space-y-3 border-b border-border/60 px-5 py-3 xl:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <Skeleton className="mt-3 h-9 w-72 max-w-full rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-10 w-56 rounded-full" />
        </div>
      </div>
      <div className="grid flex-1 grid-cols-7 gap-px p-4">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-md md:h-24" />
        ))}
      </div>
    </div>
  );
}
