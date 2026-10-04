// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanCard } from "../PlanCard";
import { DEFAULT_PLANS } from "@/lib/plans/default-plans";
import type { UserPlan } from "@/types";

const starter = { id: "starter", ...DEFAULT_PLANS.find((p) => p.tier === "starter")! } as UserPlan;

function renderCard(props: Partial<React.ComponentProps<typeof PlanCard>> = {}) {
  const onUpgrade = vi.fn();
  render(
    <PlanCard
      plan={{ ...starter, price: 99, pricing: { monthly: 99, yearly: 990 } }}
      billingInterval="monthly"
      isCurrent={false}
      canUpgrade
      isProcessing={false}
      processingTier={null}
      onUpgrade={onUpgrade}
      onDowngrade={vi.fn()}
      isMaster
      {...props}
    />,
  );
  return { onUpgrade };
}

describe("PlanCard no contrato manual", () => {
  it("o card do plano assina pelo cartão, em vez de 'Plano Ativo' travado", () => {
    const { onUpgrade } = renderCard({ isManualContract: true });
    expect(screen.queryByRole("button", { name: "Plano Ativo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assinar este plano" }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("assinatura Stripe continua com o texto de upgrade", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Fazer Upgrade Agora" })).toBeInTheDocument();
  });

  it("plano atual de quem paga pelo Stripe segue travado", () => {
    renderCard({ isCurrent: true });
    expect(screen.getByRole("button", { name: "Plano Ativo" })).toBeDisabled();
  });
});
