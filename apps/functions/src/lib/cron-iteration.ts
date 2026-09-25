/**
 * Utilitários para crons que percorrem muitos documentos.
 *
 * Vários crons liam com `.limit(N)` sem cursor: acima de N, os mesmos N docs
 * voltavam todo dia e o resto era ignorado em silêncio (aviso de preço,
 * vencimento de certificado, notas de entrada). `paginateQuery` percorre tudo
 * com memória constante.
 */

/** Itera um query página a página por cursor (startAfter no último doc). */
export async function* paginateQuery(
  query: FirebaseFirestore.Query,
  pageSize = 200,
): AsyncGenerator<FirebaseFirestore.QueryDocumentSnapshot> {
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let page = query.limit(pageSize);
    if (last) page = page.startAfter(last);
    const snap = await page.get();
    for (const doc of snap.docs) yield doc;
    if (snap.docs.length < pageSize) return;
    last = snap.docs[snap.docs.length - 1];
  }
}

/** Executa `fn` sobre os itens com no máximo `limit` em paralelo. */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Percorre um query por páginas até um prazo, guardando onde parou em
 * `cron_cursors/{cursorId}`. A próxima execução continua dali e, ao chegar ao
 * fim, a seguinte recomeça do início.
 *
 * Para crons que chamam API externa por item (Stripe) e não cabem numa
 * execução: sem cursor, toda execução recomeçava do primeiro doc e morria no
 * mesmo ponto, então o fim da lista nunca era alcançado. `cursorId: null` roda
 * do início e não grava cursor (execução manual / dry run).
 */
export async function runRotatingCursor(params: {
  db: FirebaseFirestore.Firestore;
  cursorId: string | null;
  /** Coleção de `baseQuery`, para reler o último doc visto. */
  collectionName: string;
  baseQuery: FirebaseFirestore.Query;
  pageSize: number;
  deadlineMs: number;
  processPage: (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => Promise<void>;
  now?: () => number;
}): Promise<{ pages: number; completedCycle: boolean }> {
  const now = params.now ?? Date.now;
  const cursorRef = params.cursorId
    ? params.db.collection("cron_cursors").doc(params.cursorId)
    : null;

  let startAfter: FirebaseFirestore.DocumentSnapshot | null = null;
  if (cursorRef) {
    const cursorSnap = await cursorRef.get();
    const lastDocId = cursorSnap.exists ? (cursorSnap.data()?.lastDocId as string | null) : null;
    if (lastDocId) {
      const lastDoc = await params.db
        .collection(params.collectionName)
        .doc(lastDocId)
        .get()
        .catch(() => null);
      if (lastDoc?.exists) startAfter = lastDoc;
    }
  }

  let pages = 0;
  let completedCycle = false;
  let lastDocId: string | null = null;

  for (;;) {
    let query = params.baseQuery.limit(params.pageSize);
    if (startAfter) query = query.startAfter(startAfter);
    const snap = await query.get();
    if (snap.empty) {
      completedCycle = true;
      break;
    }

    await params.processPage(snap.docs);
    pages += 1;
    startAfter = snap.docs[snap.docs.length - 1];
    lastDocId = startAfter.id;

    if (snap.docs.length < params.pageSize) {
      completedCycle = true;
      break;
    }
    if (now() >= params.deadlineMs) break;
  }

  if (cursorRef) {
    await cursorRef.set(
      { lastDocId: completedCycle ? null : lastDocId, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
  return { pages, completedCycle };
}
