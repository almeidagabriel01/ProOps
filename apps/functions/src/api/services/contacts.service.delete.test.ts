/**
 * A Lia exclui contato por `deleteContact`, que não passava pela conferência
 * de uso: um contato que estava numa proposta era apagado pela conversa.
 */

let mockUsed = false;
const deleted: string[] = [];

jest.mock("./proposal-usage.service", () => ({ isClientUsed: async () => mockUsed }));
jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: true, data: () => ({ tenantId: "t1", name: "Ana" }) }),
        delete: async () => {
          deleted.push(id);
        },
      }),
    }),
  },
}));

import { deleteContact } from "./contacts.service";

beforeEach(() => {
  deleted.length = 0;
});

describe("deleteContact (Lia)", () => {
  it("recusa o contato que está numa proposta", async () => {
    mockUsed = true;
    await expect(deleteContact("c1", "t1")).rejects.toThrow("está em uma proposta");
    expect(deleted).toHaveLength(0);
  });

  it("apaga o contato sem proposta", async () => {
    mockUsed = false;
    await expect(deleteContact("c1", "t1")).resolves.toMatchObject({ deleted: true });
    expect(deleted).toEqual(["c1"]);
  });
});
