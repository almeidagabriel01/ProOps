import { describe, it, expect } from "vitest";
import { resolvePostSignupRedirect } from "../resolve-signup-redirect";

describe("resolvePostSignupRedirect", () => {
  it("sends a user who came from a plan card to the Stripe checkout (bug scenario)", () => {
    // Landing pricing card → /login?redirect=/subscribe?plan=pro... → google-setup
    expect(
      resolvePostSignupRedirect({
        redirect: encodeURIComponent("/subscribe?plan=pro&interval=monthly"),
      }),
    ).toBe("/subscribe?plan=pro&interval=monthly");
  });

  it("preserves skipTrial in the payment-flow redirect (subscribe directly)", () => {
    expect(
      resolvePostSignupRedirect({
        redirect: encodeURIComponent(
          "/subscribe?plan=pro&interval=yearly&skipTrial=1",
        ),
      }),
    ).toBe("/subscribe?plan=pro&interval=yearly&skipTrial=1");
  });

  it("lands a plain sign-up (no plan, no redirect) in the demo ERP", () => {
    expect(resolvePostSignupRedirect({})).toBe("/dashboard");
  });

  it("builds the subscribe URL from a top-level plan param when there is no redirect", () => {
    expect(resolvePostSignupRedirect({ plan: "pro", interval: "yearly" })).toBe(
      "/subscribe?plan=pro&interval=yearly",
    );
    // Defaults the interval to monthly.
    expect(resolvePostSignupRedirect({ plan: "starter" })).toBe(
      "/subscribe?plan=starter&interval=monthly",
    );
  });

  it("ignores a non-payment internal redirect and falls back to the demo ERP", () => {
    expect(
      resolvePostSignupRedirect({ redirect: encodeURIComponent("/proposals") }),
    ).toBe("/dashboard");
  });

  it("ignores an external/open redirect (never leaks the user off-site)", () => {
    expect(
      resolvePostSignupRedirect({ redirect: "https://evil.example.com" }),
    ).toBe("/dashboard");
    expect(
      resolvePostSignupRedirect({ redirect: "//evil.example.com/subscribe" }),
    ).toBe("/dashboard");
  });

  it("honours /checkout-success as a payment-flow path", () => {
    expect(
      resolvePostSignupRedirect({
        redirect: encodeURIComponent("/checkout-success?session_id=abc"),
      }),
    ).toBe("/checkout-success?session_id=abc");
  });
});
