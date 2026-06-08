"use client";

import { useEffect, useState } from "react";
import { User, Tenant } from "@/types";
import { PlanUsageCard } from "@/components/shared/plan-usage-card";
import { UsePlanUsageReturn } from "@/hooks/usePlanUsage";
import { PersonalForm } from "./personal-form";
import { OrganizationForm } from "./organization-form";
import { PasswordForm } from "./password-form";
import { MfaSection } from "./mfa-section";
import { AsaasConnectCard } from "@/app/settings/_components/asaas-connect-card";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

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
  const isFree = user?.role?.toLowerCase() === "free";
  const [hasPasswordProvider, setHasPasswordProvider] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const hasPassword =
        firebaseUser?.providerData?.some(
          (provider) => provider.providerId === "password",
        ) || false;
      setHasPasswordProvider(hasPassword);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-2 items-start">
      {/* Left Column: Personal Info + Password */}
      <div className="flex flex-col gap-6">
        <PersonalForm user={user} />
        {hasPasswordProvider ? (
          <PasswordForm />
        ) : (
          !isFree && <PlanUsageCard variant="profile" data={planUsageData} />
        )}
        <MfaSection />
        {isMaster && <AsaasConnectCard />}
      </div>
      {/* Right Column: Organization + Plan Usage */}
      <div className="flex flex-col gap-6">
        <OrganizationForm tenant={tenant} isMaster={isMaster} />
        {!isFree && hasPasswordProvider && (
          <PlanUsageCard variant="profile" data={planUsageData} />
        )}
      </div>
    </div>
  );
}
