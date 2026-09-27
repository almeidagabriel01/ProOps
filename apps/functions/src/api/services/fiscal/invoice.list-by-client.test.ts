const wheres: unknown[][] = [];
let docs: Array<Record<string, unknown>> = [];

jest.mock("../../../init", () => ({
  db: {
    collection: () => {
      const q = {
        where: (...args: unknown[]) => {
          wheres.push(args);
          return q;
        },
        limit: () => q,
        get: async () => ({ docs: docs.map((d) => ({ data: () => d })) }),
      };
      return q;
    },
  },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { listInvoicesByClient } from "./invoice.service";

describe("listInvoicesByClient (ficha 360)", () => {
  beforeEach(() => {
    wheres.length = 0;
  });

  it("filtra por empresa e contato e ordena da mais recente", async () => {
    docs = [
      { id: "a", createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "b", createdAt: "2026-09-10T00:00:00.000Z" },
    ];
    const result = await listInvoicesByClient("t1", "c1");

    expect(wheres).toEqual([
      ["tenantId", "==", "t1"],
      ["clientId", "==", "c1"],
    ]);
    expect(result.map((i) => (i as unknown as { id: string }).id)).toEqual(["b", "a"]);
  });
});
