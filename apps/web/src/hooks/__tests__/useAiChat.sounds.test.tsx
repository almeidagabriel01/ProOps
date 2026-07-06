// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { AiChatChunk } from "@/types/ai";

vi.mock("next/navigation", () => ({
  usePathname: () => "/proposals",
}));

const mockPlayLiaSound = vi.fn();
vi.mock("@/lib/lia-sounds", () => ({
  playLiaSound: (...args: unknown[]) => mockPlayLiaSound(...args),
}));

// Captura os callbacks passados pelo hook para simular o stream SSE
type StreamHandlers = {
  onChunk: (chunk: AiChatChunk) => void;
  onDone: () => void;
  onError: (error: Error) => void;
};
let handlers: StreamHandlers;
const mockSendChatMessage = vi.fn(
  async (_req: unknown, h: StreamHandlers) => {
    handlers = h;
    return new AbortController();
  },
);
vi.mock("@/services/ai-service", () => ({
  sendChatMessage: (...args: unknown[]) =>
    mockSendChatMessage(args[0], args[1] as StreamHandlers),
  AiApiError: class AiApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { useAiChat } from "@/hooks/useAiChat";

function soundsPlayed(): string[] {
  return mockPlayLiaSound.mock.calls.map((call) => call[0] as string);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAiChat sound triggers", () => {
  it("plays messageSent when the user sends a message", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    expect(soundsPlayed()).toContain("messageSent");
  });

  it("plays typingStart once on the first text chunk only", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onChunk({ type: "text", content: "Oi" } as AiChatChunk);
      handlers.onChunk({ type: "text", content: "!" } as AiChatChunk);
    });
    const typing = soundsPlayed().filter((s) => s === "typingStart");
    expect(typing).toHaveLength(1);
  });

  it("plays responseDone on done with the panel open", async () => {
    const { result } = renderHook(() => useAiChat());
    act(() => {
      result.current.openPanel();
    });
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onChunk({ type: "text", content: "Oi" } as AiChatChunk);
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("responseDone");
    expect(soundsPlayed()).not.toContain("notification");
  });

  it("plays notification instead of responseDone when the panel is closed", async () => {
    const { result } = renderHook(() => useAiChat());
    // painel nunca aberto — isOpen === false
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("notification");
    expect(soundsPlayed()).not.toContain("responseDone");
  });

  it("plays error on error chunk and suppresses responseDone on the same send", async () => {
    const { result } = renderHook(() => useAiChat());
    act(() => {
      result.current.openPanel();
    });
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onChunk({
        type: "error",
        error: "Falhou",
      } as AiChatChunk);
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("error");
    expect(soundsPlayed()).not.toContain("responseDone");
  });

  it("plays error when the stream errors out", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onError(new Error("network"));
    });
    expect(soundsPlayed()).toContain("error");
  });

  it("plays confirmNeeded and suppresses responseDone when confirmation is requested", async () => {
    const { result } = renderHook(() => useAiChat());
    act(() => {
      result.current.openPanel();
    });
    await act(async () => {
      await result.current.sendMessage("apague o cliente X");
    });
    act(() => {
      handlers.onChunk({
        type: "tool_result",
        toolResult: {
          name: "delete_client",
          requiresConfirmation: true,
          confirmationToken: "tok",
          confirmationData: {
            action: "Excluir cliente",
            affectedRecords: ["X"],
            severity: "high",
          },
        },
      } as unknown as AiChatChunk);
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("confirmNeeded");
    expect(soundsPlayed()).not.toContain("responseDone");
  });

  it("plays no sound when canceling a pending confirmation", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("apague o cliente X");
    });
    act(() => {
      handlers.onChunk({
        type: "tool_result",
        toolResult: {
          name: "delete_client",
          requiresConfirmation: true,
          confirmationData: {
            action: "Excluir cliente",
            affectedRecords: ["X"],
            severity: "high",
          },
        },
      } as unknown as AiChatChunk);
      handlers.onDone();
    });
    mockPlayLiaSound.mockClear();
    act(() => {
      result.current.cancelAction();
    });
    expect(mockPlayLiaSound).not.toHaveBeenCalled();
  });
});
