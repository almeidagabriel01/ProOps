// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { VerificationCodeInput } from "../verification-code-input";
import { RecoveryCodeInput } from "../recovery-code-input";

// input-otp observes its container size; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver;

describe("VerificationCodeInput", () => {
  it("renders 6 numeric slots", () => {
    const { container } = render(
      <VerificationCodeInput value="" onChange={vi.fn()} />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("maxlength", "6");
  });

  it("forwards typed digits through onChange", () => {
    const onChange = vi.fn();
    const { container } = render(
      <VerificationCodeInput value="" onChange={onChange} />,
    );
    const input = container.querySelector("input")!;
    fireEvent.change(input, { target: { value: "123456" } });
    expect(onChange).toHaveBeenCalledWith("123456");
  });

  it("reflects the current value across the slots", () => {
    const { container } = render(
      <VerificationCodeInput value="123" onChange={vi.fn()} />,
    );
    expect(container.querySelector("input")).toHaveValue("123");
  });
});

describe("RecoveryCodeInput", () => {
  it("renders 8 slots split into two groups (xxxx-xxxx)", () => {
    const { container } = render(
      <RecoveryCodeInput value="" onChange={vi.fn()} />,
    );
    const input = container.querySelector("input");
    expect(input).toHaveAttribute("maxlength", "8");
    // Two groups + a separator between them.
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
  });

  it("lowercases the value (backend normalizes; keep display consistent)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RecoveryCodeInput value="" onChange={onChange} />,
    );
    const input = container.querySelector("input")!;
    fireEvent.change(input, { target: { value: "AB23CD45" } });
    expect(onChange).toHaveBeenCalledWith("ab23cd45");
  });
});
