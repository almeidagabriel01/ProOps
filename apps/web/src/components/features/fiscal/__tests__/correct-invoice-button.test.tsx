// @vitest-environment jsdom
/**
 * Carta de correção.
 *
 * O risco não é falhar — é registrar uma carta **válida e errada**. A CC-e é
 * cumulativa: a última sobrescreve as anteriores perante o fisco. Mandar só a
 * novidade apaga a correção anterior, sem erro nenhum, e ninguém descobre antes
 * de uma fiscalização.
 *
 * Por isso o campo já abre com o texto que está valendo, e o teste mais
 * importante aqui é justamente esse.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { correctInvoice, downloadCorrectionDocument } = vi.hoisted(() => ({
  correctInvoice: vi.fn(),
  downloadCorrectionDocument: vi.fn(),
}));

vi.mock("@/services/fiscal-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/fiscal-service")>();
  return {
    ...actual,
    FiscalService: { correctInvoice, downloadCorrectionDocument },
  };
});
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  callApi: vi.fn(),
}));

import { CorrectInvoiceButton } from "../correct-invoice-button";
import type { FiscalInvoice } from "@/services/fiscal-service";

const NOTA = {
  id: "inv-1",
  tenantId: "t1",
  ref: "r1",
  type: "nfe",
  status: "authorized",
  numero: "12",
  valorTotal: 100,
  createdAt: "",
  updatedAt: "",
} as FiscalInvoice;

function renderButton(invoice: FiscalInvoice = NOTA, onCorrected = vi.fn()) {
  render(<CorrectInvoiceButton invoice={invoice} onCorrected={onCorrected} />);
  return onCorrected;
}

const abrir = () => userEvent.click(screen.getByRole("button", { name: /correção/i }));
const campo = () => screen.getByLabelText(/O que precisa ser corrigido/i);
const registrar = () => screen.getByRole("button", { name: /Registrar correção/ });

beforeEach(() => {
  vi.clearAllMocks();
  correctInvoice.mockResolvedValue({ ...NOTA, correcoes: [] });
});

describe("CorrectInvoiceButton", () => {
  it("diz o que a carta NÃO corrige", async () => {
    // Escrever uma correção que a lei não permite não gera erro: gera uma carta
    // registrada e inútil, com falsa sensação de resolvido.
    renderButton();
    await abrir();

    const texto = screen.getByText(/Não serve/).parentElement?.textContent ?? "";
    for (const proibido of ["valor", "imposto", "quantidade", "cliente", "data"]) {
      expect(texto.toLowerCase()).toContain(proibido);
    }
  });

  it("trava abaixo do mínimo da SEFAZ", async () => {
    renderButton();
    await abrir();
    expect(registrar()).toBeDisabled();

    await userEvent.type(campo(), "curto");
    expect(registrar()).toBeDisabled();

    await userEvent.type(campo(), " mas agora ja passa de quinze");
    await waitFor(() => expect(registrar()).toBeEnabled());
  });

  it("envia o texto digitado", async () => {
    const onCorrected = renderButton();
    await abrir();

    await userEvent.type(campo(), "o endereco de entrega correto e Rua A, 320");
    await userEvent.click(registrar());

    await waitFor(() =>
      expect(correctInvoice).toHaveBeenCalledWith(
        "inv-1",
        "o endereco de entrega correto e Rua A, 320",
      ),
    );
    expect(onCorrected).toHaveBeenCalled();
  });

  it("abre já preenchido com a correção que está valendo", async () => {
    // O teste que mais importa: sem isto, mandar só a novidade apagaria a
    // correção anterior perante o fisco.
    renderButton({
      ...NOTA,
      correcoes: [
        { texto: "primeira correcao registrada", registradaEm: "2026-09-01" },
      ],
    });
    await abrir();

    expect(campo()).toHaveValue("primeira correcao registrada");
  });

  it("avisa que a nova substitui a anterior", async () => {
    renderButton({
      ...NOTA,
      correcoes: [{ texto: "correcao anterior valida", registradaEm: "2026-09-01" }],
    });
    await abrir();

    expect(screen.getByText(/substitui/)).toBeInTheDocument();
  });

  it("usa sempre a ÚLTIMA correção, não a primeira", async () => {
    // É a última que vale perante o fisco; partir da primeira desfaria o resto.
    renderButton({
      ...NOTA,
      correcoes: [
        { texto: "primeira versao do texto", registradaEm: "2026-09-01" },
        { texto: "segunda versao, mais completa", registradaEm: "2026-09-02" },
      ],
    });
    await abrir();

    expect(campo()).toHaveValue("segunda versao, mais completa");
  });

  it("envia o texto SANEADO — o XSD da NF-e não aceita travessão", async () => {
    // A primeira carta real foi recusada por um `—` copiado do placeholder
    // deste diálogo. A SEFAZ responde erro de schema citando o codepoint, que
    // não ajuda ninguém a entender que o problema é um traço.
    renderButton();
    await abrir();

    await userEvent.type(campo(), "endereco correto e Rua A, 320 — Centro");
    await userEvent.click(registrar());

    await waitFor(() =>
      expect(correctInvoice).toHaveBeenCalledWith(
        "inv-1",
        "endereco correto e Rua A, 320 - Centro",
      ),
    );
  });

  it("avisa que o texto será ajustado antes de enviar", async () => {
    renderButton();
    await abrir();

    await userEvent.type(campo(), "endereco correto e Rua A, 320 — Centro");

    expect(
      await screen.findByText(/Alguns caracteres serão ajustados/),
    ).toBeInTheDocument();
  });

  it("não avisa quando não há nada a ajustar", async () => {
    // Aviso que aparece sempre vira ruído e deixa de ser lido.
    renderButton();
    await abrir();

    await userEvent.type(campo(), "endereco correto e Rua A, 320");

    expect(screen.queryByText(/Alguns caracteres serão ajustados/)).toBeNull();
  });

  it("conta o tamanho DEPOIS do saneamento", async () => {
    // O corte muda o comprimento: liberar o botão pelo texto cru mandaria para
    // o servidor uma carta abaixo do mínimo da SEFAZ, para levar 400.
    renderButton();
    await abrir();

    // 15 caracteres crus — o mínimo — e 11 depois de remover os invisíveis.
    await userEvent.type(campo(), "curto​​​​demais");
    expect(registrar()).toBeDisabled();
  });

  it("bloqueia ao atingir o limite de 20 da SEFAZ", async () => {
    // Passar disso é a rejeição 594 — barrar aqui evita gastar a chamada.
    renderButton({
      ...NOTA,
      correcoes: Array.from({ length: 20 }, (_, i) => ({
        texto: `correcao numero ${i}`,
        registradaEm: "2026-09-01",
      })),
    });
    await abrir();

    expect(screen.getByText(/limite de 20 correções/)).toBeInTheDocument();
    expect(registrar()).toBeDisabled();
    expect(campo()).toBeDisabled();
  });

  describe("histórico", () => {
    const COM_HISTORICO = {
      ...NOTA,
      correcoes: [
        {
          texto: "primeira correcao registrada",
          registradaEm: "2026-09-01T13:45:00.000Z",
          numero: "1",
          storagePdfPath: "tenants/t1/fiscal/inv-1/cce-1.pdf",
          storageXmlPath: "tenants/t1/fiscal/inv-1/cce-1.xml",
        },
        {
          texto: "segunda correcao registrada",
          registradaEm: "2026-09-02T13:45:00.000Z",
          numero: "2",
        },
      ],
    } as FiscalInvoice;

    it("lista cada correção com a data em que foi registrada", async () => {
      // A data estava gravada e não aparecia em lugar nenhum — sem ela não dá
      // para saber a qual momento a correção se refere.
      renderButton(COM_HISTORICO);
      await abrir();

      // Escopado na lista: o campo de texto abre pré-preenchido com a última
      // correção, então o texto dela existe duas vezes na tela.
      const historico = within(screen.getByRole("list"));
      expect(historico.getByText("primeira correcao registrada")).toBeInTheDocument();
      expect(historico.getByText("segunda correcao registrada")).toBeInTheDocument();
      expect(screen.getByText(/01\/09\/2026/)).toBeInTheDocument();
    });

    it("marca só a ÚLTIMA como em vigor", async () => {
      // Todas ficam no histórico, mas só a última vale perante o fisco.
      renderButton(COM_HISTORICO);
      await abrir();

      expect(screen.getAllByText("Em vigor")).toHaveLength(1);
    });

    it("oferece download só de quem tem documento arquivado", async () => {
      // A segunda correção não tem cópia: um botão que sempre falha é pior que
      // botão nenhum.
      renderButton(COM_HISTORICO);
      await abrir();

      expect(screen.getAllByRole("button", { name: "PDF" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "XML" })).toHaveLength(1);
    });

    it("baixa pelo backend, com o índice da correção", async () => {
      renderButton(COM_HISTORICO);
      await abrir();

      await userEvent.click(screen.getByRole("button", { name: "XML" }));

      await waitFor(() =>
        expect(downloadCorrectionDocument).toHaveBeenCalledWith(
          "inv-1",
          1,
          "xml",
          "carta-correcao-12-1.xml",
        ),
      );
    });

    it("mostra no ícone quantas correções a nota tem", async () => {
      // Na lista, nota corrigida era idêntica a nota sem correção — e `title`
      // não existe no celular.
      renderButton(COM_HISTORICO);

      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});
