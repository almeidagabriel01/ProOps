// @vitest-environment jsdom
/**
 * Carregamento da numeração das propostas.
 *
 * O card devolvia `null` enquanto a configuração chegava: a tela ficava só com
 * o cabeçalho em skeleton e um vazio embaixo. Carregando, ele desenha o próprio
 * skeleton; depois de um erro no GET continua sem nada, porque não há o que
 * mostrar e o toast já explicou.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { get, toastError } = vi.hoisted(() => ({
  get: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/services/proposal-numbering-service", () => ({
  ProposalNumberingService: { get, update: vi.fn() },
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: toastError },
}));

import { ProposalNumberingCard } from "../proposal-numbering-card";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProposalNumberingCard — carregando", () => {
  it("mostra o skeleton do card, nunca o spinner", () => {
    get.mockReturnValue(new Promise(() => {}));
    render(<ProposalNumberingCard />);

    expect(
      screen.getByTestId("settings-skeleton-proposals"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("some com o skeleton e não desenha nada quando o GET falha", async () => {
    get.mockRejectedValue(new Error("falhou"));
    const onLoadingChange = vi.fn();
    const { container } = render(
      <ProposalNumberingCard onLoadingChange={onLoadingChange} />,
    );

    await waitFor(() => expect(onLoadingChange).toHaveBeenCalledWith(false));
    expect(screen.queryByTestId("settings-skeleton-proposals")).toBeNull();
    expect(container).toBeEmptyDOMElement();
    expect(toastError).toHaveBeenCalled();
  });

  it("troca o skeleton pelo card quando a configuração chega", async () => {
    get.mockResolvedValue({
      enabled: false,
      nextNumber: 1,
      digits: 5,
      resetYearly: false,
      year: 2026,
      pracas: [],
      defaultPraca: null,
    });
    render(<ProposalNumberingCard />);

    await waitFor(() =>
      expect(screen.getByText("Numeração das propostas")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("settings-skeleton-proposals")).toBeNull();
  });
});
