// @vitest-environment jsdom
/**
 * Aprovar pode abrir dois convites: emitir a nota fiscal e criar o projeto da
 * obra. Nunca abrem juntos, e a nota vem antes: criar o projeto leva para a
 * tela da obra, e o convite da nota que estivesse atrás se perderia.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  preview: null as null | { resolve: (v: unknown) => void },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/services/projects-service", () => ({ ProjectsService: { create: vi.fn() } }));
vi.mock("@/hooks/use-issue-invoice", () => ({
  useIssueInvoice: () => ({ issue: vi.fn(), issuingId: null, gaps: null, closeGaps: vi.fn() }),
}));
vi.mock("@/services/fiscal-service", () => ({
  FiscalService: {
    previewFromProposal: () =>
      new Promise((resolve) => {
        m.preview = { resolve };
      }),
  },
}));

import { useProposalInvoicePrompt } from "@/hooks/use-proposal-invoice-prompt";
import { ProposalInvoicePrompt } from "@/components/features/fiscal/proposal-invoice-prompt";
import { ProjectOnApprovalHost } from "../project-on-approval-host";
import { announceProjectOnApproval, resetProjectApprovalQueue } from "@/lib/project-on-approval";
import { resetApprovalDialogQueue } from "@/lib/approval-dialog-queue";

type Controller = ReturnType<typeof useProposalInvoicePrompt>;
let controller: Controller;
const expose = (value: Controller) => {
  controller = value;
};

/** Simula a lista de propostas: dispara a consulta da nota e aprova. */
function ProposalsScreen({ onController }: { onController: (value: Controller) => void }) {
  const value = useProposalInvoicePrompt();
  onController(value);
  return <ProposalInvoicePrompt {...value} />;
}

const CAN_ISSUE = { canIssue: true, jaEmitidas: [], documentos: [{ type: "nfe", valorTotal: 1000 }] };

function approve(): { decided: Promise<void> } {
  let pending!: Promise<unknown>;
  act(() => {
    pending = controller.startPreview("p1");
  });
  // A aprovação volta do servidor pedindo a pergunta do projeto...
  act(() => announceProjectOnApproval({ projectSuggested: true }, { id: "p1", title: "Casa" }));
  // ...e a tela pede o convite da nota com a consulta ainda em andamento.
  let decided!: Promise<void>;
  act(() => {
    decided = controller.promptAfterApproval("p1", "Casa", pending as never);
  });
  return { decided };
}

beforeEach(() => {
  resetProjectApprovalQueue();
  resetApprovalDialogQueue();
  m.preview = null;
});

describe("nota fiscal e projeto da obra depois da aprovação", () => {
  it("com a consulta da nota em andamento, o projeto espera; a nota abre primeiro", async () => {
    render(
      <>
        <ProposalsScreen onController={expose} />
        <ProjectOnApprovalHost />
      </>,
    );
    const { decided } = approve();
    expect(screen.queryByText("Esta venda tem instalação?")).toBeNull();

    await act(async () => {
      m.preview?.resolve(CAN_ISSUE);
      await decided;
    });
    expect(screen.getByText("Emitir nota fiscal desta proposta?")).toBeInTheDocument();
    expect(screen.queryByText("Esta venda tem instalação?")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(await screen.findByText("Esta venda tem instalação?")).toBeInTheDocument();
    expect(screen.queryByText("Emitir nota fiscal desta proposta?")).toBeNull();
  });

  it("sem convite de nota (há pendência fiscal ou já emitida): o projeto abre assim que a consulta decide", async () => {
    render(
      <>
        <ProposalsScreen onController={expose} />
        <ProjectOnApprovalHost />
      </>,
    );
    const { decided } = approve();
    await act(async () => {
      m.preview?.resolve({ canIssue: false, jaEmitidas: [], documentos: [], reason: "faltam dados", gaps: [] });
      await decided;
    });
    expect(screen.queryByText("Emitir nota fiscal desta proposta?")).toBeNull();
    expect(screen.getByText("Esta venda tem instalação?")).toBeInTheDocument();
  });

  it("aprovação falhou: a vez da nota é solta e nada fica preso", async () => {
    render(
      <>
        <ProposalsScreen onController={expose} />
        <ProjectOnApprovalHost />
      </>,
    );
    act(() => {
      void controller.startPreview("p1");
    });
    act(() => controller.dismiss());
    act(() => announceProjectOnApproval({ projectSuggested: true }, { id: "p2", title: "Outra" }));
    expect(screen.getByText("Esta venda tem instalação?")).toBeInTheDocument();
  });
});

describe("contrato nascido da mensalidade da proposta", () => {
  it("vira diálogo, e não toast: espera a pergunta da obra e abre depois", async () => {
    render(<ProjectOnApprovalHost />);
    act(() =>
      announceProjectOnApproval(
        { projectSuggested: true, contractCreated: "proposal_p1" },
        { id: "p1", title: "Casa" },
      ),
    );
    expect(screen.getByText("Esta venda tem instalação?")).toBeInTheDocument();
    expect(screen.queryByText("A mensalidade virou um contrato")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(await screen.findByText("A mensalidade virou um contrato")).toBeInTheDocument();
    expect(screen.getByText(/"Casa" tinha itens mensais/)).toBeInTheDocument();
  });

  it("sem obra a perguntar, o contrato abre sozinho", () => {
    render(<ProjectOnApprovalHost />);
    act(() => announceProjectOnApproval({ contractCreated: "proposal_p2" }, { id: "p2", title: "Loja" }));
    expect(screen.getByText("A mensalidade virou um contrato")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir o contrato" })).toBeInTheDocument();
  });

  it("aprovação sem mensalidade não abre nada sobre contrato", () => {
    render(<ProjectOnApprovalHost />);
    act(() => announceProjectOnApproval({ projectSuggested: false, contractCreated: null }, { id: "p3" }));
    expect(screen.queryByText("A mensalidade virou um contrato")).toBeNull();
  });
});
