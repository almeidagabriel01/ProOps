/**
 * Alocacao do numero e gravacao da configuracao.
 *
 * O modulo puro (`proposal-numbering.test.ts`) ja cobre a aritmetica. O que se
 * prova aqui e o que so existe quando o Firestore entra: a numeracao desligada
 * nao escrever NADA, a praca fora da lista nao virar codigo, e um payload
 * parcial nao rebobinar o contador.
 */

const set = jest.fn();
const get = jest.fn();
const doc = jest.fn(() => ({ id: "ref" }));
const collection = jest.fn(() => ({ doc }));
const runTransaction = jest.fn();

jest.mock("../../init", () => ({
  db: {
    collection: (...args: unknown[]) => collection(...(args as [])),
    runTransaction: (...args: unknown[]) => runTransaction(...(args as [])),
  },
}));

import { Timestamp } from "firebase-admin/firestore";
import type { Transaction } from "firebase-admin/firestore";
import { DEFAULT_NUMBERING_CONFIG } from "../controllers/proposal-numbering";
import {
  allocateProposalNumberInTransaction,
  readNumberingConfig,
  saveNumberingConfig,
} from "./proposal-numbering.service";

const NOW = Timestamp.fromDate(new Date("2026-09-09T12:00:00.000Z"));

const LIGADA = {
  ...DEFAULT_NUMBERING_CONFIG,
  enabled: true,
  digits: 5,
  pracas: ["SP", "RJ"],
  defaultPraca: "SP",
  nextNumber: 185,
  year: 2026,
};

function fakeTransaction(): Transaction {
  return { set, get } as unknown as Transaction;
}

beforeEach(() => {
  jest.clearAllMocks();
  doc.mockReturnValue({ id: "ref" } as never);
  collection.mockReturnValue({ doc } as never);
});

describe("allocateProposalNumberInTransaction", () => {
  it("monta o codigo do cliente e avanca o contador", () => {
    const alocado = allocateProposalNumberInTransaction({
      t: fakeTransaction(),
      tenantId: "t1",
      config: LIGADA,
      praca: "SP",
      now: NOW,
    });

    expect(alocado).toMatchObject({
      proposalNumber: 185,
      proposalYear: 2026,
      proposalPraca: "SP",
      proposalCode: "0018526SP",
    });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][1]).toMatchObject({ nextNumber: 186, year: 2026 });
  });

  it("nao escreve nada com a numeracao desligada", () => {
    const alocado = allocateProposalNumberInTransaction({
      t: fakeTransaction(),
      tenantId: "t1",
      config: { ...LIGADA, enabled: false },
      praca: "SP",
      now: NOW,
    });

    // Quem nao pediu numeracao nao ganha campo nenhum, nem um contador.
    expect(alocado).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it("normaliza a praca antes de comparar com a lista", () => {
    const alocado = allocateProposalNumberInTransaction({
      t: fakeTransaction(),
      tenantId: "t1",
      config: LIGADA,
      praca: " rj ",
      now: NOW,
    });

    expect(alocado?.proposalCode).toBe("0018526RJ");
  });

  it("cai na praca padrao quando a pedida nao esta na lista", () => {
    // Uma sigla livre produziria um codigo que a propria empresa nao reconhece.
    const alocado = allocateProposalNumberInTransaction({
      t: fakeTransaction(),
      tenantId: "t1",
      config: LIGADA,
      praca: "MG",
      now: NOW,
    });

    expect(alocado?.proposalPraca).toBe("SP");
  });

  it("fica sem praca quando a empresa nao configurou nenhuma", () => {
    const alocado = allocateProposalNumberInTransaction({
      t: fakeTransaction(),
      tenantId: "t1",
      config: { ...LIGADA, pracas: [], defaultPraca: null },
      praca: "SP",
      now: NOW,
    });

    expect(alocado?.proposalPraca).toBeNull();
    expect(alocado?.proposalCode).toBe("0018526");
  });
});

describe("saveNumberingConfig", () => {
  function mockTransacao(atual: Record<string, unknown> | undefined) {
    runTransaction.mockImplementation(async (fn: (t: Transaction) => unknown) => {
      get.mockResolvedValue({ data: () => atual });
      return fn(fakeTransaction());
    });
  }

  it("mescla sobre o gravado em vez de rebobinar o contador", async () => {
    // O payload so traz a lista de pracas. Sem a mesclagem, `nextNumber`
    // cairia no default 1 e a proxima proposta nasceria com um codigo que ja
    // foi entregue a um cliente.
    mockTransacao(LIGADA);

    const config = await saveNumberingConfig("t1", { pracas: ["SP", "RJ", "MG"] });

    expect(config.nextNumber).toBe(185);
    expect(config.pracas).toEqual(["SP", "RJ", "MG"]);
    expect(config.enabled).toBe(true);
  });

  it("aceita comecar de onde a empresa ja estava", async () => {
    mockTransacao(undefined);

    const config = await saveNumberingConfig("t1", {
      enabled: true,
      nextNumber: 186,
      pracas: ["SP"],
      defaultPraca: "SP",
    });

    expect(config.nextNumber).toBe(186);
    expect(config.enabled).toBe(true);
  });

  it("descarta a praca padrao que saiu da lista", async () => {
    mockTransacao({ ...LIGADA, defaultPraca: "RJ" });

    const config = await saveNumberingConfig("t1", { pracas: ["SP"] });

    expect(config.defaultPraca).toBeNull();
  });
});

describe("readNumberingConfig", () => {
  it("devolve a configuracao desligada quando nada foi gravado", async () => {
    doc.mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => undefined }) } as never);

    const config = await readNumberingConfig("t1");

    expect(config.enabled).toBe(false);
    expect(config.pracas).toEqual([]);
  });
});
