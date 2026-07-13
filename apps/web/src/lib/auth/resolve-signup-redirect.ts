/**
 * Resolves where a freshly-created account should land after finishing sign-up.
 *
 * A user who arrived from a pricing card (with `?redirect=/subscribe?...`) must
 * be sent to the Stripe checkout — NOT the free demo ERP. A plain sign-up (no
 * plan) lands inside the ERP in read-only demo mode (`/dashboard`).
 *
 * `redirect` is only honoured for explicit payment-flow paths — never an
 * arbitrary or external URL (open-redirect protection).
 */

const PAYMENT_FLOW_PREFIXES = ["/subscribe", "/checkout-success"];

export function resolvePostSignupRedirect(params: {
  redirect?: string | null;
  plan?: string | null;
  interval?: string | null;
}): string {
  const { redirect, plan } = params;
  const interval = params.interval || "monthly";

  if (redirect) {
    const decoded = (() => {
      try {
        return decodeURIComponent(redirect);
      } catch {
        return redirect;
      }
    })();
    const base = decoded.split("?")[0];
    const isInternal = decoded.startsWith("/") && !decoded.startsWith("//");
    const isPaymentFlow = PAYMENT_FLOW_PREFIXES.some(
      (prefix) => base === prefix || base.startsWith(prefix + "/"),
    );
    if (isInternal && isPaymentFlow) {
      return decoded;
    }
  }

  if (plan) {
    return `/subscribe?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval)}`;
  }

  return "/dashboard";
}
