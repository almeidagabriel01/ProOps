// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { CredentialFields } from "../form-fields";

// CredentialFields is a pure presentational component — render it directly with
// the minimum required props and toggle isEmailValidating to assert the
// in-input spinner + field lock added for the on-blur backend validation.
function renderEmailField(isEmailValidating: boolean) {
  return render(
    <CredentialFields
      email="user@example.com"
      onEmailChange={vi.fn()}
      onEmailBlur={vi.fn()}
      isEmailValidating={isEmailValidating}
      password=""
      onPasswordChange={vi.fn()}
      mode="register"
    />,
  );
}

describe("CredentialFields — email validation loading state", () => {
  it("disables the email input and shows a spinner while validating", () => {
    const { container } = renderEmailField(true);

    expect(screen.getByPlaceholderText("seu@email.com")).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("keeps the email input enabled with no spinner when not validating", () => {
    const { container } = renderEmailField(false);

    expect(screen.getByPlaceholderText("seu@email.com")).toBeEnabled();
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("defaults to enabled with no spinner when isEmailValidating is omitted", () => {
    const { container } = render(
      <CredentialFields
        email=""
        onEmailChange={vi.fn()}
        password=""
        onPasswordChange={vi.fn()}
        mode="register"
      />,
    );

    expect(screen.getByPlaceholderText("seu@email.com")).toBeEnabled();
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
