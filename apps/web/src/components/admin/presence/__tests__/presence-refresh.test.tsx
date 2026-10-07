// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresenceRefresh } from "../presence-refresh";

describe("PresenceRefresh", () => {
  it("mostra a hora da última consulta, no fuso de Brasília", () => {
    render(<PresenceRefresh updatedAt="2026-10-07T20:20:00.000Z" isLoading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText("Presença atualizada às 17:20")).toBeInTheDocument();
  });

  it("o botão atualiza na hora", () => {
    const onRefresh = vi.fn();
    render(<PresenceRefresh updatedAt={null} isLoading={false} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar quem está online" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("enquanto consulta, o botão fica travado", () => {
    render(<PresenceRefresh updatedAt={null} isLoading onRefresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Atualizar quem está online" })).toBeDisabled();
  });
});
