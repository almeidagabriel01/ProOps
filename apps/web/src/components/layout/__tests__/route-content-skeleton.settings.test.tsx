// @vitest-environment jsdom
/**
 * Skeleton de cada seção de Configurações no carregamento da rota.
 *
 * O `RouteContentSkeleton` só conhecia segurança e pagamentos: propostas,
 * notas fiscais e Drive caíam no skeleton da equipe, e contas vinculadas no do
 * Asaas. A tela carregava com o desenho de outra.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: null }),
}));

import { RouteContentSkeleton } from "../route-content-skeleton";

const CASOS: Array<[string, string]> = [
  ["/settings", "settings-skeleton-team"],
  ["/settings/team", "settings-skeleton-team"],
  ["/settings/security", "settings-skeleton-security"],
  ["/settings/payments", "settings-skeleton-payments"],
  ["/settings/proposals", "settings-skeleton-proposals"],
  ["/settings/fiscal", "settings-skeleton-fiscal"],
  ["/settings/drive", "settings-skeleton-drive"],
  ["/settings/linked-accounts", "settings-skeleton-linked-accounts"],
];

describe("RouteContentSkeleton em /settings", () => {
  it.each(CASOS)("%s carrega com o skeleton da própria seção", (rota, testId) => {
    render(<RouteContentSkeleton pathname={rota} />);

    expect(screen.getByTestId(testId)).toBeInTheDocument();
    // Um skeleton de seção só: nada de dois desenhos empilhados.
    expect(document.querySelectorAll('[data-testid^="settings-skeleton-"]')).toHaveLength(1);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
