// @vitest-environment jsdom
/**
 * "Válida até" é obrigatório. A proposta nova já traz o campo preenchido com
 * hoje + a validade padrão da empresa (`/settings/proposals`), em vez de
 * obrigar uma ida ao calendário em toda proposta.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProposalClientSection } from "../proposal-client-section";

vi.mock("@/components/features/client-select", () => ({
  ClientSelect: () => <input aria-label="Contato" />,
}));

const numbering = vi.hoisted(() => ({
  state: {
    config: null as { defaultValidityDays?: number } | null,
    isLoading: false,
  },
}));

vi.mock("@/hooks/useProposalNumbering", () => ({
  useProposalNumbering: () => numbering.state,
}));

function renderSection(props: Record<string, unknown> = {}) {
  const onDefaultValidUntil = vi.fn();
  render(
    <ProposalClientSection
      formData={{ clientName: "" }}
      onFormChange={vi.fn()}
      onClientChange={vi.fn()}
      onDefaultValidUntil={onDefaultValidUntil}
      {...props}
    />,
  );
  return onDefaultValidUntil;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 25, 10, 0));
  numbering.state = { config: null, isLoading: false };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProposalClientSection: validade padrão", () => {
  it("proposta nova recebe hoje + os dias configurados", () => {
    numbering.state = { config: { defaultValidityDays: 15 }, isLoading: false };
    const onDefaultValidUntil = renderSection();
    expect(onDefaultValidUntil).toHaveBeenCalledWith("2026-10-10");
  });

  it("sem configuração (backend antigo ou leitura falhou) usa 30 dias", () => {
    const onDefaultValidUntil = renderSection();
    expect(onDefaultValidUntil).toHaveBeenCalledWith("2026-10-25");
  });

  it("espera a configuração chegar antes de sugerir", () => {
    numbering.state = { config: null, isLoading: true };
    const onDefaultValidUntil = renderSection();
    expect(onDefaultValidUntil).not.toHaveBeenCalled();
  });

  it("não mexe na validade de uma proposta existente", () => {
    const onDefaultValidUntil = renderSection({ isExistingProposal: true });
    expect(onDefaultValidUntil).not.toHaveBeenCalled();
  });

  it("não sobrescreve uma data já escolhida", () => {
    const onDefaultValidUntil = renderSection({
      formData: { clientName: "", validUntil: "2026-12-01" },
    });
    expect(onDefaultValidUntil).not.toHaveBeenCalled();
  });

  it("não sugere nada em modo somente leitura", () => {
    const onDefaultValidUntil = renderSection({ isReadOnly: true });
    expect(onDefaultValidUntil).not.toHaveBeenCalled();
  });
});
