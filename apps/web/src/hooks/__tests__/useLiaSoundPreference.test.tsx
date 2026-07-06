// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockUseAuth = vi.fn();
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUpdateProfile = vi.fn();
vi.mock("@/services/user-service", () => ({
  UserService: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

const mockSetLiaSoundsEnabled = vi.fn();
vi.mock("@/lib/lia-sounds", () => ({
  setLiaSoundsEnabled: (...args: unknown[]) => mockSetLiaSoundsEnabled(...args),
}));

import { useLiaSoundPreference } from "@/hooks/useLiaSoundPreference";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateProfile.mockResolvedValue(undefined);
});

describe("useLiaSoundPreference", () => {
  it("defaults to enabled when user has no preferences", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const { result } = renderHook(() => useLiaSoundPreference());
    expect(result.current.soundsEnabled).toBe(true);
  });

  it("reads disabled preference from user doc", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", preferences: { liaSoundsEnabled: false } },
    });
    const { result } = renderHook(() => useLiaSoundPreference());
    expect(result.current.soundsEnabled).toBe(false);
  });

  it("syncs the sound module gate", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", preferences: { liaSoundsEnabled: false } },
    });
    renderHook(() => useLiaSoundPreference());
    expect(mockSetLiaSoundsEnabled).toHaveBeenCalledWith(false);
  });

  it("toggle is optimistic and persists via UserService", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const { result } = renderHook(() => useLiaSoundPreference());

    await act(async () => {
      await result.current.toggleSounds();
    });

    expect(result.current.soundsEnabled).toBe(false);
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      preferences: { liaSoundsEnabled: false },
    });
  });

  it("reverts the optimistic value when the service fails", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUpdateProfile.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useLiaSoundPreference());

    await act(async () => {
      await result.current.toggleSounds();
    });

    await waitFor(() => {
      expect(result.current.soundsEnabled).toBe(true);
    });
  });
});
