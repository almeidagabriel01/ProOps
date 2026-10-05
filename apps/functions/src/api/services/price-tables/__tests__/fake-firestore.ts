/**
 * Firestore em memória, só com o que as tabelas de preço e o cadastro do
 * contato usam: igualdade em `where`, `limit`, `count`, `add`, `getAll`,
 * `runTransaction` e o sentinela de apagar campo (`{ __delete: true }`, que o
 * teste devolve no mock de `FieldValue.delete`).
 */

type Data = Record<string, unknown>;
export type FakeStore = Record<string, Record<string, Data>>;

export const DELETE_FIELD = { __delete: true } as const;

function applyUpdate(current: Data, patch: Data): Data {
  const next: Data = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && (value as { __delete?: boolean }).__delete) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function createFakeDb(store: FakeStore) {
  let autoId = 0;
  const col = (name: string) => (store[name] ??= {});

  const snapshot = (name: string, id: string) => {
    const data = col(name)[id];
    return { id, exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
  };

  const docRef = (name: string, id: string) => ({
    id,
    path: `${name}/${id}`,
    get: async () => snapshot(name, id),
    set: async (data: Data) => {
      col(name)[id] = { ...data };
    },
    update: async (patch: Data) => {
      if (!col(name)[id]) throw new Error(`NOT_FOUND ${name}/${id}`);
      col(name)[id] = applyUpdate(col(name)[id], patch);
    },
    delete: async () => {
      delete col(name)[id];
    },
  });

  type Filter = { field: string; value: unknown };
  const query = (name: string, filters: Filter[], max?: number) => {
    const matches = () =>
      Object.entries(col(name))
        .filter(([, data]) => filters.every((f) => data[f.field] === f.value))
        .slice(0, max ?? Number.POSITIVE_INFINITY);
    return {
      where: (field: string, _op: string, value: unknown) =>
        query(name, [...filters, { field, value }], max),
      limit: (n: number) => query(name, filters, n),
      get: async () => {
        const docs = matches().map(([id, data]) => ({ id, data: () => ({ ...data }) }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      count: () => ({
        get: async () => ({ data: () => ({ count: matches().length }) }),
      }),
    };
  };

  const db = {
    collection: (name: string) => ({
      ...query(name, []),
      doc: (id?: string) => docRef(name, id ?? `auto-${++autoId}`),
      add: async (data: Data) => {
        const id = `auto-${++autoId}`;
        col(name)[id] = { ...data };
        return { id };
      },
    }),
    getAll: async (...refs: Array<{ get: () => Promise<unknown> }>) =>
      Promise.all(refs.map((r) => r.get())),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
      const tx = {
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (ref: { set: (d: Data) => Promise<void> }, data: Data) => void ref.set(data),
        update: (ref: { update: (d: Data) => Promise<void> }, data: Data) =>
          void ref.update(data).catch(() => undefined),
      };
      return fn(tx);
    },
  };
  return db;
}
