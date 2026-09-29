import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Só o card: o interruptor, os dias da semana, os quatro horários e os tipos de
 * visita. A página e o próprio card o usam enquanto carregam.
 */
export function BookingCardSkeleton() {
  return (
    <Card data-testid="booking-card-skeleton">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-12 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="ml-auto h-10 w-24 rounded-md" />
      </CardContent>
    </Card>
  );
}

/** A rota inteira: cabeçalho com o seletor da Agenda e o card. */
export function BookingSkeleton() {
  return (
    <div className="space-y-6" data-testid="booking-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full" />
      </div>
      <div className="max-w-4xl">
        <BookingCardSkeleton />
      </div>
    </div>
  );
}
