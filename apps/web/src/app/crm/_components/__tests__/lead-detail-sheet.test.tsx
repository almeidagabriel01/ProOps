// @vitest-environment jsdom
/**
 * Ficha do lead: o formulário de atividade alinha o seletor de tipo na mesma
 * altura do campo de texto (antes ele usava o tamanho compacto e ficava mais
 * baixo), e quem só vê o CRM não registra atividade.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/services/leads-service", () => ({
  LeadsService: {},
  ActivitiesService: { listByLead: async () => [] },
}));

import { LeadDetailSheet } from "../lead-detail-sheet";

const LEAD = {
  id: "l1",
  name: "Carla",
  phone: null,
  email: null,
  company: null,
  source: "instagram" as const,
  stage: "novo" as const,
  estimatedValue: null,
  notes: null,
  nextAction: null,
  nextActionAt: null,
  lostReason: null,
  clientId: null,
  ownerId: null,
  ownerName: null,
  createdAt: null,
  updatedAt: null,
};

const noop = () => undefined;

beforeEach(() => vi.clearAllMocks());

describe("LeadDetailSheet", () => {
  it("seletor de tipo com a mesma altura do campo de texto", async () => {
    render(
      <LeadDetailSheet lead={LEAD} canEdit canDelete onClose={noop} onEdit={noop} onChanged={noop} onDeleted={noop} />,
    );
    await screen.findByText("Nenhuma atividade registrada.");

    const select = screen.getByLabelText("Tipo de atividade");
    const trigger = select.nextElementSibling as HTMLElement;
    expect(trigger).toHaveClass("h-12");
    expect(trigger).not.toHaveClass("h-9");
    expect(screen.getByPlaceholderText("O que foi feito ou o que fazer")).toHaveClass("h-12");
  });

  it("quem só vê não tem o formulário de atividade", async () => {
    render(
      <LeadDetailSheet
        lead={LEAD}
        canEdit={false}
        canDelete={false}
        onClose={noop}
        onEdit={noop}
        onChanged={noop}
        onDeleted={noop}
      />,
    );
    await screen.findByText("Nenhuma atividade registrada.");
    expect(screen.queryByLabelText("Tipo de atividade")).toBeNull();
    expect(screen.queryByRole("button", { name: /Converter/ })).toBeNull();
  });
});
