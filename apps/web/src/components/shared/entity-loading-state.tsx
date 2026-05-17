import { FullPageLoading } from "@/components/ui/full-page-loading";

interface EntityLoadingStateProps {
  message?: string;
  minHeight?: string;
}

export function EntityLoadingState({
  message = "Carregando...",
}: EntityLoadingStateProps) {
  return <FullPageLoading message={message} />;
}
