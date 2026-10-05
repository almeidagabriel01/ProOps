/**
 * "Está em alguma proposta?" antes de excluir contato, produto ou serviço.
 *
 * A consulta era direta no Firestore, e as rules passaram a exigir a
 * permissão de ver propostas: o membro que cuida do catálogo ou dos contatos
 * levava "permission-denied" e via a exclusão recusada como se o item
 * estivesse em uso. Agora passa pela API (`GET /v1/proposals/usage`), que
 * devolve só o booleano. O critério do índice `productRefs` mora no backend
 * (`proposal-usage.controller.test.ts`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const callApiMock = vi.fn();
const getDocsMock = vi.fn();
const countMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  startAfter: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: (...a: unknown[]) => getDocsMock(...a),
  getCountFromServer: (...a: unknown[]) => countMock(...a),
  getAggregateFromServer: vi.fn(),
  sum: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: (...a: unknown[]) => callApiMock(...a) }));

import { ProposalService } from "../proposal-service";

beforeEach(() => {
  callApiMock.mockReset();
  getDocsMock.mockReset();
  countMock.mockReset();
});

describe("isProductUsedInProposal", () => {
  it("pergunta à API e não lê proposta pelo SDK", async () => {
    callApiMock.mockResolvedValueOnce({ used: true });

    await expect(ProposalService.isProductUsedInProposal("p1", "t1")).resolves.toBe(true);
    expect(callApiMock).toHaveBeenCalledWith("/v1/proposals/usage?kind=product&id=p1");
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(countMock).not.toHaveBeenCalled();
  });

  it("serviço vai com kind=service", async () => {
    callApiMock.mockResolvedValueOnce({ used: false });
    await expect(ProposalService.isProductUsedInProposal("s1", "t1", "service")).resolves.toBe(false);
    expect(callApiMock).toHaveBeenCalledWith("/v1/proposals/usage?kind=service&id=s1");
  });

  it("falha na verificação bloqueia a exclusão", async () => {
    callApiMock.mockRejectedValueOnce(new Error("offline"));
    await expect(ProposalService.isProductUsedInProposal("p1", "t1")).resolves.toBe(true);
  });

  it("sem id não consulta nada", async () => {
    await expect(ProposalService.isProductUsedInProposal("", "t1")).resolves.toBe(false);
    expect(callApiMock).not.toHaveBeenCalled();
  });
});

describe("isClientUsedInProposal", () => {
  it("pergunta à API com kind=client", async () => {
    callApiMock.mockResolvedValueOnce({ used: false });
    await expect(ProposalService.isClientUsedInProposal("c1", "t1")).resolves.toBe(false);
    expect(callApiMock).toHaveBeenCalledWith("/v1/proposals/usage?kind=client&id=c1");
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it("falha na verificação bloqueia a exclusão", async () => {
    callApiMock.mockRejectedValueOnce(new Error("403"));
    await expect(ProposalService.isClientUsedInProposal("c1", "t1")).resolves.toBe(true);
  });
});
