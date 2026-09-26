// @vitest-environment jsdom
/**
 * Notas Fiscais, Comissões e Agenda não tinham skeleton próprio: a rota
 * carregava com o desenho do dashboard, e as telas abriam com spinner.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: null }),
}));

import { RouteContentSkeleton } from "../route-content-skeleton";

const CASOS: Array<[string, string]> = [
  ["/invoices", "invoices-skeleton"],
  ["/commissions", "commissions-skeleton"],
  ["/dre", "dre-skeleton"],
  ["/calendar", "calendar-skeleton"],
];

describe("RouteContentSkeleton: módulos com skeleton próprio", () => {
  it.each(CASOS)("%s carrega com o desenho da própria tela", (pathname, testId) => {
    render(<RouteContentSkeleton pathname={pathname} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
});
