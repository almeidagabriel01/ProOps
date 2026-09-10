/**
 * `/proposals/numbering` e um path LITERAL vizinho de `/proposals/:id`.
 *
 * O Express casa por ordem de registro: com a numeracao declarada depois,
 * `PUT /v1/proposals/numbering` cai no `updateProposal` com id "numbering" —
 * que responde 404 "Proposta nao encontrada", uma mensagem que nao aponta para
 * lugar nenhum do problema real. E o mesmo defeito que o relatorio de comissoes
 * teria tido sob `/transactions/:id`.
 *
 * O teste sobe o router de verdade num servidor efemero em vez de espiar
 * `router.stack`: os internos do Express mudam entre versoes maiores, e a
 * pergunta e sobre comportamento.
 */

import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const handler =
  (nome: string) => (_req: express.Request, res: express.Response) =>
    res.json({ handler: nome });

jest.mock("../controllers/products.controller", () => ({
  createProduct: handler("createProduct"),
  updateProduct: handler("updateProduct"),
  deleteProduct: handler("deleteProduct"),
}));

jest.mock("../controllers/services.controller", () => ({
  createService: handler("createService"),
  updateService: handler("updateService"),
  deleteService: handler("deleteService"),
}));

jest.mock("../controllers/clients.controller", () => ({
  createClient: handler("createClient"),
  updateClient: handler("updateClient"),
  deleteClient: handler("deleteClient"),
}));

jest.mock("../controllers/proposals.controller", () => ({
  createProposal: handler("createProposal"),
  updateProposal: handler("updateProposal"),
  deleteProposal: handler("deleteProposal"),
}));

jest.mock("../controllers/proposal-numbering.controller", () => ({
  getProposalNumbering: handler("getProposalNumbering"),
  updateProposalNumbering: handler("updateProposalNumbering"),
}));

jest.mock("../controllers/proposal-pdf.controller", () => ({
  downloadProposalPdf: handler("downloadProposalPdf"),
}));

jest.mock("../middleware/pdf-rate-limiter", () => ({
  pdfRateLimiter: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

jest.mock("../controllers/spreadsheets.controller", () => ({
  createSpreadsheet: handler("createSpreadsheet"),
  updateSpreadsheet: handler("updateSpreadsheet"),
  deleteSpreadsheet: handler("deleteSpreadsheet"),
}));

jest.mock("../controllers/shared-proposals.controller", () => ({
  createShareLink: handler("createShareLink"),
}));

jest.mock("../controllers/tenants.controller", () => ({
  updateTenant: handler("updateTenant"),
}));

jest.mock("../controllers/users.controller", () => ({
  updateProfile: handler("updateProfile"),
}));

import { coreRoutes } from "./core.routes";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Mesmo ponto de montagem do app real (api/index.ts).
  app.use("/v1", coreRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

async function chamar(method: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({}),
  });
  return (await response.json()) as { handler: string };
}

describe("rotas da numeracao de proposta", () => {
  it("le a configuracao pelo controller da numeracao", async () => {
    await expect(chamar("GET", "/v1/proposals/numbering")).resolves.toEqual({
      handler: "getProposalNumbering",
    });
  });

  it("nao e engolida pelo PUT /proposals/:id", async () => {
    await expect(chamar("PUT", "/v1/proposals/numbering")).resolves.toEqual({
      handler: "updateProposalNumbering",
    });
  });

  it("o update de proposta continua funcionando ao lado", async () => {
    await expect(chamar("PUT", "/v1/proposals/abc123")).resolves.toEqual({
      handler: "updateProposal",
    });
  });
});
