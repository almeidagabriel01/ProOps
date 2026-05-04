import { Loader } from "@/components/ui/loader";

interface EntityLoadingStateProps {
  message?: string;
  minHeight?: string;
}

export function EntityLoadingState({
  message = "Carregando...",
  minHeight = "min-h-[50vh]",
}: EntityLoadingStateProps) {
  return (
    <div className={`flex items-center justify-center ${minHeight}`}>
      <div className="flex flex-col items-center gap-3">
        <Loader size="lg" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
