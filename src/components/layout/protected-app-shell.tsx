"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { BottomDock } from "@/components/layout/bottom-dock";
import { SubscriptionGuard } from "@/components/shared/subscription-guard";

export function ProtectedAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-card">
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <Header sidebarWidth={0} />
        <SubscriptionGuard>
          <main
            id="main-content"
            className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-8"
          >
            {children}
          </main>
        </SubscriptionGuard>
      </div>
      <BottomDock />
    </div>
  );
}
