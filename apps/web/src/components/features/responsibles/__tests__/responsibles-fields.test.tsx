// @vitest-environment jsdom
/**
 * Quem cuida do cliente: um responsável da equipe e os parceiros externos,
 * escolhidos um a um e retirados pelo X.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@/services/client-service";
import { PartnerContactsField, ResponsibleMemberField } from "../responsibles-fields";

const partner = (id: string, name: string, types: Client["types"]) =>
  ({ id, name, types }) as Client;

const partners = [
  partner("arq", "Ana Arquiteta", ["arquiteto"]),
  partner("ven", "Bruno Vendas", ["vendedor"]),
  partner("eu-mesmo", "O próprio contato", ["cliente", "arquiteto"]),
];

describe("ResponsibleMemberField", () => {
  it("escolhe e limpa o responsável da equipe", async () => {
    const onChange = vi.fn();
    render(
      <ResponsibleMemberField
        id="resp"
        value={null}
        people={[{ id: "ana", name: "Ana" }]}
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText("Responsável da equipe");
    expect(select).toHaveValue("");
    await userEvent.selectOptions(select, "ana");
    expect(onChange).toHaveBeenCalledWith("ana");
  });
});

describe("PartnerContactsField", () => {
  it("adiciona um parceiro, mostrando o papel, e tira pelo X", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PartnerContactsField id="p" value={[]} partners={partners} onChange={onChange} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Adicionar parceiro externo"), "arq");
    expect(onChange).toHaveBeenLastCalledWith(["arq"]);

    rerender(<PartnerContactsField id="p" value={["arq"]} partners={partners} onChange={onChange} />);
    expect(screen.getByText("Ana Arquiteta (arquiteto)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tirar Ana Arquiteta" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("o próprio contato e quem já foi escolhido não aparecem para adicionar", () => {
    render(
      <PartnerContactsField
        id="p"
        value={["arq"]}
        partners={partners}
        excludeContactId="eu-mesmo"
        onChange={vi.fn()}
      />,
    );
    const options = Array.from(
      (screen.getByLabelText("Adicionar parceiro externo") as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toEqual(["", "ven"]);
  });

  it("sem parceiros cadastrados explica o que falta", () => {
    render(<PartnerContactsField id="p" value={[]} partners={[]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Adicionar parceiro externo")).toBeDisabled();
    expect(screen.getAllByText("Nenhum vendedor ou arquiteto cadastrado").length).toBeGreaterThan(0);
  });

  it("desabilitado (somente leitura) não mostra o X", () => {
    render(<PartnerContactsField id="p" value={["arq"]} partners={partners} onChange={vi.fn()} disabled />);
    expect(screen.queryByRole("button", { name: /Tirar/ })).toBeNull();
  });
});
