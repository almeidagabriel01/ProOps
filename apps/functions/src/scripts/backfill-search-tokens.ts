/**
 * One-shot backfill: grava o campo `searchTokens` (tokens de busca indexados,
 * ver lib/search-tokens.ts — helper REAL reutilizado aqui) em todos os docs de:
 *   - `proposals` → buildSearchTokens(title, clientName)
 *   - `clients`   → buildClientSearchTokens(name, email, phone), que soma os
 *     dígitos do telefone; e `types: ["cliente"]` onde o campo falta
 *
 * Habilita a busca as-you-type via `array-contains` no frontend
 * (searchProposals / searchClients) sem baixar as coleções inteiras.
 * Docs novos são mantidos pelos writers do backend (proposals.controller,
 * proposals.service, clients.controller, contacts.service).
 *
 * Run manually:
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-search-tokens.ts
 *
 * Idempotente — safe to re-run.
 */
import { db } from "../init";
import { buildClientSearchTokens, buildSearchTokens } from "../lib/search-tokens";

const PAGE_SIZE = 300;

function sameTokens(a: unknown, b: string[]): boolean {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

async function backfillCollection(
  collectionName: "proposals" | "clients",
  tokenFields: (data: Record<string, unknown>) => Array<string | undefined | null>,
  buildTokens: (...values: Array<string | undefined>) => string[] = buildSearchTokens,
  extraFields: (data: Record<string, unknown>) => Record<string, unknown> = () => ({}),
): Promise<void> {
  console.log(`--- backfill-search-tokens: ${collectionName} ---`);

  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db
      .collection(collectionName)
      .orderBy("__name__")
      .limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data() as Record<string, unknown>;
      const tokens = buildTokens(
        ...tokenFields(data).map((value) =>
          typeof value === "string" ? value : undefined,
        ),
      );
      const extra = extraFields(data);

      if (!sameTokens(data.searchTokens, tokens) || Object.keys(extra).length > 0) {
        batch.update(doc.ref, { searchTokens: tokens, ...extra });
        batchWrites += 1;
      }
    }

    if (batchWrites > 0) {
      await batch.commit();
      updated += batchWrites;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`${collectionName}: processed=${processed} updated=${updated}`);

    if (snap.size < PAGE_SIZE) break;
  }

  console.log(
    `--- ${collectionName}: done — processed=${processed}, updated=${updated} ---`,
  );
}

async function main(): Promise<void> {
  console.log("=== backfill-search-tokens: starting ===");

  await backfillCollection("proposals", (data) => [
    data.title as string | undefined,
    data.clientName as string | undefined,
  ]);
  // Contatos: tokens com os dígitos do telefone (buildClientSearchTokens) e
  // `types` completado em quem nasceu antes do campo existir. O filtro por tipo
  // da tela de Contatos e a seção de comissões consultam `types` com
  // array-contains, e um doc sem o campo sumiria do filtro "Cliente".
  await backfillCollection(
    "clients",
    (data) => [
      data.name as string | undefined,
      data.email as string | undefined,
      data.phone as string | undefined,
    ],
    (name, email, phone) => buildClientSearchTokens(name, email, phone),
    (data) =>
      Array.isArray(data.types) && data.types.length > 0 ? {} : { types: ["cliente"] },
  );

  console.log("=== backfill-search-tokens: done ===");
}

main().catch((err) => {
  console.error("backfill-search-tokens failed:", err);
  process.exitCode = 1;
});
