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
