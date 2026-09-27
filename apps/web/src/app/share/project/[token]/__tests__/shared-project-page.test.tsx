// @vitest-environment jsdom
/**
 * A página da entrega mostra ao cliente a data marcada de cada etapa que
 * ainda não terminou; etapa concluída não repete a visita.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => ({ token: "tok" }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../_components/delivery-acceptance", () => ({ DeliveryAcceptance: () => null }));
vi.mock("@/services/projects-service", () => ({
  SharedProjectService: { get: (...a: unknown[]) => m.get(...a) },
}));

import SharedProjectPage from "../page";

const local = (y: number, mo: number, d: number, h = 0) => new Date(y, mo - 1, d, h).toISOString();
const visit = (h: number) => ({
  isAllDay: false,
  startsAt: local(2026, 10, 21, h),
  endsAt: local(2026, 10, 21, h + 3),
  startDate: null,
  endDate: null,
});

beforeEach(() => {
  m.get.mockResolvedValue({
    tenant: { name: "Casa Inteligente", logoUrl: null, primaryColor: null },
    project: {
      title: "Casa da Maria",
      clientName: "Maria",
      address: null,
      status: "active",
      delivery: { status: "sent", acceptance: null },
      stages: [
        { id: "s1", name: "Medição", status: "done", completedAt: "2026-10-01", schedule: visit(8), checklist: [], photos: [] },
        { id: "s2", name: "Instalação", status: "pending", completedAt: null, schedule: visit(9), checklist: [], photos: [] },
        { id: "s3", name: "Entrega", status: "pending", completedAt: null, schedule: null, checklist: [], photos: [] },
      ],
    },
  });
});

describe("entrega da obra", () => {
  it("mostra a visita da etapa em aberto, e não a da etapa concluída", async () => {
    render(<SharedProjectPage />);
    expect(await screen.findByText("qua, 21/10, 09:00 às 12:00")).toBeInTheDocument();
    expect(screen.queryByText("qua, 21/10, 08:00 às 11:00")).toBeNull();
    expect(screen.getAllByText("Visita marcada:")).toHaveLength(1);
  });
});
