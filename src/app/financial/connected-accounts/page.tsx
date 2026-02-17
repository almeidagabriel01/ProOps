"use client";

import { useAuth } from "@/providers/auth-provider";
import { ConnectedAccountsList } from "../_components/connected-accounts-list";

export default function ConnectedAccountsPage() {
  const { user } = useAuth();

  if (!user?.tenantId) {
    return null; // Or skeleton
  }

  return (
    <div className="container mx-auto space-y-8 p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Open Finance</h1>
        <p className="text-muted-foreground">
          Gerencie suas conexões bancárias para sincronização automática.
        </p>
      </div>

      <ConnectedAccountsList tenantId={user.tenantId} />
    </div>
  );
}
