/**
 * Caracterização das demonstrações: fixa, documento por documento, o
 * que cada seed grava, em dois instantes (um fim de mês perto da meia-noite
 * UTC e um dia comum), porque as datas relativas saem de `new Date()`.
 *
 * É a rede de segurança da troca dos três seeds por um motor único: o motor
 * tem que gravar exatamente isto, e toda mudança de dado depois dele aparece
 * aqui como diferença de snapshot, de propósito.
 */

type Write = { op: "set" | "delete"; path: string; data?: unknown };
const writes: Write[] = [];

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    batch: () => ({
      set: (ref: { path: string }, data: unknown) => writes.push({ op: "set", path: ref.path, data }),
      delete: (ref: { path: string }) => writes.push({ op: "delete", path: ref.path }),
      commit: async () => undefined,
    }),
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}`, id }) }),
  }),
  Timestamp: { fromMillis: (ms: number) => ({ __ts: ms }) },
}));
jest.mock("../../lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import { seedDemo } from "../demo/seed";
import { DEMO_DATASETS } from "../demo/datasets";

// Os três seeds antigos viraram datasets do motor único; a saída continua a
// mesma que eles gravavam (este snapshot foi gerado com o código antigo).
const SEEDS = {
  automacao_residencial: () => seedDemo(DEMO_DATASETS.automacao_residencial),
  cortinas: () => seedDemo(DEMO_DATASETS.cortinas),
  seguranca_eletronica: () => seedDemo(DEMO_DATASETS.seguranca_eletronica),
} as const;

const INSTANTS = ["2026-03-31T23:30:00.000Z", "2026-07-15T14:00:00.000Z"];

async function capture(seed: () => Promise<unknown>, now: string) {
  writes.length = 0;
  jest.useFakeTimers({ now: new Date(now) });
  try {
    const result = await seed();
    const sorted = [...writes].sort((a, b) => (a.path + a.op).localeCompare(b.path + b.op));
    return { result, writes: sorted };
  } finally {
    jest.useRealTimers();
  }
}

describe.each(Object.entries(SEEDS))("seed de demonstração %s", (_niche, seed) => {
  it.each(INSTANTS)("grava o mesmo conjunto em %s", async (now) => {
    const captured = await capture(seed, now);
    expect(new Set(captured.writes.map((w) => w.op + w.path)).size).toBe(captured.writes.length);
    expect(captured).toMatchSnapshot();
  });
});
