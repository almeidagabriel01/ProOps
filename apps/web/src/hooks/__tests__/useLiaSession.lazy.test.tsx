// @vitest-environment jsdom
/**
 * A conversa salva da Lia era lida em TODA página autenticada, mesmo com o
 * painel fechado. Agora só depois da primeira abertura (loadEnabled), e até lá
 * o hook se declara carregando nos planos com histórico, para o painel não
 * mostrar a saudação e trocá-la logo depois pela conversa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getDocMock = vi.fn();
let planTier = "pro";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: (...a: unknown[]) => getDocMock(...a),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/hooks/usePlanLimits", () => ({
  usePlanLimits: () => ({ planTier, isLoading: false }),
}));

import { useLiaSession } from "../useLiaSession";

beforeEach(() => {
  getDocMock.mockReset();
  getDocMock.mockResolvedValue({ exists: () => false });
  planTier = "pro";
  localStorage.clear();
});

describe("useLiaSession", () => {
  it("com o painel nunca aberto não lê a conversa e segura a saudação", async () => {
    const { result } = renderHook(() => useLiaSession(false));
    await new Promise((r) => setTimeout(r, 10));
    expect(getDocMock).not.toHaveBeenCalled();
    expect(result.current.isLoadingHistory).toBe(true);
  });

  it("depois de aberto lê a conversa uma vez e libera", async () => {
    const { result, rerender } = renderHook(({ open }) => useLiaSession(open), {
      initialProps: { open: false },
    });
    rerender({ open: true });
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });

  it("plano sem histórico nunca lê nem fica carregando", async () => {
    planTier = "starter";
    const { result } = renderHook(() => useLiaSession(true));
    await new Promise((r) => setTimeout(r, 10));
    expect(getDocMock).not.toHaveBeenCalled();
    expect(result.current.isLoadingHistory).toBe(false);
  });
});
