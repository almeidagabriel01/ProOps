// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AsaasPayoutConfigSection } from "../asaas-payout-config-section";
import type { AsaasPayoutConfig } from "@/services/payment-service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdatePayout = vi.fn();

vi.mock("@/services/payment-service", () => ({
  AsaasService: {
    updatePayout: (...args: unknown[]) => mockUpdatePayout(...args),
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSwitchButton() {
  return screen.getByRole("switch");
}

function getSaveButton() {
  return screen.getByRole("button", { name: /salvar configuração de repasse/i });
}

function getPixKeyInput() {
  return screen.getByRole("textbox");
}

/**
 * The Select component renders a native <select> as sr-only.
 * Change its value directly to simulate a type selection.
 */
function getNativeSelect() {
  return document.querySelector("select") as HTMLSelectElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AsaasPayoutConfigSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Case 1: renders with populated initialPayout
  // -------------------------------------------------------------------------
  describe("when initialPayout has enabled=true with CPF key", () => {
    const initialPayout: AsaasPayoutConfig = {
      enabled: true,
      pixAddressKey: "123.456.789-00",
      pixAddressKeyType: "CPF",
    };

    it("renders the switch as checked", () => {
      render(
        <AsaasPayoutConfigSection
          initialPayout={initialPayout}
          onSaved={vi.fn()}
        />,
      );
      expect(getSwitchButton()).toHaveAttribute("aria-checked", "true");
    });

    it("shows the PIX key input with the initial value", () => {
      render(
        <AsaasPayoutConfigSection
          initialPayout={initialPayout}
          onSaved={vi.fn()}
        />,
      );
      expect(getPixKeyInput()).toHaveValue("123.456.789-00");
    });

    it("shows CPF as the selected key type in the native select", () => {
      render(
        <AsaasPayoutConfigSection
          initialPayout={initialPayout}
          onSaved={vi.fn()}
        />,
      );
      expect(getNativeSelect()).toHaveValue("CPF");
    });
  });

  // -------------------------------------------------------------------------
  // Case 2: renders with initialPayout=null
  // -------------------------------------------------------------------------
  describe("when initialPayout is null", () => {
    it("renders the switch as unchecked", () => {
      render(
        <AsaasPayoutConfigSection initialPayout={null} onSaved={vi.fn()} />,
      );
      expect(getSwitchButton()).toHaveAttribute("aria-checked", "false");
    });

    it("does not show PIX fields", () => {
      render(
        <AsaasPayoutConfigSection initialPayout={null} onSaved={vi.fn()} />,
      );
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(getNativeSelect()).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Case 3: save with enabled=true but empty pixAddressKey — button disabled
  // -------------------------------------------------------------------------
  describe("when enabled=true and pixAddressKey is empty", () => {
    it("disables the save button so handleSave cannot be reached", async () => {
      // Enable payout but provide no key — button must be disabled
      render(
        <AsaasPayoutConfigSection
          initialPayout={{ enabled: true, pixAddressKey: "", pixAddressKeyType: "CPF" }}
          onSaved={vi.fn()}
        />,
      );

      const saveBtn = getSaveButton();
      expect(saveBtn).toBeDisabled();

      // Clicking a disabled button should not invoke the service or toast
      fireEvent.click(saveBtn);
      expect(mockUpdatePayout).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Case 4: successful save
  // -------------------------------------------------------------------------
  describe("successful save", () => {
    it("calls updatePayout with correct payload and then onSaved with returned payout", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const returnedPayout: AsaasPayoutConfig = {
        enabled: true,
        pixAddressKey: "test@email.com",
        pixAddressKeyType: "EMAIL",
        updatedAt: "2026-05-12T00:00:00.000Z",
      };
      mockUpdatePayout.mockResolvedValueOnce({ success: true, payout: returnedPayout });

      render(
        <AsaasPayoutConfigSection
          initialPayout={null}
          onSaved={onSaved}
        />,
      );

      // Enable payout via switch
      await user.click(getSwitchButton());

      // Change PIX key type to EMAIL via native select
      const nativeSel = getNativeSelect();
      fireEvent.change(nativeSel, { target: { value: "EMAIL" } });

      // Type the PIX key
      const input = getPixKeyInput();
      await user.clear(input);
      await user.type(input, "test@email.com");

      // Save
      await user.click(getSaveButton());

      await waitFor(() => {
        expect(mockUpdatePayout).toHaveBeenCalledWith({
          enabled: true,
          pixAddressKey: "test@email.com",
          pixAddressKeyType: "EMAIL",
        });
        expect(onSaved).toHaveBeenCalledWith(returnedPayout);
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Case 5: failed save — updatePayout throws
  // -------------------------------------------------------------------------
  describe("when updatePayout throws", () => {
    it("calls toast.error and does not call onSaved", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      mockUpdatePayout.mockRejectedValueOnce(new Error("Network error"));

      render(
        <AsaasPayoutConfigSection
          initialPayout={{ enabled: true, pixAddressKey: "123.456.789-00", pixAddressKeyType: "CPF" }}
          onSaved={onSaved}
        />,
      );

      await user.click(getSaveButton());

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
        expect(onSaved).not.toHaveBeenCalled();
      });
    });
  });
});
