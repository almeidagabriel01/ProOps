/**
 * Campos de ordenação da proposta (`primarySystem`, `primaryEnvironment`),
 * derivados do array `sistemas`: os nomes, sem repetição, em ordem pt-BR,
 * juntos por ", ". Espelha `computeProposalSortFields` do front
 * (`apps/web/src/services/proposal-service.ts`), sem cruzar a fronteira
 * web/functions. Usado pelo backfill e pelo motor de demonstração.
 */

type RawAmbiente = { ambienteId?: unknown; ambienteName?: unknown };
type RawSistema = {
  sistemaId?: unknown;
  sistemaName?: unknown;
  ambienteName?: unknown;
  ambientes?: unknown;
};

function sortStringsPtBr(values: string[]): string[] {
  return [...values].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }),
  );
}

function normalizeLabelList(values: unknown[]): string[] {
  const labels = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  return sortStringsPtBr(Array.from(new Set(labels)));
}

/**
 * Espelha isEnvironmentProposalSystemInstance do frontend: sistema
 * "ambiente-like" (1 ambiente com mesmo id/nome do sistema) não conta como
 * sistema.
 */
function isEnvironmentLikeSystem(sistema: RawSistema): boolean {
  const ambientes = Array.isArray(sistema.ambientes)
    ? (sistema.ambientes as RawAmbiente[])
    : [];
  const primary = ambientes[0];
  if (!primary) return false;
  return (
    ambientes.length === 1 &&
    String(sistema.sistemaId ?? "") === String(primary.ambienteId ?? "") &&
    String(sistema.sistemaName ?? "") === String(primary.ambienteName ?? "")
  );
}

export function extractSystemNames(data: Record<string, unknown>): string[] {
  const sistemas = Array.isArray(data.sistemas)
    ? (data.sistemas as RawSistema[])
    : [];
  const fromSistemas = sistemas
    .filter((sistema) => !isEnvironmentLikeSystem(sistema))
    .map((sistema) => sistema?.sistemaName)
    .filter((name): name is string => typeof name === "string");

  const normalized = normalizeLabelList(fromSistemas);
  if (normalized.length > 0) return normalized;

  return normalizeLabelList([data.primarySystem]);
}

export function extractEnvironmentNames(data: Record<string, unknown>): string[] {
  const sistemas = Array.isArray(data.sistemas)
    ? (data.sistemas as RawSistema[])
    : [];
  const fromSistemas = sistemas.flatMap((sistema) => {
    const nested = Array.isArray(sistema?.ambientes)
      ? (sistema.ambientes as RawAmbiente[])
          .map((ambiente) => ambiente?.ambienteName)
          .filter((name): name is string => typeof name === "string")
      : [];
    if (nested.length > 0) return nested;
    return typeof sistema?.ambienteName === "string"
      ? [sistema.ambienteName]
      : [];
  });

  const normalized = normalizeLabelList(fromSistemas);
  if (normalized.length > 0) return normalized;

  return normalizeLabelList([data.primaryEnvironment]);
}

export function computeProposalSortFields(data: Record<string, unknown>): {
  primarySystem: string;
  primaryEnvironment: string;
} {
  return {
    primarySystem: extractSystemNames(data).join(", "),
    primaryEnvironment: extractEnvironmentNames(data).join(", "),
  };
}
