// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasSalesGoals: true },
  sellers: vi.fn(),
}));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/services/sales-goals-service", () => ({
  SalesGoalsService: { sellers: (...a: unknown[]) => m.sellers(...a) },
}));

import { ContactMemberLinkField } from "../contact-member-link-field";

beforeEach(() => {
  vi.clearAllMocks();
  m.plan = { hasSalesGoals: true };
  m.sellers.mockResolvedValue([{ id: "u-ana", name: "Ana" }]);
});

describe("É da equipe?", () => {
  it("vendedor: liga a um membro da equipe", async () => {
    const onChange = vi.fn();
    render(<ContactMemberLinkField types={["vendedor"]} value={null} onChange={onChange} />);
    const select = await screen.findByLabelText("É da equipe?");
    expect(select).toHaveValue("");
    await userEvent.selectOptions(select, "u-ana");
    expect(onChange).toHaveBeenCalledWith("u-ana");
  });

  it("o rótulo fica sozinho na linha, sem dica ao lado (senão quebra em duas linhas)", async () => {
    render(<ContactMemberLinkField types={["vendedor"]} value={null} onChange={vi.fn()} />);
    const label = await screen.findByText("É da equipe?");
    expect(label.parentElement?.children).toHaveLength(1);
    expect(screen.getByText(/a comissão dele entra sozinha/)).toBeInTheDocument();
  });

  it("arquiteto e cliente não têm o campo: são parceiros externos", () => {
    const { container, rerender } = render(
      <ContactMemberLinkField types={["arquiteto"]} value={null} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<ContactMemberLinkField types={["cliente"]} value={null} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(m.sellers).not.toHaveBeenCalled();
  });

  it("sem o plano de metas não aparece", () => {
    m.plan = { hasSalesGoals: false };
    const { container } = render(
      <ContactMemberLinkField types={["vendedor"]} value={null} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("layout: divide a linha com o nome só quando aparece", () => {
  it("vendedor com plano de metas: aparece (a página divide a linha)", async () => {
    const { showsMemberLink } = await import("../contact-member-link-field");
    expect(showsMemberLink(["vendedor"], true)).toBe(true);
    expect(showsMemberLink(["cliente", "vendedor"], true)).toBe(true);
  });

  it("sem vendedor ou sem plano: não aparece (o nome ocupa a linha toda)", async () => {
    const { showsMemberLink } = await import("../contact-member-link-field");
    expect(showsMemberLink(["arquiteto"], true)).toBe(false);
    expect(showsMemberLink(["vendedor"], false)).toBe(false);
  });

  it("enquanto a equipe carrega, o campo existe desabilitado (não some e não desmonta a linha)", async () => {
    let resolve!: (v: unknown) => void;
    m.sellers.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ContactMemberLinkField types={["vendedor"]} value={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText("É da equipe?")).toBeDisabled();
    resolve([{ id: "u-ana", name: "Ana" }]);
    await vi.waitFor(() => expect(screen.getByLabelText("É da equipe?")).not.toBeDisabled());
  });
});
