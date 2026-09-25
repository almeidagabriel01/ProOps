import { describe, expect, it } from "vitest";
import { clientToRecord, proposalToRecord } from "../record-search";

describe("proposalToRecord", () => {
  it("leva à proposta e mostra código e cliente", () => {
    expect(
      proposalToRecord({
        id: "p1",
        title: "Casa do João",
        clientName: "João",
        proposalCode: "0018926SP",
      }),
    ).toEqual({
      kind: "proposal",
      id: "p1",
      label: "Casa do João",
      description: "0018926SP · João",
      path: "/proposals/p1",
    });
  });

  it("proposta sem título nem cliente ainda aparece", () => {
    const record = proposalToRecord({ id: "p2", title: "  " });
    expect(record.label).toBe("Proposta sem título");
    expect(record.description).toBeUndefined();
  });
});

describe("clientToRecord", () => {
  it("leva ao contato e mostra o e-mail, ou o telefone na falta dele", () => {
    expect(clientToRecord({ id: "c1", name: "Ana", email: "ana@x.com" })).toMatchObject({
      path: "/contacts/c1",
      description: "ana@x.com",
    });
    expect(clientToRecord({ id: "c2", name: "Bia", phone: "11999" }).description).toBe(
      "11999",
    );
  });
});
