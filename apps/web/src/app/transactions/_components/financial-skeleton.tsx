export function FinancialSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header: Title + Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-52 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-44 rounded-xl bg-muted" />
          <div className="h-10 w-32 rounded-xl bg-muted" />
          <div className="h-10 w-44 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Balance */}
      <div className="flex justify-end">
        <div className="space-y-1 text-right">
          <div className="h-3 w-16 rounded bg-muted ml-auto" />
          <div className="h-7 w-36 rounded bg-muted" />
        </div>
      </div>

      {/* Summary Cards: 3 large + 2 small stacked */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="space-y-4">
          <div className="h-[50px] rounded-2xl bg-muted" />
          <div className="h-[50px] rounded-2xl bg-muted" />
        </div>
      </div>

      {/* Skeleton: filtros — 3 linhas */}
      <div className="rounded-xl border bg-card shadow-sm p-3 md:p-4 flex flex-col gap-3.5">
        {/* Linha 1: search h-12 + (limpar + viewmode) à direita */}
        <div className="flex items-center gap-3">
          <div className="h-12 flex-1 rounded-xl bg-muted" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-24 rounded-lg bg-muted" />
            <div className="h-9 w-52 rounded-xl bg-muted" />
          </div>
        </div>
        {/* Linha 2: type segmented + status pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-9 w-52 rounded-xl bg-muted" />
          <div className="flex items-center gap-1.5">
            <div className="h-9 w-20 rounded-full bg-muted" />
            <div className="h-9 w-24 rounded-full bg-muted" />
            <div className="h-9 w-24 rounded-full bg-muted" />
          </div>
        </div>
        {/* Linha 3: wallet + período + sort à direita */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-9 w-44 rounded-lg bg-muted" />
          <div className="h-9 w-40 rounded-lg bg-muted" />
          <div className="h-9 w-36 rounded-lg bg-muted" />
          <div className="h-9 w-36 rounded-lg bg-muted" />
          <div className="h-9 w-44 rounded-lg bg-muted ml-auto" />
        </div>
      </div>

      {/* Transaction Rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[52px] rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
