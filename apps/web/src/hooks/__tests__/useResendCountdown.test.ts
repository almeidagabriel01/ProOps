import { describe, it, expect } from "vitest";
import {
  formatResendLabel,
  clampCountdownSeconds,
} from "../useResendCountdown";

describe("formatResendLabel", () => {
  it("renders the countdown label while seconds remain", () => {
    expect(formatResendLabel(45)).toBe("Reenviar em 45s");
    expect(formatResendLabel(1)).toBe("Reenviar em 1s");
  });

  it("renders the ready label when seconds reach zero", () => {
    expect(formatResendLabel(0)).toBe("Reenviar código");
  });

  it("treats negative seconds as ready (clamped behavior at the label level)", () => {
    expect(formatResendLabel(-5)).toBe("Reenviar código");
  });

  it("supports a custom ready label (e.g. profile 'Enviar código')", () => {
    expect(formatResendLabel(0, { readyLabel: "Enviar código" })).toBe(
      "Enviar código",
    );
    // While counting down, the custom ready label is irrelevant.
    expect(formatResendLabel(30, { readyLabel: "Enviar código" })).toBe(
      "Reenviar em 30s",
    );
  });

  it("supports a custom waiting label with the {s} placeholder", () => {
    expect(
      formatResendLabel(10, { waitingLabel: "Aguarde {s}s para reenviar" }),
    ).toBe("Aguarde 10s para reenviar");
  });
});

describe("clampCountdownSeconds", () => {
  it("floors positive fractional seconds", () => {
    expect(clampCountdownSeconds(59.9)).toBe(59);
    expect(clampCountdownSeconds(1.2)).toBe(1);
  });

  it("clamps zero, negatives and non-finite values to 0", () => {
    expect(clampCountdownSeconds(0)).toBe(0);
    expect(clampCountdownSeconds(-10)).toBe(0);
    expect(clampCountdownSeconds(Number.NaN)).toBe(0);
    expect(clampCountdownSeconds(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("passes whole positive seconds through unchanged", () => {
    expect(clampCountdownSeconds(60)).toBe(60);
  });
});
