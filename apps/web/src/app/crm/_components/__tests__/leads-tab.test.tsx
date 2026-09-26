// @vitest-environment jsdom
/**
 * Aba de leads do CRM: quem só vê não cria nem arrasta, a conta de
 * demonstração é só leitura, e soltar um lead em "Convertido" pede a
 * conversão (que cria o contato) em vez de só mudar a etapa.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  perms: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  readOnly: false,
  list: vi.fn(),
  update: vi.fn(),
  convert: vi.fn(),
  push: vi.fn(),
  lastBoard: null as null | {
    isDragEnabled?: boolean;
    onDragEnd: (id: string, from: string, to: string) => void;
    columns: { id: string; items: { id: string }[] }[];
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push }),
  useSearchParams: () => ({ get: () => null }),
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1" }, isReadOnly: m.readOnly }),
}));
vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perms }));
vi.mock("@/services/leads-service", () => ({
  LeadsService: {
    list: (...a: unknown[]) => m.list(...a),
    update: (...a: unknown[]) => m.update(...a),
    convert: (...a: unknown[]) => m.convert(...a),
  },
  ActivitiesService: { listByLead: async () => [] },
}));
vi.mock("@/components/features/kanban/kanban-board", () => ({
  KanbanBoard: (props: NonNullable<typeof m.lastBoard> & { renderCard: (i: unknown) => React.ReactNode }) => {
    m.lastBoard = props;
    return (
      <div data-testid="board">
        {props.columns.map((c) => (
          <section key={c.id} aria-label={c.id}>
            {c.items.map((item) => (
              <div key={item.id}>{props.renderCard(item)}</div>
            ))}
          </section>
        ))}
      </div>
    );
  },
}));
vi.mock("@/app/crm/_components/kanban-skeleton", () => ({ KanbanBoardSkeleton: () => <div>carregando</div> }));

import { LeadsTab } from "../leads-tab";

const LEADS = [
  {
    id: "l1",
    name: "Carla Mendes",
    phone: null,
    email: null,
    company: null,
    source: "instagram",
    stage: "qualificado",
    estimatedValue: 18000,
    notes: null,
    nextAction: "Enviar proposta",
    nextActionAt: "2000-01-01",
    lostReason: null,
    clientId: null,
    ownerId: "u1",
    ownerName: "Ana",
    createdAt: "2026-09-01",
    updatedAt: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.perms = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  m.readOnly = false;
  m.lastBoard = null;
  m.list.mockResolvedValue(LEADS.map((l) => ({ ...l })));
});

describe("LeadsTab", () => {
  it("mostra o lead na coluna da etapa, com a ação atrasada em destaque", async () => {
    render(<LeadsTab />);
    expect(await screen.findByText("Carla Mendes")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "qualificado" })).toHaveTextContent("Carla Mendes");
    expect(screen.getByText(/Atrasada:/)).toBeInTheDocument();
    expect(screen.getByText(/1 lead aberto/)).toBeInTheDocument();
    expect(m.list).toHaveBeenCalledWith("t1");
  });

  it("quem só vê não cria nem arrasta", async () => {
    m.perms = { canView: true, canCreate: false, canEdit: false, canDelete: false };
    render(<LeadsTab />);
    await screen.findByText("Carla Mendes");
    expect(screen.queryByRole("button", { name: /Novo lead/ })).toBeNull();
    expect(m.lastBoard?.isDragEnabled).toBe(false);
  });

  it("conta de demonstração é só leitura", async () => {
    m.readOnly = true;
    render(<LeadsTab />);
    await screen.findByText("Carla Mendes");
    expect(screen.queryByRole("button", { name: /Novo lead/ })).toBeNull();
    expect(m.lastBoard?.isDragEnabled).toBe(false);
  });

  it("arrastar muda a etapa pela API e desfaz se falhar", async () => {
    m.update.mockRejectedValue(new Error("falhou"));
    render(<LeadsTab />);
    await screen.findByText("Carla Mendes");

    await React.act(async () => {
      m.lastBoard!.onDragEnd("l1", "qualificado", "contato");
    });
    expect(m.update).toHaveBeenCalledWith("l1", { stage: "contato" });
    expect(screen.getByRole("region", { name: "qualificado" })).toHaveTextContent("Carla Mendes");
  });

  it("soltar em Convertido pede a conversão e leva para a proposta", async () => {
    m.convert.mockResolvedValue({ clientId: "c1", created: true });
    render(<LeadsTab />);
    await screen.findByText("Carla Mendes");

    await React.act(async () => {
      m.lastBoard!.onDragEnd("l1", "qualificado", "convertido");
    });
    expect(m.update).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Converter" }));
    expect(m.convert).toHaveBeenCalledWith("l1");
    expect(m.push).toHaveBeenCalledWith("/proposals/new?clientId=c1");
  });

  it("sem leads mostra o estado vazio com a ação", async () => {
    m.list.mockResolvedValue([]);
    render(<LeadsTab />);
    expect(await screen.findByText("Nenhum lead ainda")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Novo lead/ }).length).toBeGreaterThan(0);
  });
});
