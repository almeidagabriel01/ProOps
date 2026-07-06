/**
 * One-shot backfill: grava o campo `searchTokens` (tokens de busca indexados,
 * ver lib/search-tokens.ts — helper REAL reutilizado aqui) em todos os docs de:
 *   - `proposals` → buildSearchTokens(title, clientName)
 *   - `clients`   → buildSearchTokens(name, email, phone)
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
import { buildSearchTokens } from "../lib/search-tokens";

const PAGE_SIZE = 300;

function sameTokens(a: unknown, b: string[]): boolean {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

async function backfillCollection(
  collectionName: "proposals" | "clients",
  tokenFields: (data: Record<string, unknown>) => Array<string | undefined | null>,
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
      const tokens = buildSearchTokens(
        ...tokenFields(data).map((value) =>
          typeof value === "string" ? value : undefined,
        ),
      );

      if (!sameTokens(data.searchTokens, tokens)) {
        batch.update(doc.ref, { searchTokens: tokens });
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
  await backfillCollection("clients", (data) => [
    data.name as string | undefined,
    data.email as string | undefined,
    data.phone as string | undefined,
  ]);

  console.log("=== backfill-search-tokens: done ===");
}

main().catch((err) => {
  console.error("backfill-search-tokens failed:", err);
  process.exitCode = 1;
});
