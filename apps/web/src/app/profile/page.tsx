"use client";

import { m as motion } from "motion/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { useDisplayTenant } from "@/hooks/useDisplayTenant";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanChange } from "@/hooks/usePlanChange";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  ProfileHeader,
  PlanChangeDialog,
  OverviewTab,
  BillingTab,
  MySubscriptionTab,
} from "@/components/profile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSkeleton } from "./_components/profile-skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

function ProfileContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();
  // Free users don't get a hydrated tenant from the provider; fetch the company
  // doc display-only so the header/overview show the real name and logo.
  const { tenant: displayTenant } = useDisplayTenant();
  const effectiveTenant = tenant ?? displayTenant;
  const { isMaster } = usePermissions();
  const planUsageData = usePlanUsage();
  const { purchasedAddons, purchasedAddonsData, refreshAddons } = usePlanLimits();

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

  const isFree = user?.role === "free";

  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const availableTabs = isFree
    ? ["overview", "billing"]
    : ["overview", "subscription", "billing"];
  const tabFromUrl = availableTabs.includes(tabParam || "")
    ? tabParam!
    : "overview";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Sync activeTab with URL changes (for when clicking links within the page)
  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  // Update both state and URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const query = tab === "overview" ? "" : `?tab=${tab}`;
    router.replace(`/profile${query}`, { scroll: false });
  };

  if (isPageLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-6">
        {user?.role === "superadmin" && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
        )}
        {/* Header Section */}
        <ProfileHeader
          user={effectiveUser}
          tenant={effectiveTenant}
          userPlan={userPlan}
          isMaster={isMaster}
        />

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <div className="flex justify-center pb-2">
            <TabsList
              className={`relative grid w-full h-12 p-1 rounded-full border border-border/10 shadow-sm ${availableTabs.length === 2 ? "max-w-[340px] grid-cols-2" : "max-w-[500px] grid-cols-3"}`}
              style={{
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {availableTabs.map((tab) => (
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
                      "relative z-10 font-medium transition-colors duration-200 text-sm",
                      activeTab === tab
                        ? "text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {tab === "overview"
                      ? "Visão Geral"
                      : tab === "subscription"
                        ? "Minha Assinatura"
                        : "Planos"}
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
                tenant={effectiveTenant}
                isMaster={isMaster}
                planUsageData={planUsageData}
              />
            </motion.div>
          </TabsContent>

          {!isFree && (
            <TabsContent value="subscription" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <MySubscriptionTab
                  user={effectiveUser}
                  userPlan={userPlan}
                  purchasedAddons={purchasedAddons}
                  addonsData={purchasedAddonsData}
                  handleManagePayment={handleManagePayment}
                  openingPortal={openingPortal}
                  isMaster={isMaster}
                  tenant={effectiveTenant}
                  onAddonCancelled={refreshAddons}
                />
              </motion.div>
            </TabsContent>
          )}

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
                isFree={isFree}
                openingPortal={openingPortal}
                subscriptionStatus={user?.subscriptionStatus}
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
        billingInterval={billingInterval}
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
