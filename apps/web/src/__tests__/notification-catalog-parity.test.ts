import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_CATALOG as backendCatalog,
  NOTIFICATION_TYPES as backendTypes,
  notificationLinkPath as backendLink,
  resolveChannelPreference as backendChannel,
} from "../../../functions/src/shared/notification-catalog";
import {
  NOTIFICATION_CATALOG as frontCatalog,
  NOTIFICATION_TYPES as frontTypes,
  resolveChannelPreference as frontChannel,
} from "@/lib/notifications/catalog";
import { notificationLinkPath as frontLink } from "@/lib/notifications/links";
import { NotificationType } from "@/types/notification";
import type { Notification } from "@/types/notification";

/**
 * A tela de preferências mostra o que o backend decide. Se as duas cópias
 * divergirem, a tela promete um e-mail que não sai, ou esconde um tipo que a
 * pessoa recebe.
 */
describe("catálogo de notificações: front e backend iguais", () => {
  it("mesmos tipos", () => {
    expect([...frontTypes].sort()).toEqual([...backendTypes].sort());
  });

  it("todo tipo do enum da tela está no catálogo", () => {
    expect(Object.values(NotificationType).sort()).toEqual([...backendTypes].sort());
  });

  it.each([...backendTypes])("%s: mesmo destinatário e mesma regra de e-mail", (type) => {
    const front = frontCatalog[type];
    const back = backendCatalog[type];
    expect({ audience: front.audience, emailable: front.emailable, defaultEmail: front.defaultEmail }).toEqual(back);
  });

  it.each([...backendTypes])("%s: mesma preferência efetiva", (type) => {
    const cases = [undefined, { [type]: { email: true } }, { [type]: { inApp: false, email: false } }];
    for (const prefs of cases) {
      expect(frontChannel(prefs, type)).toEqual(backendChannel(prefs, type));
    }
  });
});

describe("link da notificação: sino, central e e-mail levam ao mesmo lugar", () => {
  const ids = { proposalId: "p1", transactionId: "t1", leadId: "l1", clientId: "c1", projectId: "pr1" };
  const variantes: Array<Partial<Notification>> = [
    ids,
    {},
    { clientId: "c1" },
    { proposalId: "p1" },
  ];

  it.each([...backendTypes])("%s", (type) => {
    for (const variante of variantes) {
      const n = { type, ...variante } as Notification;
      expect(frontLink(n)).toBe(backendLink(n));
    }
  });
});
