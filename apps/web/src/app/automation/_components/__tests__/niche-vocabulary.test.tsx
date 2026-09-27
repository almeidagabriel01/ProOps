// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { TenantNiche } from "@/types";
import type { Sistema } from "@/types/automation";

/**
 * O módulo de soluções e ambientes monta o texto de tela pelo vocabulário do
 * nicho. Em automação o texto continua o de sempre (ambiente, solução); em
 * segurança eletrônica o local é "área" (feminino) e o grupo é "sistema"
 * (masculino), e a frase precisa concordar com cada um.
 */

const tenantState: { niche: TenantNiche } = { niche: "automacao_residencial" };

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1", niche: tenantState.niche } }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/services/product-service", () => ({
  ProductService: {
    getProducts: vi.fn().mockResolvedValue([]),
    invalidateTenantCache: vi.fn(),
  },
}));
vi.mock("@/services/service-service", () => ({
  ServiceService: { getServices: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/services/ambiente-service", () => ({
  AmbienteService: {},
}));
vi.mock("@/components/shared/ai-field-button", () => ({
  AIFieldButton: () => null,
}));

import { SistemaList } from "../sistema-list";
import { AmbienteTemplateList } from "../ambiente-template-list";
import { AmbienteEditor } from "../ambiente-editor";
import { SystemPanel } from "@/components/features/automation/manager/system-panel";
import { EnvironmentList } from "@/components/features/automation/manager/environment-list";

function sistema(ambientesCount: number): Sistema {
  return {
    id: "s1",
    tenantId: "t1",
    name: "CFTV",
    description: "",
    ambientes: Array.from({ length: ambientesCount }, (_, i) => ({
      ambienteId: `a${i}`,
      products: [],
    })),
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
  };
}

const noop = vi.fn();

beforeEach(() => {
  tenantState.niche = "automacao_residencial";
});
afterEach(() => {
  cleanup();
});

describe("vocabulário do nicho no módulo de soluções", () => {
  describe("segurança eletrônica (área feminino, sistema masculino)", () => {
    beforeEach(() => {
      tenantState.niche = "seguranca_eletronica";
    });

    it("lista vazia de grupos concorda no masculino", () => {
      render(<SistemaList sistemas={[]} onEdit={noop} onDelete={noop} />);
      expect(screen.getByText("Nenhum sistema encontrado")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Comece criando seu primeiro sistema para configurar áreas e produtos.",
        ),
      ).toBeInTheDocument();
    });

    it("contagem de locais usa singular e plural do termo", () => {
      const { rerender } = render(
        <SistemaList sistemas={[sistema(1)]} onEdit={noop} onDelete={noop} />,
      );
      expect(screen.getByText("1 área")).toBeInTheDocument();
      rerender(
        <SistemaList sistemas={[sistema(3)]} onEdit={noop} onDelete={noop} />,
      );
      expect(screen.getByText("3 áreas")).toBeInTheDocument();
    });

    it("lista vazia de locais concorda no feminino", () => {
      render(
        <AmbienteTemplateList ambientes={[]} onEdit={noop} onDelete={noop} />,
      );
      expect(screen.getByText("Nenhuma área encontrada")).toBeInTheDocument();
      expect(
        screen.getByText(/Comece criando sua primeira área para configurar/),
      ).toBeInTheDocument();
    });

    it("editor de local novo: Nova Área, Editor da Área", async () => {
      render(<AmbienteEditor ambiente={null} onBack={noop} onSave={noop} />);
      expect(await screen.findByText("Nova Área")).toBeInTheDocument();
      expect(screen.getByText("Editor da Área")).toBeInTheDocument();
      expect(screen.getByText("Gerencie os itens padrão desta área.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Ex: Portaria, Garagem, Perímetro"),
      ).toBeInTheDocument();
    });

    it("painel do gerenciador: Sistemas e Novo Sistema", () => {
      render(
        <SystemPanel
          sistemas={[]}
          selectedSistemaId={null}
          onSelect={noop}
          isMobileMenuOpen={false}
          onCloseMobileMenu={noop}
        />,
      );
      expect(screen.getByText("Sistemas")).toBeInTheDocument();
      expect(screen.getByText(/Novo\s+Sistema/)).toBeInTheDocument();
    });

    it("locais vinculados concordam no feminino", () => {
      render(
        <EnvironmentList activeSystemId="s1" linkedAmbientes={[]} onUnlink={noop} />,
      );
      expect(screen.getByText("Áreas Vinculadas")).toBeInTheDocument();
      expect(screen.getByText(/Adicionar Área/)).toBeInTheDocument();
    });
  });

  describe("automação residencial (texto de sempre)", () => {
    it("lista vazia de grupos", () => {
      render(<SistemaList sistemas={[]} onEdit={noop} onDelete={noop} />);
      expect(screen.getByText("Nenhuma solução encontrada")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Comece criando sua primeira solução para configurar ambientes e produtos.",
        ),
      ).toBeInTheDocument();
    });

    it("contagem de ambientes", () => {
      render(
        <SistemaList sistemas={[sistema(1)]} onEdit={noop} onDelete={noop} />,
      );
      expect(screen.getByText("1 ambiente")).toBeInTheDocument();
    });

    it("lista vazia de ambientes", () => {
      render(
        <AmbienteTemplateList ambientes={[]} onEdit={noop} onDelete={noop} />,
      );
      expect(screen.getByText("Nenhum ambiente encontrado")).toBeInTheDocument();
      expect(
        screen.getByText(/Comece criando seu primeiro ambiente para configurar/),
      ).toBeInTheDocument();
    });

    it("editor de ambiente novo", async () => {
      render(<AmbienteEditor ambiente={null} onBack={noop} onSave={noop} />);
      expect(await screen.findByText("Novo Ambiente")).toBeInTheDocument();
      expect(screen.getByText("Editor do Ambiente")).toBeInTheDocument();
      expect(screen.getByText("Gerencie os itens padrão deste ambiente.")).toBeInTheDocument();
    });

    it("painel do gerenciador: Soluções e Nova Solução", () => {
      render(
        <SystemPanel
          sistemas={[]}
          selectedSistemaId={null}
          onSelect={noop}
          isMobileMenuOpen={false}
          onCloseMobileMenu={noop}
        />,
      );
      expect(screen.getByText("Soluções")).toBeInTheDocument();
      expect(screen.getByText(/Nova\s+Solução/)).toBeInTheDocument();
    });

    it("ambientes vinculados", () => {
      render(
        <EnvironmentList activeSystemId="s1" linkedAmbientes={[]} onUnlink={noop} />,
      );
      expect(screen.getByText("Ambientes Vinculados")).toBeInTheDocument();
      expect(screen.getByText(/Adicionar Ambiente/)).toBeInTheDocument();
    });
  });
});
