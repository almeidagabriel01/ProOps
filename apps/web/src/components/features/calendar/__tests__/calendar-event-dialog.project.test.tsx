// @vitest-environment jsdom
/**
 * Na Agenda, o evento de uma visita de obra avisa que mudar a data muda a
 * obra, e leva até ela. Evento comum não mostra nada disso.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  CalendarEventDialog,
  buildCalendarFormValuesFromEvent,
} from "../calendar-event-dialog";
import type { CalendarEvent } from "@/types/calendar";

const event: CalendarEvent = {
  id: "ev1",
  tenantId: "t1",
  ownerUserId: "u1",
  createdByUserId: "u1",
  updatedByUserId: "u1",
  title: "Instalação: Casa",
  description: null,
  location: "Rua X, 123",
  status: "scheduled",
  color: "#0891b2",
  isAllDay: false,
  startsAt: "2026-10-21T11:00:00.000Z",
  endsAt: "2026-10-21T14:00:00.000Z",
  startDate: null,
  endDate: null,
  startMs: Date.parse("2026-10-21T11:00:00.000Z"),
  endMs: Date.parse("2026-10-21T14:00:00.000Z"),
  googleSync: { enabled: false, provider: "google", status: "disabled" },
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function renderDialog(value: CalendarEvent) {
  render(
    <CalendarEventDialog
      open
      mode="edit"
      values={buildCalendarFormValuesFromEvent(value)}
      event={value}
      canEdit
      isSubmitting={false}
      isDeleting={false}
      onOpenChange={vi.fn()}
      onChange={vi.fn()}
      onSubmit={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe("evento de visita de obra na Agenda", () => {
  it("avisa e leva à obra", () => {
    renderDialog({ ...event, projectId: "p1", projectStageId: "s1" });
    expect(screen.getByText(/mudar a data aqui muda também na obra/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir obra" })).toHaveAttribute("href", "/projects/p1");
  });

  it("evento comum não fala de obra", () => {
    renderDialog(event);
    expect(screen.queryByRole("link", { name: "Abrir obra" })).toBeNull();
  });
});
