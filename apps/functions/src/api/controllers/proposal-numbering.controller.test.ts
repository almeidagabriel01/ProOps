/**
 * Contrato HTTP da numeracao.
 *
 * O que este arquivo existe para impedir e um defeito que so aparece no
 * SEGUNDO salvamento: a tela guarda a resposta do `PUT` no estado e a reenvia
 * no salvamento seguinte, entao qualquer campo a mais na resposta volta como
 * chave desconhecida e o schema `.strict()` responde 400. O primeiro
 * salvamento passa, o segundo quebra, e o erro que chega ao usuario e
 * `Unrecognized key: "success"` — que foi exatamente o que aconteceu.
 *
 * Dai a regra: o `PUT` responde a MESMA forma do `GET`, sem envelope.
 */

import type { Request, Response } from "express";

const resolveUserAndTenant = jest.fn();
const readNumberingConfig = jest.fn();
const saveNumberingConfig = jest.fn();

jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: (...args: unknown[]) =>
    resolveUserAndTenant(...(args as [])),
}));

jest.mock("../services/proposal-numbering.service", () => ({
  readNumberingConfig: (...args: unknown[]) =>
    readNumberingConfig(...(args as [])),
  saveNumberingConfig: (...args: unknown[]) =>
    saveNumberingConfig(...(args as [])),
}));

import {
  getProposalNumbering,
  updateProposalNumbering,
} from "./proposal-numbering.controller";

const CONFIG = {
  enabled: true,
  digits: 5,
  resetYearly: false,
  pracas: ["SP", "RJ"],
  defaultPraca: "SP",
  nextNumber: 186,
  year: 2026,
};

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function fakeReq(body: unknown) {
  return { body, user: { uid: "u1" } } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  resolveUserAndTenant.mockResolvedValue({
    tenantId: "t1",
    isMaster: true,
    isSuperAdmin: false,
  });
  readNumberingConfig.mockResolvedValue(CONFIG);
  saveNumberingConfig.mockResolvedValue(CONFIG);
});

describe("PUT /v1/proposals/numbering", () => {
  it("responde a configuracao pura, sem envelope de sucesso", async () => {
    const res = fakeRes();
    await updateProposalNumbering(fakeReq({ enabled: true }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(CONFIG);
    expect(Object.keys(res.body as object)).not.toContain("success");
  });

  it("aceita de volta a propria resposta: salvar duas vezes seguidas", async () => {
    const primeira = fakeRes();
    await updateProposalNumbering(fakeReq({ enabled: true }), primeira);

    // É o que a tela faz: guarda a resposta e reenvia no próximo salvamento.
    const segunda = fakeRes();
    await updateProposalNumbering(fakeReq(primeira.body), segunda);

    expect(segunda.statusCode).toBe(200);
    expect(segunda.body).toEqual(CONFIG);
  });

  it("aceita de volta o que o GET devolveu", async () => {
    const lido = fakeRes();
    await getProposalNumbering(fakeReq(undefined), lido);

    const salvo = fakeRes();
    await updateProposalNumbering(fakeReq(lido.body), salvo);

    expect(salvo.statusCode).toBe(200);
  });

  it("recusa chave desconhecida com 400", async () => {
    const res = fakeRes();
    await updateProposalNumbering(fakeReq({ enabled: true, foo: 1 }), res);

    expect(res.statusCode).toBe(400);
    expect(saveNumberingConfig).not.toHaveBeenCalled();
  });

  it("recusa percentual de digitos fora da faixa", async () => {
    const res = fakeRes();
    await updateProposalNumbering(fakeReq({ digits: 99 }), res);

    expect(res.statusCode).toBe(400);
  });

  it("nega escrita a quem nao e master", async () => {
    resolveUserAndTenant.mockResolvedValue({
      tenantId: "t1",
      isMaster: false,
      isSuperAdmin: false,
    });

    const res = fakeRes();
    await updateProposalNumbering(fakeReq({ enabled: true }), res);

    expect(res.statusCode).toBe(403);
    expect(saveNumberingConfig).not.toHaveBeenCalled();
  });

  it("valida o corpo ANTES de resolver o tenant", async () => {
    // Um corpo malformado nao deve custar uma leitura de usuario.
    const res = fakeRes();
    await updateProposalNumbering(fakeReq({ foo: 1 }), res);

    expect(res.statusCode).toBe(400);
    expect(resolveUserAndTenant).not.toHaveBeenCalled();
  });
});

describe("GET /v1/proposals/numbering", () => {
  it("responde a configuracao do tenant", async () => {
    const res = fakeRes();
    await getProposalNumbering(fakeReq(undefined), res);

    expect(res.body).toEqual(CONFIG);
    expect(readNumberingConfig).toHaveBeenCalledWith("t1");
  });

  it("nao exige master: o formulario precisa da lista de pracas", async () => {
    resolveUserAndTenant.mockResolvedValue({
      tenantId: "t1",
      isMaster: false,
      isSuperAdmin: false,
    });

    const res = fakeRes();
    await getProposalNumbering(fakeReq(undefined), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(CONFIG);
  });
});
