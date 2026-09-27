// @vitest-environment jsdom
/**
 * A visita da etapa na tela da obra: quem edita marca, remarca e desmarca;
 * quem só lê (membro sem edição, conta de demonstração) vê a data e nenhum
 * botão; etapa concluída sem visita não mostra nada.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  schedule: vi.fn(),
  unschedule: vi.fn(),
}));

vi.mock("@/lib/image-downscale", () => ({ downscaleCatalogImage: async (f: File) => f }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/projects-service", () => ({
  ProjectsService: {
    scheduleStage: (...a: unknown[]) => m.schedule(...a),
    unscheduleStage: (...a: unknown[]) => m.unschedule(...a),
    toggleChecklistItem: vi.fn(),
    uploadPhoto: vi.fn(),
    addChecklistItem: vi.fn(),
    deleteChecklistItem: vi.fn(),
    deletePhoto: vi.fn(),
  },
}));

import { StageCard } from "../stage-card";
import type { ProjectStage } from "@/types/project";

const local = (y: number, mo: number, d: number, h = 0) => new Date(y, mo - 1, d, h).toISOString();

const base: ProjectStage = {
  id: "s1",
  name: "Instalação",
  status: "pending",
  checklist: [],
  photos: [],
  completedAt: null,
};

const scheduled: ProjectStage = {
  ...base,
  schedule: {
    eventId: "ev1",
    isAllDay: false,
    startsAt: local(2026, 10, 21, 8),
    endsAt: local(2026, 10, 21, 11),
    startDate: null,
    endDate: null,
    startMs: Date.parse(local(2026, 10, 21, 8)),
    endMs: Date.parse(local(2026, 10, 21, 11)),
  },
};

const handlers = { onToggleItem: vi.fn(), onStageStatus: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  m.schedule.mockResolvedValue({ schedule: null });
  m.unschedule.mockResolvedValue({ success: true });
});

describe("visita da etapa", () => {
  it("sem visita, quem edita vê o convite para marcar", () => {
    render(<StageCard {...handlers} projectId="p1" stage={base} index={0} canEdit />);
    expect(screen.getByText("Sem visita marcada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar visita" })).toBeInTheDocument();
  });

  it("com visita: a data, remarcar e desmarcar", () => {
    render(<StageCard {...handlers} projectId="p1" stage={scheduled} index={0} canEdit />);
    expect(screen.getByText("qua, 21/10, 08:00 às 11:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remarcar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desmarcar" })).toBeInTheDocument();
  });

  it("quem só lê (membro sem edição, demonstração) vê a data e nenhum botão", () => {
    render(<StageCard {...handlers} projectId="p1" stage={scheduled} index={0} canEdit={false} />);
    expect(screen.getByText("qua, 21/10, 08:00 às 11:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remarcar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desmarcar" })).toBeNull();
  });

  it("quem só lê, sem visita: nada de convite", () => {
    render(<StageCard {...handlers} projectId="p1" stage={base} index={0} canEdit={false} />);
    expect(screen.queryByText("Sem visita marcada")).toBeNull();
  });

  it("etapa concluída sem visita não pede para marcar", () => {
    render(<StageCard {...handlers} projectId="p1" stage={{ ...base, status: "done" }} index={0} canEdit />);
    expect(screen.queryByRole("button", { name: "Marcar visita" })).toBeNull();
  });

  it("marcar manda data, início e fim pela duração, e cita o técnico", async () => {
    render(
      <StageCard {...handlers} projectId="p1" stage={scheduled} index={0} canEdit assigneeName="Carlos" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remarcar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Carlos recebe um aviso/)).toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText("Duração"), "240");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remarcar" }));

    expect(m.schedule).toHaveBeenCalledWith("p1", "s1", {
      isAllDay: false,
      startsAt: local(2026, 10, 21, 8),
      endsAt: local(2026, 10, 21, 12),
    });
  });

  it("dia inteiro manda só as datas", async () => {
    render(<StageCard {...handlers} projectId="p1" stage={scheduled} index={0} canEdit />);
    await userEvent.click(screen.getByRole("button", { name: "Remarcar" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("switch", { name: "Dia inteiro" }));
    expect(within(dialog).queryByLabelText("Início")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remarcar" }));

    expect(m.schedule).toHaveBeenCalledWith("p1", "s1", {
      isAllDay: true,
      startDate: "2026-10-21",
      endDate: "2026-10-22",
    });
  });

  it("desmarcar pede confirmação antes de tirar da Agenda", async () => {
    render(<StageCard {...handlers} projectId="p1" stage={scheduled} index={0} canEdit />);
    await userEvent.click(screen.getByRole("button", { name: "Desmarcar" }));
    expect(m.unschedule).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Desmarcar" }));
    expect(m.unschedule).toHaveBeenCalledWith("p1", "s1");
  });
});
