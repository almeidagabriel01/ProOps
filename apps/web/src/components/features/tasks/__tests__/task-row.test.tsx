// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "../task-row";
import type { Task } from "@/types/task";

const task: Task = {
  id: "k1",
  tenantId: "t1",
  title: "Medir a sala",
  notes: null,
  dueAt: "2026-09-26",
  assigneeId: null,
  assigneeName: null,
  mentionUids: [],
  clientId: null,
  clientName: null,
  proposalId: null,
  proposalTitle: null,
  leadId: null,
  leadName: null,
  doneAt: null,
  doneBy: null,
  createdBy: "ana",
  createdByName: "Ana",
  createdAt: null,
  updatedAt: null,
};

function renderRow(overrides: Partial<Task> = {}, canEdit = true) {
  const onToggle = vi.fn();
  render(
    <ul>
      <TaskRow task={{ ...task, ...overrides }} today="2026-09-26" canEdit={canEdit} onToggle={onToggle} onOpen={vi.fn()} />
    </ul>,
  );
  return { onToggle };
}

describe("concluir pelo círculo", () => {
  it("pede confirmação e só conclui depois dela", async () => {
    const { onToggle } = renderRow();
    await userEvent.click(screen.getByRole("button", { name: 'Concluir "Medir a sala"' }));
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText("Concluir esta tarefa?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("cancelar a confirmação não conclui", async () => {
    const { onToggle } = renderRow();
    await userEvent.click(screen.getByRole("button", { name: 'Concluir "Medir a sala"' }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("reabrir é direto, sem confirmação", async () => {
    const { onToggle } = renderRow({ doneAt: "2026-09-26T10:00:00Z" });
    await userEvent.click(screen.getByRole("button", { name: 'Reabrir "Medir a sala"' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Concluir esta tarefa?")).toBeNull();
  });

  it("sem permissão de editar, o círculo não faz nada", async () => {
    const { onToggle } = renderRow({}, false);
    expect(screen.getByRole("button", { name: 'Concluir "Medir a sala"' })).toBeDisabled();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
