/**
 * Unit tests for the no-subscription reminder eligibility logic and email
 * template. Covers the exact reported scenario (free account 2+ days old,
 * never subscribed) plus the role/subscription/marker variants that share the
 * same code path.
 */

jest.mock("./init", () => ({ db: {} }));
jest.mock("./lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { isEligibleForNoSubscriptionReminder } from "./checkInactiveSignups";
import { renderNoSubscriptionReminderEmail } from "./services/email/templates/no-subscription-reminder";

describe("isEligibleForNoSubscriptionReminder", () => {
  const base = {
    role: "free",
    email: "owner@example.com",
    stripeCustomerId: undefined as string | undefined,
    noSubscriptionReminderSentAt: undefined as unknown,
  };

  it("is eligible for a free owner that never subscribed and was not reminded", () => {
    expect(isEligibleForNoSubscriptionReminder(base)).toBe(true);
  });

  it("normalizes role casing (FREE)", () => {
    expect(
      isEligibleForNoSubscriptionReminder({ ...base, role: "FREE" }),
    ).toBe(true);
  });

  it("skips when the reminder was already sent (single-send marker)", () => {
    expect(
      isEligibleForNoSubscriptionReminder({
        ...base,
        noSubscriptionReminderSentAt: "2026-06-05T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("skips a free account that previously subscribed (has stripeCustomerId)", () => {
    expect(
      isEligibleForNoSubscriptionReminder({
        ...base,
        stripeCustomerId: "cus_123",
      }),
    ).toBe(false);
  });

  it("skips when there is no email to send to", () => {
    expect(
      isEligibleForNoSubscriptionReminder({ ...base, email: "" }),
    ).toBe(false);
    expect(
      isEligibleForNoSubscriptionReminder({ ...base, email: "   " }),
    ).toBe(false);
  });

  it.each(["master", "admin", "member", "wk"])(
    "skips paid/non-owner role %s",
    (role) => {
      expect(
        isEligibleForNoSubscriptionReminder({ ...base, role }),
      ).toBe(false);
    },
  );
});

describe("renderNoSubscriptionReminderEmail", () => {
  it("embeds the plans URL in html and text", () => {
    const plansUrl = "https://www.proops.com.br/subscription-blocked/plans";
    const { subject, html, text } = renderNoSubscriptionReminderEmail({
      email: "owner@example.com",
      recipientName: "Maria",
      plansUrl,
    });

    expect(subject).toContain("plano");
    expect(html).toContain(plansUrl);
    expect(html).toContain("Maria");
    expect(text).toContain(plansUrl);
  });

  it("escapes the recipient name to prevent HTML injection", () => {
    const { html } = renderNoSubscriptionReminderEmail({
      email: "owner@example.com",
      recipientName: '<script>alert("x")</script>',
      plansUrl: "https://www.proops.com.br/subscription-blocked/plans",
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders a generic greeting when no name is provided", () => {
    const { html, text } = renderNoSubscriptionReminderEmail({
      email: "owner@example.com",
      plansUrl: "https://www.proops.com.br/subscription-blocked/plans",
    });

    expect(html).toContain("Olá!");
    expect(text).toContain("Olá!");
  });
});
