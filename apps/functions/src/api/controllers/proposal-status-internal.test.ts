/**
 * Aprovar pela Lia gravava o status direto e pulava financeiro, projeto da
 * obra, entrega no Drive e a data da aprovação. Agora passa pelo mesmo
 * `updateProposal` da tela.
 */

const updateProposal = jest.fn();
jest.mock("./proposals.controller", () => ({
  updateProposal: (...a: unknown[]) => updateProposal(...a),
}));

const validateProposalStatusChange = jest.fn();
const saveRejectionReason = jest.fn();
jest.mock("../services/proposals.service", () => ({
  validateProposalStatusChange: (...a: unknown[]) => validateProposalStatusChange(...a),
  saveRejectionReason: (...a: unknown[]) => saveRejectionReason(...a),
}));

import { changeProposalStatusAsUser } from "./proposal-status-internal";

const actor = { uid: "ana", role: "member", tenantId: "t1" };

beforeEach(() => {
  jest.clearAllMocks();
  validateProposalStatusChange.mockResolvedValue({ oldStatus: "sent" });
  updateProposal.mockImplementation(async (_req, res) => res.json({ success: true }));
});

it("aprovar pela Lia roda o updateProposal da tela, como quem pediu (o caso relatado)", async () => {
  const result = await changeProposalStatusAsUser(actor, "p1", "approved");

  expect(result).toEqual({ id: "p1", oldStatus: "sent", newStatus: "approved" });
  expect(updateProposal).toHaveBeenCalledTimes(1);
  const [req] = updateProposal.mock.calls[0];
  expect(req.params).toEqual({ id: "p1" });
  expect(req.body).toEqual({ status: "approved" });
  expect(req.user).toMatchObject({ uid: "ana", role: "MEMBER", tenantId: "t1", isSuperAdmin: false });
});

it("enviar também passa pelo mesmo caminho", async () => {
  validateProposalStatusChange.mockResolvedValue({ oldStatus: "draft" });
  await changeProposalStatusAsUser(actor, "p1", "sent");
  expect(updateProposal.mock.calls[0][0].body).toEqual({ status: "sent" });
});

it("recusa guarda o motivo depois de mudar o status", async () => {
  await changeProposalStatusAsUser(actor, "p1", "rejected", "Achou caro");
  expect(updateProposal).toHaveBeenCalled();
  expect(saveRejectionReason).toHaveBeenCalledWith("p1", "Achou caro");
});

it("transição que a Lia não pode fazer não chega a gravar nada", async () => {
  validateProposalStatusChange.mockRejectedValue(new Error("Transição de status inválida"));
  await expect(changeProposalStatusAsUser(actor, "p1", "draft")).rejects.toThrow("Transição");
  expect(updateProposal).not.toHaveBeenCalled();
});

it("o controller recusou (sem permissão): a Lia recebe a mesma mensagem da tela", async () => {
  updateProposal.mockImplementation(async (_req, res) =>
    res.status(403).json({ message: "Sem permissão para editar propostas." }),
  );
  await expect(changeProposalStatusAsUser(actor, "p1", "approved")).rejects.toThrow(
    "Sem permissão para editar propostas.",
  );
  expect(saveRejectionReason).not.toHaveBeenCalled();
});
