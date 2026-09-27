/**
 * O motor único contra os seeds antigos, documento por documento, antes de os
 * seeds antigos serem apagados. `toStrictEqual` distingue chave ausente de
 * chave `undefined`, que o JSON esconderia.
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

import { seedDemoTenant } from "../seed-demo-tenant";
import { seedDemoCortinasTenant } from "../seed-demo-cortinas";
import { seedDemoSegurancaTenant } from "../seed-demo-seguranca";
import { seedDemo } from "../demo/seed";
import { DEMO_DATASETS } from "../demo/datasets";

const LEGACY = {
  automacao_residencial: seedDemoTenant,
  cortinas: seedDemoCortinasTenant,
  seguranca_eletronica: seedDemoSegurancaTenant,
} as const;

async function capture(run: () => Promise<unknown>, now: string) {
  writes.length = 0;
  jest.useFakeTimers({ now: new Date(now) });
  try {
    const result = await run();
    return {
      result,
      writes: [...writes].sort((a, b) => (a.path + a.op).localeCompare(b.path + b.op)),
    };
  } finally {
    jest.useRealTimers();
  }
}

describe.each(Object.keys(LEGACY) as Array<keyof typeof LEGACY>)("motor x seed antigo: %s", (niche) => {
  it.each(["2026-03-31T23:30:00.000Z", "2026-07-15T14:00:00.000Z"])("mesmos documentos em %s", async (now) => {
    const legacy = await capture(LEGACY[niche], now);
    const engine = await capture(() => seedDemo(DEMO_DATASETS[niche]), now);
    expect(engine.writes).toStrictEqual(legacy.writes);
    expect(engine.result).toStrictEqual(legacy.result);
  });
});
