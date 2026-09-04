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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { correctInvoice } = vi.hoisted(() => ({ correctInvoice: vi.fn() }));

vi.mock("@/services/fiscal-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/fiscal-service")>();
  return { ...actual, FiscalService: { correctInvoice } };
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
});
