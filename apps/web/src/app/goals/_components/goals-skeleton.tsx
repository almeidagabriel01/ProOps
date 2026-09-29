import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Só o card: o mês, a meta da empresa e uma linha por pessoa da equipe. A
 * página o usa enquanto plano e permissões carregam, com o cabeçalho já na tela.
 */
export function SalesGoalsCardSkeleton() {
  return (
    <Card data-testid="goals-card-skeleton">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-8 w-56 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-xs space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
        <Skeleton className="ml-auto h-10 w-36 rounded-md" />
      </CardContent>
    </Card>
  );
}

/** A rota inteira: cabeçalho com o seletor do Financeiro e o card. */
export function GoalsSkeleton() {
  return (
    <div className="space-y-6" data-testid="goals-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full" />
      </div>
      <div className="max-w-4xl">
        <SalesGoalsCardSkeleton />
      </div>
    </div>
  );
}
