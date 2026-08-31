// @vitest-environment jsdom
/**
 * "Emitir NF" precisa existir no menu compacto.
 *
 * O bug: abaixo de 1701px a linha esconde os botões individuais e o menu
 * (`showAllActions`) passa a ser a ÚNICA superfície de ações — mas ele reunia
 * todas menos a emissão, que só existia no ramo largo. Quem trabalha no celular
 * não conseguia emitir nota de uma proposta ganha, sem nenhum sinal do porquê.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalActionsDropdown } from "../proposal-actions-dropdown";
import type { Proposal } from "@/types/proposal";

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const PROPOSAL = { id: "p1", status: "approved", attachments: [] } as unknown as Proposal;

function renderDropdown(props: Record<string, unknown> = {}) {
  return render(
    <ProposalActionsDropdown
      proposal={PROPOSAL}
      canEdit
      canCreate
      canDelete
      canGeneratePdf
      onShare={vi.fn()}
      onDuplicate={vi.fn()}
      onAttachments={vi.fn()}
      {...props}
    />,
  );
}

async function openMenu() {
  await userEvent.click(screen.getByTitle("Mais ações"));
}

describe("ProposalActionsDropdown — Emitir NF", () => {
  it("oferece Emitir NF no menu compacto de uma proposta ganha", async () => {
    const onIssueInvoice = vi.fn();
    renderDropdown({ showAllActions: true, canIssueInvoice: true, onIssueInvoice });

    await openMenu();
    const item = screen.getByText("Emitir NF");
    await userEvent.click(item);

    expect(onIssueInvoice).toHaveBeenCalledTimes(1);
  });

  it("não oferece emissão numa proposta que ainda não foi ganha", async () => {
    renderDropdown({
      showAllActions: true,
      canIssueInvoice: false,
      onIssueInvoice: vi.fn(),
    });

    await openMenu();
    expect(screen.queryByText("Emitir NF")).toBeNull();
  });

  it("não duplica a ação no menu das telas largas, onde o botão já existe", async () => {
    // Sem `showAllActions` a linha mostra o botão inline — repetir aqui daria
    // duas entradas para a mesma coisa lado a lado.
    renderDropdown({ canIssueInvoice: true, onIssueInvoice: vi.fn() });

    await openMenu();
    expect(screen.queryByText("Emitir NF")).toBeNull();
  });

  it("mantém as demais ações do menu compacto", async () => {
    renderDropdown({
      showAllActions: true,
      canIssueInvoice: true,
      onIssueInvoice: vi.fn(),
      onViewPdf: vi.fn(),
      onDownloadPdf: vi.fn(),
      onEditPdf: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });

    await openMenu();
    for (const label of ["Ver PDF", "Baixar PDF", "Emitir NF", "Editar PDF", "Editar", "Compartilhar", "Excluir"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
