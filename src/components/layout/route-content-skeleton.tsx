"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { ProfileSkeleton } from "@/app/profile/_components/profile-skeleton";
import { FinancialSkeleton } from "@/app/financial/_components/financial-skeleton";
import { TeamSkeleton } from "@/app/team/_components/team-skeleton";
import { AdminSkeleton } from "@/app/admin/_components/admin-skeleton";
import { AdminOverviewSkeleton } from "@/app/admin/overview/_components/admin-overview-skeleton";
import { ProductsSkeleton } from "@/app/products/_components/products-skeleton";
import { ServicesSkeleton } from "@/app/services/_components/services-skeleton";
import { ProposalsSkeleton } from "@/app/proposals/_components/proposals-skeleton";
import { ContactsSkeleton } from "@/app/contacts/_components/contacts-skeleton";
import { AddonsSkeleton } from "@/app/profile/addons/_components/addons-skeleton";
import { AutomationSkeleton } from "@/components/features/automation/automation-skeleton";
import { WalletsSkeleton } from "@/app/wallets/_components/wallets-skeleton";
import { SpreadsheetsSkeleton } from "@/app/spreadsheets/_components/spreadsheets-skeleton";
import { SpreadsheetEditorSkeleton } from "@/app/spreadsheets/[id]/_components/spreadsheet-editor-skeleton";
import { KanbanSkeleton } from "@/app/kanban/_components/kanban-skeleton";

/** Simple spinner used for create/edit sub-routes instead of the full page skeleton */
function SpinnerFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

export function RouteContentSkeleton({ pathname }: { pathname: string }) {
  if (pathname.startsWith("/spreadsheets/")) {
    return <SpreadsheetEditorSkeleton />;
  }

  if (pathname === "/spreadsheets") {
    return <SpreadsheetsSkeleton />;
  }

  if (pathname.startsWith("/profile/addons")) {
    return <AddonsSkeleton />;
  }

  if (pathname.startsWith("/profile")) {
    return <ProfileSkeleton />;
  }

  if (pathname === "/wallets") {
    return <WalletsSkeleton />;
  }

  // For modules with create/edit sub-routes, show spinner on sub-pages
  // and the full skeleton only on the list page itself
  if (pathname.startsWith("/financial")) {
    return pathname === "/financial" ? (
      <FinancialSkeleton />
    ) : (
      <SpinnerFallback />
    );
  }

  if (pathname.startsWith("/products")) {
    return pathname === "/products" ? (
      <ProductsSkeleton />
    ) : (
      <SpinnerFallback />
    );
  }

  if (pathname.startsWith("/services")) {
    return pathname === "/services" ? (
      <ServicesSkeleton />
    ) : (
      <SpinnerFallback />
    );
  }

  if (pathname.startsWith("/proposals")) {
    return pathname === "/proposals" ? (
      <ProposalsSkeleton />
    ) : (
      <SpinnerFallback />
    );
  }

  if (pathname.startsWith("/contacts")) {
    return pathname === "/contacts" ? (
      <ContactsSkeleton />
    ) : (
      <SpinnerFallback />
    );
  }

  if (pathname.startsWith("/team")) {
    return <TeamSkeleton />;
  }

  if (pathname.startsWith("/admin/overview")) {
    return <AdminOverviewSkeleton />;
  }

  if (pathname.startsWith("/admin")) {
    return <AdminSkeleton />;
  }

  if (pathname.startsWith("/solutions") || pathname.startsWith("/automation")) {
    return <AutomationSkeleton />;
  }

  if (pathname.startsWith("/kanban")) {
    return <KanbanSkeleton />;
  }

  return <DashboardSkeleton />;
}
