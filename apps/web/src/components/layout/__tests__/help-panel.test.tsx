// @vitest-environment jsdom
/**
 * O "?" do cabeçalho: explica a tela atual com o texto do tutorial, reabre o
 * tutorial por capítulo e mostra o suporte humano.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OnboardingStep } from "@/components/onboarding/onboarding-steps";

const step = (id: string, chapter: OnboardingStep["chapter"], title: string): OnboardingStep => ({
  id,
  route: `/${id}`,
  chapter,
  title,
  description: `Descrição de ${title}`,
  checklist: [`Dica de ${title}`],
  actionLabel: "Próximo",
});

const STEPS = [
  step("dashboard", "overview", "Início"),
  step("proposals", "sales", "Propostas"),
  step("crm", "sales", "CRM"),
  step("transactions", "financial", "Lançamentos"),
];

const onboarding = vi.hoisted(() => ({
  value: null as null | Record<string, unknown>,
}));
vi.mock("@/components/onboarding/onboarding-provider", () => ({
  useOptionalOnboarding: () => onboarding.value,
}));

import { HelpPanel, chapterEntrySteps } from "../help-panel";

let openTutorial: ReturnType<typeof vi.fn>;
let goToStep: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openTutorial = vi.fn(async () => {});
  goToStep = vi.fn();
  onboarding.value = {
    steps: STEPS,
    matchedStep: STEPS[1],
    openTutorial,
    goToStep,
  };
});

describe("chapterEntrySteps", () => {
  it("um botão por capítulo, começando no primeiro passo dele", () => {
    expect(
      chapterEntrySteps(STEPS).map((e) => [e.label, e.step.id]),
    ).toEqual([
      ["Visão geral", "dashboard"],
      ["Vendas", "proposals"],
      ["Financeiro", "transactions"],
    ]);
  });
});

describe("HelpPanel", () => {
  it("explica a tela atual com o texto do tutorial", async () => {
    render(<HelpPanel canOpenTutorial />);
    await userEvent.click(screen.getByRole("button", { name: /ajuda desta tela/i }));

    expect(screen.getByText("Descrição de Propostas")).toBeInTheDocument();
    expect(screen.getByText("Dica de Propostas")).toBeInTheDocument();
  });

  it("reabre o tutorial no capítulo escolhido", async () => {
    render(<HelpPanel canOpenTutorial />);
    await userEvent.click(screen.getByRole("button", { name: /ajuda desta tela/i }));
    await userEvent.click(screen.getByRole("button", { name: "Financeiro" }));

    expect(openTutorial).toHaveBeenCalled();
    expect(goToStep).toHaveBeenCalledWith(STEPS[3]);
  });

  it("mostra o suporte humano por WhatsApp e e-mail", async () => {
    render(<HelpPanel canOpenTutorial />);
    await userEvent.click(screen.getByRole("button", { name: /ajuda desta tela/i }));

    expect(screen.getByRole("link", { name: /whatsapp/i }).getAttribute("href")).toContain("wa.me");
    expect(screen.getByRole("link", { name: /e-mail/i })).toHaveAttribute(
      "href",
      "mailto:gestao@proops.com.br",
    );
  });

  it("sem tutorial (super admin) sobra só o suporte", async () => {
    render(<HelpPanel canOpenTutorial={false} />);
    await userEvent.click(screen.getByRole("button", { name: /ajuda desta tela/i }));

    expect(screen.queryByText(/tutorial por capítulo/i)).toBeNull();
    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
  });

  it("tela sem passo no tutorial mostra a ajuda geral", async () => {
    onboarding.value = { ...onboarding.value, matchedStep: null };
    render(<HelpPanel canOpenTutorial />);
    await userEvent.click(screen.getByRole("button", { name: /ajuda desta tela/i }));

    expect(screen.getByText(/fale com a nossa equipe/i)).toBeInTheDocument();
  });
});
