// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn<(message: string, options?: unknown) => string>(() => "toast-1"),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: toastMock }));

import {
  pendingUndoableCount,
  runUndoableAction,
} from "../undoable-action";

type ButtonOptions = { button: { title: string; onClick: () => void } };

function clickUndo() {
  const options = toastMock.success.mock.calls.at(-1)?.[1] as unknown as ButtonOptions;
  options.button.onClick();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(async () => {
  // O estado das ações pendentes é do módulo: esvazia antes do próximo teste.
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe("runUndoableAction", () => {
  it("grava depois da janela quando ninguém desfaz", async () => {
    const commit = vi.fn(async () => {});
    const onUndo = vi.fn();
    runUndoableAction({ message: "Excluído.", commit, onUndo, delayMs: 6000 });

    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6000);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
    expect(pendingUndoableCount()).toBe(0);
  });

  it("oferece Desfazer no toast pelo tempo da janela", () => {
    runUndoableAction({ message: "Excluído.", commit: vi.fn(), onUndo: vi.fn() });
    expect(toastMock.success).toHaveBeenCalledWith(
      "Excluído.",
      expect.objectContaining({
        duration: 6000,
        button: expect.objectContaining({ title: "Desfazer" }),
      }),
    );
  });

  it("Desfazer cancela a gravação e restaura a tela", async () => {
    const commit = vi.fn(async () => {});
    const onUndo = vi.fn();
    runUndoableAction({ message: "Excluído.", commit, onUndo });

    clickUndo();
    await vi.advanceTimersByTimeAsync(10000);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(toastMock.dismiss).toHaveBeenCalledWith("toast-1");
  });

  it("Desfazer depois da gravação não faz nada", async () => {
    const onUndo = vi.fn();
    runUndoableAction({ message: "Excluído.", commit: vi.fn(async () => {}), onUndo });
    await vi.advanceTimersByTimeAsync(6000);

    clickUndo();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("falha na gravação chama onCommitError", async () => {
    const onCommitError = vi.fn();
    const erro = new Error("vinculado a uma proposta");
    runUndoableAction({
      message: "Excluído.",
      commit: vi.fn(async () => {
        throw erro;
      }),
      onUndo: vi.fn(),
      onCommitError,
    });
    await vi.advanceTimersByTimeAsync(6000);

    expect(onCommitError).toHaveBeenCalledWith(erro);
  });

  it("pede confirmação ao fechar a aba só enquanto há ação pendente", async () => {
    const saida = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    runUndoableAction({ message: "Excluído.", commit: vi.fn(async () => {}), onUndo: vi.fn() });
    expect(pendingUndoableCount()).toBe(1);
    expect(saida()).toBe(true);

    await vi.advanceTimersByTimeAsync(6000);
    expect(saida()).toBe(false);
  });
});
