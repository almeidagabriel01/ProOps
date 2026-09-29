import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CardHeaderSkeleton() {
  return (
    <CardHeader className="space-y-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full max-w-sm" />
    </CardHeader>
  );
}

/**
 * O corpo da tela, na mesma grade 2x2 do painel: link e tipos de visita em
 * cima, expediente e exceções embaixo. O painel o usa enquanto busca o
 * expediente, com o cabeçalho na tela.
 */
export function BookingBodySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="booking-body-skeleton">
      <Card className="lg:col-start-1 lg:row-start-1">
        <CardHeaderSkeleton />
        <CardContent>
          <Skeleton className="h-14 w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card className="lg:col-start-1 lg:row-start-2">
        <CardHeaderSkeleton />
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
        </CardContent>
      </Card>
      <Card className="lg:col-start-2 lg:row-start-1">
        <CardHeaderSkeleton />
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-9 w-48 rounded-md" />
        </CardContent>
      </Card>
      <Card className="lg:col-start-2 lg:row-start-2">
        <CardHeaderSkeleton />
        <CardContent>
          <Skeleton className="h-12 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

/** A rota inteira: cabeçalho com o seletor da Agenda, o interruptor e o salvar, e o corpo. */
export function BookingSkeleton() {
  return (
    <div className="space-y-6" data-testid="booking-skeleton">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <BookingBodySkeleton />
    </div>
  );
}
