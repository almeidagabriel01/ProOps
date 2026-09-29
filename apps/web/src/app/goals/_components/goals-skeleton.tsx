import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * O corpo da tela: o card da empresa e o da equipe. O painel o usa ao trocar
 * de mês, com o cabeçalho (e o seletor do mês) já na tela.
 */
export function GoalsBodySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" data-testid="goals-body-skeleton">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** A rota inteira: cabeçalho com o seletor do Financeiro, o mês e o salvar, e o corpo. */
export function GoalsSkeleton() {
  return (
    <div className="space-y-6" data-testid="goals-skeleton">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <GoalsBodySkeleton />
    </div>
  );
}
