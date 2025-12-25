"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanChange } from "@/hooks/usePlanChange";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import {
  ProfileHeader,
  PlanChangeDialog,
  OverviewTab,
  BillingTab,
} from "@/components/profile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSkeleton } from "./_components/profile-skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function ProfileContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { isMaster } = usePermissions();
  const planUsageData = usePlanUsage();

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
    billingInterval,
    setBillingInterval,
  } = usePlanChange(user, tenant);

  // Sync state with user's actual interval
  useEffect(() => {
    if (effectiveUser?.billingInterval) {
      setBillingInterval(effectiveUser.billingInterval);
    }
  }, [effectiveUser?.billingInterval, setBillingInterval]);

  // Loading state - includes plan usage loading
  const isPageLoading =
    isLoading ||
    authLoading ||
    planUsageData.isLoading ||
    (user?.role !== "superadmin" && tenantLoading);

  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl =
    searchParams.get("tab") === "billing" ? "billing" : "overview";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Sync activeTab with URL changes (for when clicking links within the page)
  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  // Update both state and URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/profile${tab === "billing" ? "?tab=billing" : ""}`, {
      scroll: false,
    });
  };

  if (isPageLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      <div className="space-y-6 max-w-5xl mx-auto py-8 px-4 md:px-6 min-h-[calc(100vh-100px)]">
        {/* Header Section */}
        <ProfileHeader
          user={effectiveUser}
          tenant={tenant}
          userPlan={userPlan}
        />

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <div className="flex justify-center pb-2">
            <TabsList
              className="relative grid w-full max-w-[400px] grid-cols-2 h-12 p-1 rounded-full border border-border/10 shadow-sm"
              style={{
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {["overview", "billing"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="relative z-10 rounded-full data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-none h-full hover:bg-muted/10 cursor-pointer"
                >
                  {activeTab === tab && (
                    <motion.div
                      className="absolute inset-0 bg-primary rounded-full shadow-md z-[-1]"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 font-medium transition-colors duration-200",
                      activeTab === tab
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {tab === "overview" ? "Visão Geral" : "Assinatura"}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <OverviewTab
                user={effectiveUser}
                tenant={tenant}
                isMaster={isMaster}
                planUsageData={planUsageData}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="billing" className="mt-0">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <BillingTab
                allPlans={allPlans}
                userPlan={userPlan}
                billingInterval={billingInterval}
                setBillingInterval={setBillingInterval}
                isCurrentPlan={isCurrentPlan}
                canUpgrade={canUpgrade}
                upgradingPlan={upgradingPlan}
                downgradingPlan={downgradingPlan}
                handleUpgrade={handleUpgrade}
                handleDowngrade={handleDowngrade}
                handleManagePayment={handleManagePayment}
                isMaster={isMaster}
                openingPortal={openingPortal}
              />
            </motion.div>
          </TabsContent>
        </Tabs>
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

export default function ProfilePage() {
  return <ProfileContent />;
}
