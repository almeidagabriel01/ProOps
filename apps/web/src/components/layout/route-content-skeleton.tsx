"use client";

import * as React from "react";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { ProfileSkeleton } from "@/app/profile/_components/profile-skeleton";
import { FinancialSkeleton } from "@/app/transactions/_components/financial-skeleton";
import { TeamSkeleton } from "@/app/team/_components/team-skeleton";
import {
  SettingsShellSkeleton,
  SettingsSecuritySkeleton,
  SettingsPaymentsSkeleton,
  SettingsProposalsSkeleton,
  SettingsFiscalSkeleton,
  SettingsDriveSkeleton,
  SettingsTechnicalResponsiblesSkeleton,
  SettingsLinkedAccountsSkeleton,
  SettingsTeamSkeleton,
} from "@/app/settings/_components/settings-skeleton";
import { AdminSkeleton } from "@/app/admin/_components/admin-skeleton";
import { AdminOverviewSkeleton } from "@/app/admin/overview/_components/admin-overview-skeleton";
import { ProductsSkeleton } from "@/app/products/_components/products-skeleton";
import { ServicesSkeleton } from "@/app/services/_components/services-skeleton";
import { ProposalsSkeleton } from "@/app/proposals/_components/proposals-skeleton";
import { ProposalLoadingState } from "@/components/features/proposal/proposal-loading-state";
import { ContactsSkeleton } from "@/app/contacts/_components/contacts-skeleton";
import { AddonsSkeleton } from "@/app/profile/addons/_components/addons-skeleton";
import { AutomationSkeleton } from "@/components/features/automation/automation-skeleton";
import { WalletsSkeleton } from "@/app/wallets/_components/wallets-skeleton";
import { SpreadsheetsSkeleton } from "@/app/spreadsheets/_components/spreadsheets-skeleton";
import { SpreadsheetEditorSkeleton } from "@/app/spreadsheets/[id]/_components/spreadsheet-editor-skeleton";
import { KanbanSkeleton } from "@/app/crm/_components/kanban-skeleton";
import { InvoicesSkeleton } from "@/app/invoices/_components/invoices-skeleton";
import { CommissionsSkeleton } from "@/app/commissions/_components/commissions-skeleton";
import { DreSkeleton } from "@/app/dre/_components/dre-skeleton";
import { CashFlowSkeleton } from "@/app/cash-flow/_components/cash-flow-skeleton";
import { CalendarSkeleton } from "@/app/calendar/_components/calendar-skeleton";
import { GoalsSkeleton } from "@/app/goals/_components/goals-skeleton";
import { BookingSkeleton } from "@/app/booking/_components/booking-skeleton";
import { useTenant } from "@/providers/tenant-provider";
import { isPageEnabledForNiche } from "@/lib/niches/config";

/** Simple spinner used for create/edit sub-routes instead of the full page skeleton */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SpinnerFallback({ message: _message }: { message?: string } = {}) {
  return <FullPageLoading />;
}

export function SettingsSectionSkeleton({ pathname }: { pathname: string }) {
  if (pathname.startsWith("/settings/security")) return <SettingsSecuritySkeleton />;
  if (pathname.startsWith("/settings/payments")) return <SettingsPaymentsSkeleton />;
  if (pathname.startsWith("/settings/proposals")) return <SettingsProposalsSkeleton />;
  if (pathname.startsWith("/settings/fiscal")) return <SettingsFiscalSkeleton />;
  if (pathname.startsWith("/settings/drive")) return <SettingsDriveSkeleton />;
  if (pathname.startsWith("/settings/technical-responsibles")) {
    return <SettingsTechnicalResponsiblesSkeleton />;
  }
  if (pathname.startsWith("/settings/linked-accounts")) {
    return <SettingsLinkedAccountsSkeleton />;
  }
  // /settings/team and bare /settings (redirects to team).
  return <SettingsTeamSkeleton />;
}

export function RouteContentSkeleton({ pathname }: { pathname: string }) {
  const { tenant } = useTenant();

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
  if (pathname.startsWith("/transactions")) {
    return pathname === "/transactions" ? (
      <FinancialSkeleton />
    ) : (
      <SpinnerFallback />
    );
  }

  if (pathname.startsWith("/products")) {
    return pathname === "/products" ? (
      <ProductsSkeleton />
    ) : (
      <SpinnerFallback message="Carregando produtos..." />
    );
  }

  if (pathname.startsWith("/services")) {
    return pathname === "/services" ? (
      <ServicesSkeleton />
    ) : (
      <SpinnerFallback message="Carregando serviços..." />
    );
  }

  if (pathname.startsWith("/proposals")) {
    return pathname === "/proposals" ? (
      <ProposalsSkeleton />
    ) : (
      <ProposalLoadingState />
    );
  }

  if (pathname.startsWith("/contacts")) {
    return pathname === "/contacts" ? (
      <ContactsSkeleton />
    ) : (
      <SpinnerFallback message="Carregando Cliente..." />
    );
  }

  if (pathname.startsWith("/settings")) {
    // Rendered outside the settings layout (protected-route loading), so the
    // shell skeleton supplies the title + sidebar; the section matches the route.
    // A new settings section needs its own case here, or it loads with the
    // team's shape.
    return (
      <SettingsShellSkeleton>
        <SettingsSectionSkeleton pathname={pathname} />
      </SettingsShellSkeleton>
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
    if (!isPageEnabledForNiche(tenant?.niche, "solutions")) {
      return <DashboardSkeleton />;
    }

    return <AutomationSkeleton />;
  }

  if (pathname.startsWith("/crm")) {
    return <KanbanSkeleton />;
  }

  if (pathname.startsWith("/invoices")) {
    return <InvoicesSkeleton />;
  }

  if (pathname.startsWith("/commissions")) {
    return <CommissionsSkeleton />;
  }

  if (pathname.startsWith("/dre")) {
    return <DreSkeleton />;
  }

  if (pathname.startsWith("/cash-flow")) {
    return <CashFlowSkeleton />;
  }

  if (pathname.startsWith("/calendar")) {
    return <CalendarSkeleton />;
  }

  if (pathname.startsWith("/goals")) {
    return <GoalsSkeleton />;
  }

  if (pathname.startsWith("/booking")) {
    return <BookingSkeleton />;
  }

  return <DashboardSkeleton />;
}
