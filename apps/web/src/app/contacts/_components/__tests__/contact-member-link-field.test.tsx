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
