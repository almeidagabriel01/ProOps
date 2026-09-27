"use client";

import * as React from "react";
import { Bell, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/providers/permissions-provider";
import { toast } from "@/lib/toast";
import {
  NOTIFICATION_CATALOG,
  NOTIFICATION_GROUPS,
  resolveChannelPreference,
  visibleNotificationTypes,
  type CatalogNotificationType,
  type NotificationPreferences,
} from "@/lib/notifications/catalog";
import { NotificationService } from "@/services/notification-service";

type Channel = "inApp" | "email";

/**
 * O que chega a cada pessoa, no sino e por e-mail. Só aparecem os tipos que
 * ela recebe: um membro sem acesso ao financeiro não vê "pagamento recebido"
 * aqui, pela mesma regra que o backend usa para escolher os destinatários.
 */
export function NotificationPreferencesPanel() {
  const { permissions, isMaster, isDemo, isLoading: permissionsLoading } = usePermissions();
  const [prefs, setPrefs] = React.useState<NotificationPreferences>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    // A conta de demonstração não tem preferências: mostra os padrões.
    if (isDemo) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    NotificationService.getPreferences()
      .then((value) => {
        if (!cancelled) setPrefs(value);
      })
      .catch(() => {
        if (!cancelled) toast.error("Não foi possível carregar as suas preferências.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  const types = visibleNotificationTypes(
    isMaster || isDemo,
    (pageId) => permissions?.pages?.[pageId]?.canView === true,
  );

  const toggle = async (type: CatalogNotificationType, channel: Channel, value: boolean) => {
    const key = `${type}:${channel}`;
    const previous = prefs;
    setPrefs((current) => ({ ...current, [type]: { ...current[type], [channel]: value } }));
    setSaving((current) => new Set(current).add(key));
    try {
      const saved = await NotificationService.updatePreferences({ [type]: { [channel]: value } });
      setPrefs(saved);
    } catch {
      setPrefs(previous);
      toast.error("Não foi possível salvar a preferência.");
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {isDemo
          ? "Na conta de demonstração as preferências ficam só para ver."
          : "Cada pessoa da equipe escolhe as suas. Os lembretes diários ficam só no sino, para a sua caixa de entrada não receber um e-mail por pendência todo dia."}
      </p>

      {NOTIFICATION_GROUPS.map((group) => {
        const groupTypes = types.filter((type) => NOTIFICATION_CATALOG[type].group === group.id);
        if (groupTypes.length === 0) return null;
        return (
          <section key={group.id} className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
            <ul className="divide-y rounded-xl border">
              {groupTypes.map((type) => {
                const entry = NOTIFICATION_CATALOG[type];
                const channel = resolveChannelPreference(prefs, type);
                return (
                  <li
                    key={type}
                    className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-sm text-muted-foreground">{entry.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-6">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Bell className="h-4 w-4" />
                        Sino
                        <Switch
                          checked={channel.inApp}
                          disabled={isDemo || saving.has(`${type}:inApp`)}
                          aria-label={`${entry.label} no sino`}
                          onCheckedChange={(value) => void toggle(type, "inApp", value)}
                        />
                      </label>
                      {entry.emailable ? (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          E-mail
                          <Switch
                            checked={channel.email}
                            disabled={isDemo || saving.has(`${type}:email`)}
                            aria-label={`${entry.label} por e-mail`}
                            onCheckedChange={(value) => void toggle(type, "email", value)}
                          />
                        </label>
                      ) : (
                        <span className="w-[5.5rem] text-sm text-muted-foreground">Só no sino</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
