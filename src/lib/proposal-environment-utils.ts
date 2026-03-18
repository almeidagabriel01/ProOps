import { Ambiente, AmbienteProduct, ProposalSistema } from "@/types/automation";
import { ProposalSystemInstance } from "@/types/proposal";

export function createEnvironmentProposalSelection(
  ambiente: Pick<Ambiente, "id" | "name" | "description" | "defaultProducts">,
): ProposalSistema {
  const products: AmbienteProduct[] = (ambiente.defaultProducts || []).map(
    (product) => ({
      ...product,
      quantity: Math.max(1, Number(product.quantity || 1)),
      status: product.status || "active",
    }),
  );

  return {
    sistemaId: ambiente.id,
    sistemaName: ambiente.name,
    description: ambiente.description || "",
    ambientes: [
      {
        ambienteId: ambiente.id,
        ambienteName: ambiente.name,
        description: ambiente.description || "",
        products,
      },
    ],
    ambienteId: ambiente.id,
    ambienteName: ambiente.name,
    products,
  };
}

export function isEnvironmentProposalSelection(
  sistema: ProposalSistema | null | undefined,
): boolean {
  if (!sistema) return false;

  const primaryAmbiente = sistema.ambientes?.[0];
  if (!primaryAmbiente) return false;
  const ambienteCount = sistema.ambientes?.length ?? 0;

  return (
    ambienteCount === 1 &&
    sistema.sistemaId === primaryAmbiente.ambienteId &&
    sistema.sistemaName === primaryAmbiente.ambienteName
  );
}

export function isEnvironmentProposalSystemInstance(
  sistema:
    | ProposalSystemInstance
    | {
        sistemaId?: string;
        sistemaName?: string;
        ambientes?: Array<{
          ambienteId?: string;
          ambienteName?: string;
        }>;
      }
    | null
    | undefined,
): boolean {
  if (!sistema) return false;

  const primaryAmbiente = sistema.ambientes?.[0];
  if (!primaryAmbiente) return false;
  const ambienteCount = sistema.ambientes?.length ?? 0;

  return (
    ambienteCount === 1 &&
    sistema.sistemaId === primaryAmbiente.ambienteId &&
    sistema.sistemaName === primaryAmbiente.ambienteName
  );
}

export function getEnvironmentSelectionInstanceId(
  ambienteId: string,
): string {
  return `${ambienteId}-${ambienteId}`;
}
