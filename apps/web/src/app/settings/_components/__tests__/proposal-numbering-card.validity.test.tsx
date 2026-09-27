// @vitest-environment jsdom
/**
 * Validade padrão da proposta, na mesma tela da numeração.
 *
 * O campo só aparece quando o backend devolve `defaultValidityDays`. Um backend
 * anterior ao campo não o conhece e recusa chave desconhecida com 400 (o schema
 * é `.strict()`): se a tela sempre enviasse o campo, publicar o front antes do
 * backend quebraria o salvamento da numeração inteira.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { get, update } = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/services/proposal-numbering-service", () => ({
  ProposalNumberingService: { get, update },
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ProposalNumberingCard } from "../proposal-numbering-card";

const BASE = {
  enabled: false,
  digits: 5,
  resetYearly: false,
  pracas: [],
  defaultPraca: null,
  nextNumber: 1,
  year: 2026,
};

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(async (config) => config);
});

describe("ProposalNumberingCard: validade padrão", () => {
  it("mostra o campo com o valor que veio do backend", async () => {
    get.mockResolvedValue({ ...BASE, defaultValidityDays: 30 });
    render(<ProposalNumberingCard />);

    const campo = await screen.findByLabelText(/validade padrão/i);
    expect(campo).toHaveValue(30);
  });

  it("envia a validade alterada ao salvar", async () => {
    get.mockResolvedValue({ ...BASE, defaultValidityDays: 30 });
    render(<ProposalNumberingCard />);

    const campo = await screen.findByLabelText(/validade padrão/i);
    fireEvent.change(campo, { target: { value: "15" } });
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ defaultValidityDays: 15 }),
    );
  });

  it("esconde o campo e não envia a chave quando o backend não a conhece", async () => {
    get.mockResolvedValue(BASE);
    render(<ProposalNumberingCard />);

    await screen.findByRole("button", { name: /salvar/i });
    expect(screen.queryByLabelText(/validade padrão/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
    expect(update).toHaveBeenCalledWith(
      expect.not.objectContaining({ defaultValidityDays: expect.anything() }),
    );
  });
});
