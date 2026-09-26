"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationList } from "./_components/notification-list";
import { NotificationPreferencesPanel } from "./_components/notification-preferences";

type View = "list" | "preferencias";

/**
 * Central de notificações: o histórico de cada pessoa e o que chega a ela, no
 * sino e por e-mail. Aberta pelo "Ver todas" do sino; sem `pageId`, porque
 * cada membro tem a sua, como o Perfil.
 */
export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: View = searchParams.get("tab") === "preferencias" ? "preferencias" : "list";
  const notificationsState = useNotifications();

  const setView = (next: string) => {
    router.replace(next === "preferencias" ? "/notifications?tab=preferencias" : "/notifications", {
      scroll: false,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Notificações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que aconteceu com as suas propostas, cobranças e obras, e o que chega até você por
          e-mail.
        </p>
      </div>

      <SegmentedControl
        id="notifications-view"
        value={view}
        onChange={setView}
        options={[
          {
            value: "list",
            label: "Notificações",
            count: notificationsState.isLoading ? undefined : notificationsState.unreadCount,
          },
          { value: "preferencias", label: "Preferências" },
        ]}
      />

      {view === "list" ? (
        <NotificationList state={notificationsState} />
      ) : (
        <NotificationPreferencesPanel />
      )}
    </div>
  );
}
