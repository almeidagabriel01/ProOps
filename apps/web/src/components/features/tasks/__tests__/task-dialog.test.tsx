// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/tasks-service", () => ({
  TasksService: {
    create: (...a: unknown[]) => m.create(...a),
    update: (...a: unknown[]) => m.update(...a),
    remove: vi.fn(),
  },
}));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({ id, value, onChange }: { id: string; value: string; onChange: (e: unknown) => void }) => (
    <input id={id} value={value} onChange={onChange} />
  ),
}));

import { TaskDialog } from "../task-dialog";

const people = [
  { id: "eu", name: "Eu Mesma" },
  { id: "beto", name: "Beto Souza" },
  { id: "carla", name: "Carla" },
];

function renderDialog(props: Partial<React.ComponentProps<typeof TaskDialog>> = {}) {
  const onSaved = vi.fn();
  render(
    <TaskDialog
      open
      onOpenChange={vi.fn()}
      people={people}
      currentUserId="eu"
      canEdit
      canDelete
      onSaved={onSaved}
      {...props}
    />,
  );
  return { onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.create.mockImplementation(async (input: Record<string, unknown>) => ({ id: "novo", ...input }));
});

describe("nova tarefa", () => {
  it("nasce com quem cria como responsável e leva o vínculo do contexto", async () => {
    renderDialog({ context: { clientId: "c1", clientName: "Cliente Um" } });
    expect(screen.getByText("Contato: Cliente Um")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsável")).toHaveValue("eu");

    await userEvent.type(screen.getByLabelText("O que fazer"), "Ligar para confirmar");
    await userEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));

    await waitFor(() => expect(m.create).toHaveBeenCalled());
    expect(m.create.mock.calls[0][0]).toMatchObject({
      title: "Ligar para confirmar",
      assigneeId: "eu",
      clientId: "c1",
      mentionUids: [],
    });
  });

  it("digitar @ abre a equipe (sem a própria pessoa) e escolher cita quem foi escolhido", async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText("O que fazer"), "Medir a sala");
    const notes = screen.getByLabelText("Detalhes");
    await userEvent.type(notes, "Avisar @be");

    const lista = screen.getByRole("listbox", { name: "Pessoas para citar" });
    expect(lista).toHaveTextContent("Beto Souza");
    expect(lista).not.toHaveTextContent("Eu Mesma");

    await userEvent.keyboard("{Enter}");
    expect(notes).toHaveValue("Avisar @Beto Souza ");

    await userEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    await waitFor(() => expect(m.create).toHaveBeenCalled());
    expect(m.create.mock.calls[0][0].mentionUids).toEqual(["beto"]);
  });

  it("apagar o nome do texto desfaz a menção", async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText("O que fazer"), "Medir");
    const notes = screen.getByLabelText("Detalhes");
    await userEvent.type(notes, "@car");
    await userEvent.keyboard("{Enter}");
    await userEvent.clear(notes);
    await userEvent.type(notes, "sem ninguém");
    await userEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    await waitFor(() => expect(m.create).toHaveBeenCalled());
    expect(m.create.mock.calls[0][0].mentionUids).toEqual([]);
  });
});

describe("tarefa existente", () => {
  const existente = {
    id: "k1",
    tenantId: "t1",
    title: "Da Carla",
    notes: null,
    dueAt: null,
    assigneeId: "carla",
    assigneeName: "Carla",
    mentionUids: [],
    clientId: null,
    clientName: null,
    proposalId: null,
    proposalTitle: null,
    leadId: null,
    leadName: null,
    doneAt: null,
    doneBy: null,
    createdBy: "carla",
    createdByName: "Carla",
    createdAt: null,
    updatedAt: null,
  };

  it("sem permissão de editar, abre só para ler", () => {
    renderDialog({ task: existente, canEdit: false });
    expect(screen.getByLabelText("O que fazer")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("membro não exclui tarefa que não criou; o dono exclui", () => {
    const { unmount } = render(
      <TaskDialog open onOpenChange={vi.fn()} people={people} currentUserId="eu" canEdit canDelete task={existente} onSaved={vi.fn()} onDeleted={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
    unmount();
    render(
      <TaskDialog open onOpenChange={vi.fn()} people={people} currentUserId="eu" canEdit canDelete isAdmin task={existente} onSaved={vi.fn()} onDeleted={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Excluir/ })).toBeInTheDocument();
  });
});
