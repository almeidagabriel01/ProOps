// @vitest-environment jsdom
/**
 * O passo de grupos da proposta em cada nicho. Em segurança o local é "área"
 * (feminino) e o grupo é "sistema" (masculino), o inverso de automação; os
 * textos fixos falavam "ambiente" e "solução" para todo mundo, e o fluxo de
 * automação ainda misturava "sistema" com "solução" na mesma tela.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import type { NicheVocabulary } from "@/lib/niches/vocabulary";
import type { ProposalSistema } from "@/types/automation";
import type { ProposalProduct } from "@/services/proposal-service";
import type { SistemaSelectorProps } from "@/components/features/automation/sistema-selector";
import { ProposalSystemsSection } from "../proposal-systems-section";

const vocabularyRef = vi.hoisted(() => ({
  current: null as NicheVocabulary | null,
}));
vi.mock("@/hooks/useNicheVocabulary", () => ({
  useNicheVocabulary: () =>
    vocabularyRef.current ?? NICHE_CONFIGS.automacao_residencial.vocabulary,
}));

// O gerenciador abre o cadastro inteiro (e o provider do tenant); aqui só
// interessa o texto da seção.
vi.mock(
  "@/components/features/automation/system-environment-manager-dialog",
  () => ({ SystemEnvironmentManagerDialog: () => null }),
);

const toastMock = vi.hoisted(() => ({
  warning: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: toastMock }));

const sistema: ProposalSistema = {
  sistemaId: "sis1",
  sistemaName: "CFTV",
  ambienteId: "amb1",
  ambienteName: "Portaria",
  ambientes: [{ ambienteId: "amb1", ambienteName: "Portaria", products: [] }],
} as unknown as ProposalSistema;

const produto: ProposalProduct = {
  productId: "p1",
  itemType: "product",
  productName: "Câmera bullet",
  quantity: 1,
  unitPrice: 100,
  markup: 0,
  total: 100,
  systemInstanceId: "sis1-amb1",
  status: "active",
} as unknown as ProposalProduct;

let selectorOnChange: SistemaSelectorProps["onChange"] | null = null;
function FakeSelector(props: SistemaSelectorProps) {
  selectorOnChange = props.onChange;
  return null;
}

function renderSection(selectedSistemas: ProposalSistema[]) {
  const config = vocabularyRef.current
    ? NICHE_CONFIGS.seguranca_eletronica
    : NICHE_CONFIGS.automacao_residencial;
  render(
    <ProposalSystemsSection
      heading={config.proposal.groupsStep.heading}
      description={config.proposal.groupsStep.cardDescription}
      selectedSistemas={selectedSistemas}
      selectedProducts={selectedSistemas.length > 0 ? [produto] : []}
      products={[]}
      primaryColor="#2563eb"
      selectorKey={0}
      onEditSystem={vi.fn()}
      onRemoveSystem={vi.fn()}
      onUpdateProductQuantity={vi.fn()}
      onUpdateProductMarkup={vi.fn()}
      onUpdateProductPrice={vi.fn()}
      onAddExtraProductToSystem={vi.fn()}
      onAddNewSystem={vi.fn()}
      onRemoveProduct={vi.fn()}
      SistemaSelectorComponent={FakeSelector}
      onRemoveAmbiente={vi.fn()}
    />,
  );
}

function selectSecurity() {
  vocabularyRef.current = NICHE_CONFIGS.seguranca_eletronica.vocabulary;
}

afterEach(() => {
  vocabularyRef.current = null;
  selectorOnChange = null;
  toastMock.warning.mockClear();
});

describe("ProposalSystemsSection: segurança eletrônica", () => {
  it("convida a escolher o primeiro sistema, no masculino", () => {
    selectSecurity();
    renderSection([]);
    expect(
      screen.getByText("Selecione o primeiro sistema para esta proposta"),
    ).toBeInTheDocument();
  });

  it("oferece outro sistema, e fala em área no local sem produto", () => {
    selectSecurity();
    renderSection([sistema]);
    expect(screen.getByText("+ Adicionar outro sistema")).toBeInTheDocument();
    expect(screen.getByTitle("Remover sistema")).toBeInTheDocument();
    expect(screen.getByTitle("Remover área")).toBeInTheDocument();
  });

  it("confirma a remoção da área com a concordância no feminino", async () => {
    selectSecurity();
    renderSection([sistema]);
    await userEvent.click(screen.getByTitle("Remover área"));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Remover Área");
    expect(dialog).toHaveTextContent(
      "Tem certeza que deseja remover a área Portaria?",
    );
    expect(dialog).toHaveTextContent("Os produtos desta área saem da proposta.");
    expect(dialog).not.toHaveTextContent(/ambiente|solução/i);
  });

  it("confirma a remoção do grupo como sistema", async () => {
    selectSecurity();
    renderSection([sistema]);
    await userEvent.click(screen.getByTitle("Remover sistema"));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Remover Sistema");
    expect(dialog).toHaveTextContent(
      "Tem certeza que deseja remover o sistema CFTV",
    );
  });

  it("avisa a combinação repetida com uma oração por termo", async () => {
    selectSecurity();
    renderSection([sistema]);
    await act(async () => {
      selectorOnChange?.({ ...sistema });
    });
    await vi.waitFor(() => expect(toastMock.warning).toHaveBeenCalled());
    expect(toastMock.warning).toHaveBeenCalledWith(
      'O sistema "CFTV" já está na área "Portaria". Escolha outro sistema ou outra área.',
    );
  });
});

describe("ProposalSystemsSection: automação residencial", () => {
  it("mantém solução e ambiente", () => {
    renderSection([sistema]);
    expect(screen.getByText("+ Adicionar outra solução")).toBeInTheDocument();
    expect(screen.getByTitle("Remover solução")).toBeInTheDocument();
    expect(screen.getByTitle("Remover ambiente")).toBeInTheDocument();
  });

  it("o aviso de combinação repetida fala em solução, não em sistema", async () => {
    renderSection([sistema]);
    await act(async () => {
      selectorOnChange?.({ ...sistema });
    });
    await vi.waitFor(() => expect(toastMock.warning).toHaveBeenCalled());
    expect(toastMock.warning).toHaveBeenCalledWith(
      'A solução "CFTV" já está no ambiente "Portaria". Escolha outra solução ou outro ambiente.',
    );
  });
});
