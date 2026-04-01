"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-destructive">
          Algo deu errado
        </h2>
        <p className="text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente ou entre em contato com o
          suporte.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-muted-foreground/60">
            Código: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Tentar novamente
      </button>
    </div>
  );
}
