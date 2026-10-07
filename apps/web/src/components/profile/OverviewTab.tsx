"use client";

import { useEffect, useState } from "react";
import { User, Tenant } from "@/types";
import { PlanUsageCard } from "@/components/shared/plan-usage-card";
import { UsePlanUsageReturn } from "@/hooks/usePlanUsage";
import { PersonalForm } from "./personal-form";
import { OrganizationForm } from "./organization-form";
import { PasswordForm } from "./password-form";
import { useTenant } from "@/providers/tenant-provider";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface OverviewTabProps {
  user: User | null;
  tenant: Tenant | null;
  isMaster: boolean;
  planUsageData: UsePlanUsageReturn;
  /**
   * O super admin está vendo o perfil de outra pessoa (o dono ou um membro).
   * Salvar gravaria no doc do próprio super admin (`PUT /v1/profile` usa a
   * identidade logada), e a troca de senha mudaria a senha dele.
   */
  readOnlyPersonalData?: boolean;
}

export function OverviewTab({
  user,
  tenant,
  isMaster,
  planUsageData,
  readOnlyPersonalData = false,
}: OverviewTabProps) {
  const isFree = user?.role?.toLowerCase() === "free";
  // In demo mode `tenant` is the shared demo dataset — the organization form is
  // identity, so show the account's REAL company (accountTenant).
  const { accountTenant } = useTenant();
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

  const showPasswordForm = hasPasswordProvider && !readOnlyPersonalData;

  return (
    <div className="grid gap-6 md:grid-cols-2 items-start">
      {/* Left Column: Personal Info + Password */}
      <div className="flex flex-col gap-6">
        <PersonalForm key={user?.id ?? "none"} user={user} readOnly={readOnlyPersonalData} />
        {showPasswordForm ? (
          <PasswordForm />
        ) : (
          !isFree && <PlanUsageCard variant="profile" data={planUsageData} />
        )}
      </div>
      {/* Right Column: Organization + Plan Usage */}
      <div className="flex flex-col gap-6">
        <OrganizationForm tenant={accountTenant ?? tenant} isMaster={isMaster} />
        {!isFree && showPasswordForm && (
          <PlanUsageCard variant="profile" data={planUsageData} />
        )}
      </div>
    </div>
  );
}
