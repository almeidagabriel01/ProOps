"use client";

import Link from "next/link";
import { UserPlan, BillingInterval } from "@/types";
import { Button } from "@/components/ui/button";
import { BillingToggle } from "@/components/ui/billing-toggle";
import { PlanCard } from "@/components/profile/PlanCard";
import { Puzzle, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BillingTabProps {
  allPlans: UserPlan[];
  userPlan: UserPlan | null;
  billingInterval: BillingInterval;
  setBillingInterval: (interval: BillingInterval) => void;
  isCurrentPlan: (plan: UserPlan) => boolean;
  canUpgrade: (plan: UserPlan) => boolean;
  upgradingPlan: string | null;
  downgradingPlan: string | null;
  handleUpgrade: (plan: UserPlan) => void;
  handleDowngrade: (plan: UserPlan) => void;
  handleManagePayment: () => void;
  isMaster: boolean;
  openingPortal: boolean;
  subscriptionStatus?: string;
  trialEndsAt?: string;
}

export function BillingTab({
  allPlans,
  userPlan,
  billingInterval,
  setBillingInterval,
  isCurrentPlan,
  canUpgrade,
  upgradingPlan,
  downgradingPlan,
  handleUpgrade,
  handleDowngrade,
  handleManagePayment,
  isMaster,
  openingPortal,
  subscriptionStatus,
  trialEndsAt,
}: BillingTabProps) {
  if (!isMaster) {
    return (
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="text-center pb-10 pt-10">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <CreditCard className="w-6 h-6 text-muted-foreground" />
          </div>
          <CardTitle>Acesso Restrito</CardTitle>
          <CardDescription className="max-w-md mx-auto mt-2">
            Apenas o administrador da conta ({isMaster ? "Você" : "Master"})
            pode gerenciar planos e faturamento. Entre em contato com o
            responsável se você precisa de alterações.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/40 p-6 rounded-xl border border-border shadow-sm">
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-semibold tracking-tight">
            Assinatura & Planos
          </h2>
          <p className="text-muted-foreground text-sm">
            Gerencie seu plano atual e método de pagamento
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/profile/addons">
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-background hover:bg-accent hover:text-accent-foreground border-border/50 shadow-sm"
            >
              <Puzzle className="w-4 h-4 mr-2 text-indigo-500" />
              Add-ons
            </Button>
          </Link>
          {userPlan && (
            <Button
              variant="default"
              size="sm"
              className="h-9 shadow-sm"
              onClick={handleManagePayment}
              disabled={openingPortal}
            >
              {openingPortal ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Abrindo...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Gerenciar Pagamento
                  <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Billing Interval Toggle */}
      <div className="flex justify-center pb-4">
        <div>
          <BillingToggle
            id="profile-toggle"
            value={billingInterval}
            onChange={setBillingInterval}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {allPlans.map((plan) => {
          const isCurrent = isCurrentPlan(plan);
          const trialStillActive =
            !!trialEndsAt && new Date(trialEndsAt) > new Date();
          const isTrialing =
            isCurrent &&
            (subscriptionStatus === "trialing" || trialStillActive);
          const isActivePlan =
            isCurrent && subscriptionStatus === "active" && !trialStillActive;
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingInterval={billingInterval}
              isCurrent={isCurrent}
              canUpgrade={canUpgrade(plan)}
              isProcessing={upgradingPlan !== null || downgradingPlan !== null}
              processingTier={upgradingPlan || downgradingPlan}
              onUpgrade={handleUpgrade}
              onDowngrade={handleDowngrade}
              isMaster={isMaster}
              isTrialing={isTrialing}
              isActivePlan={isActivePlan}
              trialEndsAt={isTrialing ? trialEndsAt : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
