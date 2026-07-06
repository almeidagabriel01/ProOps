/**
 * One-shot backfill: grava os campos desnormalizados `primarySystem` e
 * `primaryEnvironment` em todos os docs de `proposals`, derivados do array
 * `sistemas`. Habilita o sort server-side `orderBy("primarySystem")` /
 * `orderBy("primaryEnvironment")` na listagem paginada — propostas sem
 * sistemas recebem string vazia "" para permanecerem no índice de ordenação.
 *
 * ATENÇÃO: a FONTE DA VERDADE da derivação é o frontend
 * (`computeProposalSortFields` em apps/web/src/services/proposal-service.ts,
 * que usa isEnvironmentProposalSystemInstance de proposal-environment-utils).
 * Este script é one-shot e duplica a derivação deliberadamente para não
 * cruzar a fronteira web/functions. Se a derivação mudar no frontend,
 * atualizar aqui antes de re-executar.
 *
 * Run manually:
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-proposal-sort-fields.ts
 *
 * Idempotente — safe to re-run.
 */
import { db } from "../init";

const PAGE_SIZE = 300;

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

function extractSystemNames(data: Record<string, unknown>): string[] {
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

function extractEnvironmentNames(data: Record<string, unknown>): string[] {
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

async function main(): Promise<void> {
  console.log("=== backfill-proposal-sort-fields: starting ===");

  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("proposals").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data() as Record<string, unknown>;
      const primarySystem = extractSystemNames(data).join(", ");
      const primaryEnvironment = extractEnvironmentNames(data).join(", ");

      if (
        data.primarySystem !== primarySystem ||
        data.primaryEnvironment !== primaryEnvironment
      ) {
        batch.update(doc.ref, { primarySystem, primaryEnvironment });
        batchWrites += 1;
      }
    }

    if (batchWrites > 0) {
      await batch.commit();
      updated += batchWrites;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`processed=${processed} updated=${updated}`);

    if (snap.size < PAGE_SIZE) break;
  }

  console.log(
    `=== backfill-proposal-sort-fields: done — processed=${processed}, updated=${updated} ===`,
  );
}

main().catch((err) => {
  console.error("backfill-proposal-sort-fields failed:", err);
  process.exitCode = 1;
});
