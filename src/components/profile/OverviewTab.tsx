"use client";

import { User, Tenant } from "@/types";
import { PlanUsageCard } from "@/components/shared/plan-usage-card";
import { UsePlanUsageReturn } from "@/hooks/usePlanUsage";
import { PersonalForm } from "./personal-form";
import { OrganizationForm } from "./organization-form";

interface OverviewTabProps {
  user: User | null;
  tenant: Tenant | null;
  isMaster: boolean;
  planUsageData: UsePlanUsageReturn;
}

export function OverviewTab({
  user,
  tenant,
  isMaster,
  planUsageData,
}: OverviewTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 items-start">
      {/* Left Column: Personal Info + Plan Usage */}
      <div className="flex flex-col gap-6">
        <PersonalForm user={user} />
        <PlanUsageCard variant="profile" data={planUsageData} />
      </div>
      {/* Right Column: Organization */}
      <OrganizationForm tenant={tenant} isMaster={isMaster} />
    </div>
  );
}
