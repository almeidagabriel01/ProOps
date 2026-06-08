// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockUseAuth = vi.fn();
const mockUseTenant = vi.fn();
const mockGetTenantById = vi.fn();

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@/services/tenant-service", () => ({
  TenantService: { getTenantById: (...args: unknown[]) => mockGetTenantById(...args) },
}));

vi.mock("@/lib/plans/plan-label", () => ({
  getImmediatePlanLabel: () => "Sem Plano",
  resolvePlanLabel: vi.fn().mockResolvedValue("Sem Plano"),
}));

import { useHeaderPresentation } from "../useHeaderPresentation";

const freeUser = { id: "u1", role: "free", tenantId: "t1", name: "User" };

const emptyTenantContext = {
  tenant: null,
  tenantOwner: null,
  tenantOwnerPlanName: null,
  isLoading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: freeUser });
  mockUseTenant.mockReturnValue(emptyTenantContext);
});

describe("useHeaderPresentation — isCompanyLoading for free users", () => {
  it("reports isCompanyLoading=true on first render while the display fetch is pending (bug scenario)", async () => {
    // Fetch never resolves during this render
    mockGetTenantById.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useHeaderPresentation());

    // True synchronously on the very first render — no "Minha Empresa" flash
    expect(result.current.isCompanyLoading).toBe(true);

    // Still true after the effect kicks off the fetch
    await waitFor(() => expect(mockGetTenantById).toHaveBeenCalledWith("t1"));
    expect(result.current.isCompanyLoading).toBe(true);
  });

  it("clears isCompanyLoading and surfaces the real name/logo once the fetch resolves", async () => {
    mockGetTenantById.mockResolvedValue({
      id: "t1",
      name: "Acme",
      logoUrl: "https://example.com/logo.png",
    });

    const { result } = renderHook(() => useHeaderPresentation());

    await waitFor(() => expect(result.current.isCompanyLoading).toBe(false));
    expect(result.current.companyName).toBe("Acme");
    expect(result.current.logoUrl).toBe("https://example.com/logo.png");
  });

  it("clears isCompanyLoading after a failed fetch so the skeleton never hangs", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetTenantById.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useHeaderPresentation());

    await waitFor(() => expect(result.current.isCompanyLoading).toBe(false));
    expect(result.current.companyName).toBe("Minha Empresa");

    consoleError.mockRestore();
  });

  it("does not load or fetch for a regular user whose tenant is already hydrated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u2", role: "admin", tenantId: "t2", name: "Admin" },
    });
    mockUseTenant.mockReturnValue({
      ...emptyTenantContext,
      tenant: { id: "t2", name: "Corp" },
    });

    const { result } = renderHook(() => useHeaderPresentation());

    expect(result.current.isCompanyLoading).toBe(false);
    expect(result.current.companyName).toBe("Corp");
    expect(mockGetTenantById).not.toHaveBeenCalled();
  });
});
