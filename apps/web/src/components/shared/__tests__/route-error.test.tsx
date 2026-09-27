// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));
vi.mock("@/lib/observability/client-error-reporter", () => ({ reportClientError }));

import { RouteError } from "../route-error";

describe("RouteError", () => {
  it("diz qual tela falhou e reporta o erro", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<RouteError error={error} reset={vi.fn()} moduleName="as propostas" />);

    expect(screen.getByText("Não foi possível abrir as propostas")).toBeInTheDocument();
    expect(screen.getByText("Código: abc123")).toBeInTheDocument();
    expect(reportClientError).toHaveBeenCalledWith(error, expect.anything());
  });

  it("Tentar novamente chama o reset da rota", async () => {
    const reset = vi.fn();
    render(<RouteError error={new Error("boom")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("oferece o suporte com o código do erro na mensagem", () => {
    const error = Object.assign(new Error("boom"), { digest: "xyz" });
    render(<RouteError error={error} reset={vi.fn()} moduleName="a agenda" />);
    const link = screen.getByRole("link", { name: /falar com o suporte/i });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain("xyz");
  });
});
