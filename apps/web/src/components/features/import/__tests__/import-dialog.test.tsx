// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  perms: { isDemo: false },
  read: vi.fn(),
  run: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.perms }));
vi.mock("@/lib/import/read-sheet", () => ({
  IMPORT_ACCEPT: ".xlsx,.csv",
  MAX_IMPORT_ROWS: 2000,
  readSheetFile: (...a: unknown[]) => m.read(...a),
}));
vi.mock("@/services/import-service", () => ({ runImport: (...a: unknown[]) => m.run(...a) }));
vi.mock("@/lib/export/sheet", () => ({ downloadSheet: (...a: unknown[]) => m.download(...a) }));

import { ImportDialog } from "../import-dialog";
import { CONTACT_FIELDS, productFields } from "@/lib/import/import-fields";

const SHEET = {
  headers: ["Nome", "Celular", "CPF", "Cidade"],
  rows: [
    ["Ana Ribeiro", "11988887777", "", "SP"],
    ["Bruno", "11977776666", "", "RJ"],
    ["X", "", "", ""],
  ],
};

function renderDialog(onImported = vi.fn()) {
  render(
    <ImportDialog
      kind="clients"
      open
      onOpenChange={vi.fn()}
      noun={{ singular: "contato", plural: "contatos" }}
      fields={CONTACT_FIELDS}
      onImported={onImported}
    />,
  );
  return onImported;
}

async function chooseFile() {
  const input = screen.getByLabelText("Planilha para importar");
  fireEvent.change(input, { target: { files: [new File(["x"], "clientes.csv", { type: "text/csv" })] } });
  await screen.findByText(/clientes\.csv: confira/);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.perms = { isDemo: false };
  m.read.mockResolvedValue(SHEET);
  m.run.mockImplementation(async (_kind: string, rows: unknown[], { dryRun }: { dryRun: boolean }) => ({
    reports: [
      { index: 0, status: "ok" },
      { index: 1, status: "duplicate", message: "Já existe no cadastro." },
      { index: 2, status: "error", message: "Nome obrigatório." },
    ].slice(0, rows.length),
    created: dryRun ? 0 : 1,
  }));
});

describe("importar planilha", () => {
  it("modelo para baixar com as colunas do cadastro e o obrigatório marcado", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Baixar modelo" }));
    const call = m.download.mock.calls[0][0];
    expect(call.columns[0].header).toBe("Nome*");
    expect(call.rows[0].name).toBe("Ana Ribeiro");
  });

  it("liga as colunas sozinha, mostra a prévia do servidor e importa só as prontas", async () => {
    const onImported = renderDialog();
    await chooseFile();
    // "Celular" foi ligado ao Telefone; "Cidade" ficou sem campo.
    expect(screen.getByLabelText("Telefone")).toHaveValue("1");
    await userEvent.click(screen.getByRole("button", { name: "Ver prévia" }));

    const [kind, rows, options] = m.run.mock.calls[0];
    expect(kind).toBe("clients");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ name: "Ana Ribeiro", phone: "11988887777" });
    expect(options).toEqual({ dryRun: true, allowPerMeter: undefined });
    expect(await screen.findByText("1 contato para importar")).toBeInTheDocument();
    expect(screen.getByText("1 repetidos")).toBeInTheDocument();
    expect(screen.getByText("Já existe no cadastro.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Importar 1 contato" }));
    expect(await screen.findByText("1 contato importados.")).toBeInTheDocument();
    expect(m.run).toHaveBeenLastCalledWith("clients", expect.any(Array), { dryRun: false, allowPerMeter: undefined });
    expect(onImported).toHaveBeenCalled();
  });

  it("campo obrigatório sem coluna não deixa seguir", async () => {
    m.read.mockResolvedValue({ headers: ["Celular"], rows: [["11988887777"]] });
    renderDialog();
    await chooseFile();
    expect(screen.getByText("Escolha a coluna de Nome.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver prévia" })).toBeDisabled();
  });

  it("planilha grande demais ou vazia avisa no primeiro passo", async () => {
    m.read.mockResolvedValue({ headers: ["Nome"], rows: [] });
    renderDialog();
    fireEvent.change(screen.getByLabelText("Planilha para importar"), {
      target: { files: [new File(["x"], "vazia.xlsx")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("não tem linhas");
  });

  it("limite do plano volta como mensagem, sem fechar", async () => {
    renderDialog();
    await chooseFile();
    await userEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await screen.findByText("1 contato para importar");
    m.run.mockRejectedValueOnce(new Error("A planilha passa do limite de contatos do seu plano."));
    await userEvent.click(screen.getByRole("button", { name: "Importar 1 contato" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("limite de contatos");
  });

  it("demonstração: prévia no navegador, sem API, e importar pede assinatura", async () => {
    m.perms = { isDemo: true };
    renderDialog();
    await chooseFile();
    await userEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    expect(m.run).not.toHaveBeenCalled();
    // Ana e Bruno passam; "X" tem nome curto.
    expect(await screen.findByText("2 contatos para importar")).toBeInTheDocument();
    expect(screen.getByText(/Os repetidos aparecem quando a conta é sua/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/subscribe");
    expect(screen.queryByRole("button", { name: /Importar 2/ })).toBeNull();
  });

  it("produto em cortinas manda o preço por metro", async () => {
    m.read.mockResolvedValue({ headers: ["Nome", "Preço", "Metragem"], rows: [["Linho", "80", "120"]] });
    render(
      <ImportDialog
        kind="products"
        open
        onOpenChange={vi.fn()}
        noun={{ singular: "produto", plural: "produtos" }}
        fields={productFields({ inventoryLabel: "Metragem", perMeter: true })}
        allowPerMeter
        onImported={vi.fn()}
      />,
    );
    await chooseFileNamed("tecidos.xlsx");
    await userEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await waitFor(() =>
      expect(m.run).toHaveBeenCalledWith(
        "products",
        [expect.objectContaining({ name: "Linho", price: "80", stock: "120" })],
        { dryRun: true, allowPerMeter: true },
      ),
    );
  });
});

async function chooseFileNamed(name: string) {
  fireEvent.change(screen.getByLabelText("Planilha para importar"), { target: { files: [new File(["x"], name)] } });
  await screen.findByText(new RegExp(`${name.replace(".", "\\.")}: confira`));
}
