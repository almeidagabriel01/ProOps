import { EntityLoadingState } from "@/components/shared/entity-loading-state";

export default function Loading() {
  return <EntityLoadingState message="Carregando transação..." />;
}
