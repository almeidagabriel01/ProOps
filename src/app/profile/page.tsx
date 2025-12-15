"use client";

import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanChange } from "@/hooks/usePlanChange";
import {
    ProfileHeader,
    PlanCard,
    PlanChangeDialog
} from "@/components/profile";

export default function ProfilePage() {
    const { user } = useAuth();
    const { tenant } = useTenant();

    const {
        effectiveUser,
        userPlan,
        allPlans,
        isLoading,
        dialogOpen,
        selectedPlan,
        planPreview,
        loadingPreview,
        isFirstSubscription,
        upgradingPlan,
        downgradingPlan,
        openingPortal,
        handleUpgrade,
        handleDowngrade,
        confirmPlanChange,
        handleManagePayment,
        setDialogOpen,
        isCurrentPlan,
        canUpgrade,
    } = usePlanChange(user, tenant);

    return (
        <>
            <div className="space-y-6 max-w-5xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
                    <p className="text-muted-foreground mt-1">
                        Visualize e gerencie suas informações pessoais
                    </p>
                </div>

                {/* Profile Card - Use effectiveUser (tenant admin when superadmin is viewing) */}
                <ProfileHeader user={effectiveUser} tenant={tenant} />

                {/* Plans Section */}
                {!isLoading && allPlans.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">Meu Plano</h2>
                                <p className="text-muted-foreground text-sm">
                                    Compare seu plano atual com as opções de upgrade
                                </p>
                            </div>
                            {userPlan && (
                                <Button
                                    variant="outline"
                                    size="sm"
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
                                            <ExternalLink className="w-3 h-3 ml-1" />
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {allPlans.map((plan) => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    isCurrent={isCurrentPlan(plan)}
                                    canUpgrade={canUpgrade(plan)}
                                    isProcessing={upgradingPlan !== null || downgradingPlan !== null}
                                    processingTier={upgradingPlan || downgradingPlan}
                                    onUpgrade={handleUpgrade}
                                    onDowngrade={handleDowngrade}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Plan Change Confirmation Dialog */}
            <PlanChangeDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                selectedPlan={selectedPlan}
                preview={planPreview}
                isLoading={loadingPreview}
                isFirstSubscription={isFirstSubscription}
                isProcessing={upgradingPlan !== null || downgradingPlan !== null}
                onConfirm={confirmPlanChange}
                onManagePayment={handleManagePayment}
            />
        </>
    );
}
