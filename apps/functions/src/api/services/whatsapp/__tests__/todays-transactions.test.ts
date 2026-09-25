/**
 * O resumo "de hoje" do WhatsApp varria TODOS os lançamentos do tenant sempre
 * que as consultas indexadas voltavam vazias, ou seja, em todo dia sem
 * movimento. Vazio agora é resposta; a varredura fica só para erro de consulta.
 */

type Snap = { docs: Array<{ id: string; data: () => Record<string, unknown> }> };
const calls: Array<{ collection: string; wheres: unknown[][] }> = [];
let respond: (collection: string, wheres: unknown[][]) => Promise<Snap>;

jest.mock("../../../../init", () => ({
  db: {
    // Imutável como o SDK real: cada where devolve uma consulta nova.
    collection: (name: string) => {
      const build = (wheres: unknown[][]): unknown => ({
        where: (...args: unknown[]) => build([...wheres, args]),
        get: () => {
          calls.push({ collection: name, wheres });
          return respond(name, wheres);
        },
      });
      return build([]);
    },
  },
}));

import { getTodaysTransactions } from "../whatsapp.db";

const start = new Date("2026-09-25T03:00:00Z");
const end = new Date("2026-09-26T03:00:00Z");
const isFullScan = (w: unknown[][]) => w.length === 1 && w[0][0] === "tenantId";

beforeEach(() => {
  calls.length = 0;
});

it("dia sem movimento: não varre a coleção inteira", async () => {
  respond = async () => ({ docs: [] });
  await expect(getTodaysTransactions("t1", start, end)).resolves.toEqual([]);
  expect(calls.some((c) => isFullScan(c.wheres))).toBe(false);
});

it("com movimento: devolve os lançamentos sem duplicar criado e pago no mesmo dia", async () => {
  const doc = { id: "tx1", data: () => ({ type: "income", amount: 100 }) };
  respond = async (_c, wheres) =>
    wheres.some((w) => w[0] === "createdAt" || w[0] === "paidAt") ? { docs: [doc] } : { docs: [] };
  const result = await getTodaysTransactions("t1", start, end);
  expect(result).toEqual([{ id: "tx1", type: "income", amount: 100 }]);
  expect(calls.some((c) => isFullScan(c.wheres))).toBe(false);
});

it("erro na consulta indexada ainda usa a varredura como rede de segurança", async () => {
  const inside = { id: "tx9", data: () => ({ type: "expense", amount: -50, paidAt: new Date("2026-09-25T15:00:00Z") }) };
  respond = async (collection, wheres) => {
    if (isFullScan(wheres)) return { docs: collection === "transactions" ? [inside] : [] };
    throw new Error("FAILED_PRECONDITION");
  };
  const result = await getTodaysTransactions("t1", start, end);
  expect(result.map((r) => r.id)).toEqual(["tx9"]);
});
