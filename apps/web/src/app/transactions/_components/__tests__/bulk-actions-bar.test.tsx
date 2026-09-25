// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkActionsBar } from "../bulk-actions-bar";

function renderBar(props: Partial<React.ComponentProps<typeof BulkActionsBar>> = {}) {
  const handlers = {
    onMarkPaid: vi.fn(async () => {}),
    onExport: vi.fn(async () => {}),
    onDelete: vi.fn(),
  };
  render(
    <BulkActionsBar
      selectedCount={3}
      payableCount={2}
      deletableCount={3}
      skippedProposalCount={0}
      canEdit
      canDelete
      isBusy={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("BulkActionsBar", () => {
  it("não aparece sem seleção", () => {
    renderBar({ selectedCount: 0 });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("marcar como pago pede confirmação com a contagem", async () => {
    const { onMarkPaid } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /marcar como pago/i }));
    expect(onMarkPaid).not.toHaveBeenCalled();
    expect(screen.getByText("Marcar 2 lançamentos como pagos?")).toBeInTheDocument();

    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(
      Array.from(dialog.querySelectorAll("button")).find((b) =>
        /marcar como pago/i.test(b.textContent ?? ""),
      )!,
    );
    expect(onMarkPaid).toHaveBeenCalledTimes(1);
  });

  it("excluir pede confirmação e avisa os lançamentos de proposta que ficam de fora", async () => {
    const { onDelete } = renderBar({ deletableCount: 2, skippedProposalCount: 1 });
    await userEvent.click(screen.getByRole("button", { name: /^excluir$/i }));
    expect(screen.getByText("Excluir 2 lançamentos?")).toBeInTheDocument();
    expect(screen.getByText(/1 lançamento de proposta fica de fora/i)).toBeInTheDocument();

    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent === "Excluir",
      )!,
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("exportar não pede confirmação", async () => {
    const { onExport } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("sem permissão de edição ou exclusão, sobra só exportar", () => {
    renderBar({ canEdit: false, canDelete: false });
    expect(screen.queryByRole("button", { name: /marcar como pago/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^excluir$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /exportar excel/i })).toBeInTheDocument();
  });

  it("esconde marcar como pago quando todos já estão pagos", () => {
    renderBar({ payableCount: 0 });
    expect(screen.queryByRole("button", { name: /marcar como pago/i })).toBeNull();
  });
});
