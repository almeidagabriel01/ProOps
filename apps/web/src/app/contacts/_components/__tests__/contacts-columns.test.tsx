// @vitest-environment jsdom
/**
 * Coluna de ações da listagem de contatos.
 *
 * "Pasta no Drive" morava dentro do cadastro do contato: para chegar à pasta era
 * preciso abrir o formulário de um cliente por vez. O caso de uso que originou o
 * módulo é o oposto disso — o vendedor na casa do cliente, no celular, querendo
 * a documentação em dois toques.
 *
 * Duas coisas que erram em silêncio aqui:
 *
 * 1. **Gatear por `canEdit`** — o botão só ABRE uma pasta; quem tem permissão de
 *    ver o contato pode vê-la. Preso ao `canEdit` ele desapareceria justamente
 *    para o vendedor com permissão de leitura.
 * 2. **Aparecer sem o plano** — chamaria uma rota que responde 402. O gate vive
 *    dentro do próprio botão (`hasDriveSync`), então a coluna não pode
 *    reimplementá-lo.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { getClientFolder, planLimits } = vi.hoisted(() => ({
  getClientFolder: vi.fn(),
  planLimits: { hasDriveSync: true },
}));

vi.mock("@/services/drive-service", () => ({
  DriveService: { getClientFolder },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => planLimits }));

import { createColumns } from "../contacts-columns";
import type { Client } from "@/services/client-service";

const CLIENTE = {
  id: "c1",
  tenantId: "t1",
  name: "Maria Silva",
  types: ["cliente"],
  source: "manual",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Client;

function renderAcoes(
  opts: { canEdit?: boolean; canDelete?: boolean } = {},
): void {
  const columns = createColumns({
    canEdit: opts.canEdit ?? true,
    canDelete: opts.canDelete ?? true,
    onDelete: vi.fn(),
  });
  const acoes = columns.find((column) => column.key === "actions");
  if (!acoes?.render) throw new Error("coluna de ações não encontrada");
  render(<>{acoes.render(CLIENTE)}</>);
}

const botaoDrive = () =>
  screen.queryByRole("button", { name: "Pasta no Drive" });

beforeEach(() => {
  vi.clearAllMocks();
  planLimits.hasDriveSync = true;
});

describe("contacts — coluna de ações", () => {
  it("oferece a pasta do Drive na listagem", () => {
    renderAcoes();

    expect(botaoDrive()).toBeInTheDocument();
  });

  it("oferece a pasta a quem só pode VER o contato", () => {
    // Abrir a pasta não altera o contato. Gatear por canEdit tiraria o botão de
    // quem mais precisa dele.
    renderAcoes({ canEdit: false, canDelete: false });

    expect(botaoDrive()).toBeInTheDocument();
    expect(screen.queryByTitle("Editar")).toBeNull();
    expect(screen.queryByTitle("Excluir")).toBeNull();
  });

  it("não oferece a pasta sem o plano", () => {
    planLimits.hasDriveSync = false;
    renderAcoes();

    expect(botaoDrive()).toBeNull();
    // A coluna continua funcionando: as outras ações seguem lá.
    expect(screen.getByTitle("Editar")).toBeInTheDocument();
  });
});
