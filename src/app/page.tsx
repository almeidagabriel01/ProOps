"use client";

import React from "react";

import {
  useLandingPage,
  LandingNavbar,
  LandingHero,
  LandingFeatures,
  LandingPricing,
  LandingCTA,
  LandingFooter,
  LandingFAQ,
} from "@/components/landing";

import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { ProfileSkeleton } from "@/app/profile/_components/profile-skeleton";
import { FinancialSkeleton } from "@/app/financial/_components/financial-skeleton";
import { TeamSkeleton } from "@/app/settings/team/_components/team-skeleton";
import { AdminSkeleton } from "@/app/admin/_components/admin-skeleton";
import { ProductsSkeleton } from "@/app/products/_components/products-skeleton";
import { ProposalsSkeleton } from "@/app/proposals/_components/proposals-skeleton";
import { CustomersSkeleton } from "@/app/customers/_components/customers-skeleton";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function LandingPage() {
  const {
    isCheckingAuth,
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    initialSkeleton,
    handleSignOut,
  } = useLandingPage();

  // Show loading while checking auth
  if (isCheckingAuth) {
    // Determine content based on skeleton type
    const skeletonType = initialSkeleton || "list";

    const renderSkeleton = () => {
      switch (skeletonType) {
        case "dashboard": return <DashboardSkeleton />;
        case "profile": return <ProfileSkeleton />;
        case "financial": return <FinancialSkeleton />;
        case "team": return <TeamSkeleton />;
        case "admin": return <AdminSkeleton />;
        case "products": return <ProductsSkeleton />;
        case "proposals": return <ProposalsSkeleton />;
        case "clients": return <CustomersSkeleton />;
        default:
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-2" />
                  <div className="h-4 w-64 bg-muted animate-pulse rounded-md" />
                </div>
                <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
              </div>
              <TableSkeleton rowCount={8} columnCount={5} />
            </div>
          );
      }
    };

    return (
      <AppSkeleton>
        {renderSkeleton()}
      </AppSkeleton>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      <LandingHero />

      <LandingFeatures />

      <LandingPricing
        plans={plans}
        billingInterval={billingInterval}
        setBillingInterval={setBillingInterval}
      />

      <LandingFAQ />

      <LandingCTA />

      <LandingFooter />
    </div>
  );
}
