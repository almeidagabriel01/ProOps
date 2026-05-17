# Feature Research

**Domain:** Billing & Payment Hardening — multi-tenant SaaS (Brazil, Stripe + MercadoPago)
**Researched:** 2026-05-07
**Confidence:** MEDIUM-HIGH (UX patterns MEDIUM from WebSearch; MP fee rates HIGH from official source; webhook patterns HIGH from multiple technical sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| In-app `past_due` warning banner | Users in SaaS apps expect the app to tell them when payment failed — email alone is insufficient; 20–40% of churn is involuntary and in-app banners are the last line of defense before access loss | LOW | Red persistent banner at top of layout; must include "update payment" CTA linking to Stripe Customer Portal. Stripe Billing design guidelines recommend this over email-only. |
| `cancelAtPeriodEnd` yellow warning banner | Users who clicked cancel need constant reminder they're on a wind-down path; absence of reminder causes confusion ("I cancelled but still got charged for next month?") | LOW | Yellow banner with exact end-of-period date + "Reactivate" CTA. Must be dismissible per-session at most, never permanently — re-show on next login. |
| Cancellation blocked during `past_due` | Users cannot cancel to escape a debt — they must resolve the failed payment first; skipping this allows subscribers to lose access, cancel, and re-subscribe at promo rates, bypassing revenue recovery | LOW (backend) / MEDIUM (UI) | 409 from controller is already planned (P5). UI must explain the block clearly: "Regularize o pagamento antes de cancelar." Disable button + tooltip, not silent failure. |
| MP fee disclosed before transaction launch | Merchants in Brazil are acutely aware of fees (MP's reputation for high rates is a known complaint); not showing net value = loss of trust. Brazilian consumer protection context makes this especially expected | MEDIUM | Show gross, fee %, fee amount, net value in a preview step before confirming a Checkout Pro launch. Rates vary by method (PIX 0.99%, debit 1.99%, credit à vista ~3.98%, credit parcelado up to higher) — must fetch from config, not hardcode. |
| MP fee on transaction detail/list | Settled transactions should show what the merchant actually received; matching bank statement to platform record is a core bookkeeping need | LOW | Add `mpFeeAmount` and `mpNetAmount` fields to the transaction document when the MP webhook confirms settlement. Display in transaction detail and as tooltip in list. |
| Structured webhook audit log | Operations teams (even at small SaaS) need to know "did this payment event process?" especially after an incident; absence of audit trail makes support impossible | MEDIUM | Firestore collection `webhookEvents/{eventId}` with `source`, `eventType`, `tenantId`, `status`, `processedAt`, `error`. Write before processing, update after. |
| Webhook idempotency (deduplication) | MP and Stripe retry events on 5xx or timeout; without deduplication, a payment processes twice, wallet balance double-counts, or subscription reactivates incorrectly | MEDIUM | Check `webhookEvents/{eventId}` before processing. Return 200 on duplicate without reprocessing. TTL: 30 days (exceeds MP/Stripe retry windows). Applies to both Stripe and MP webhooks. |
| `external_reference` fallback lookup (MP) | MP webhooks sometimes omit `external_reference` in the notification body — confirmed in community reports; payment.id is always present; need fallback to MP Payments API to retrieve the reference | MEDIUM | If `external_reference` is missing in webhook body, call MP Payments API (`GET /v1/payments/{id}`) with tenant's access token to retrieve it. Log when fallback is triggered. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| MP fee disclosure in proposals | When a proposal includes a Checkout Pro payment link, showing the buyer the net payout amount gives the seller confidence to communicate pricing transparently — uncommon in Brazilian SMB tools | MEDIUM | Show fee breakdown in proposal preview and in the shared/printed proposal. Depends on knowing fee rate at creation time (stored on proposal, not recalculated). |
| MP fee table in settings | Merchants negotiate MP rates based on volume tier — letting them see configured rates and update them in settings gives ProOps a transparency advantage over platforms that hide this | LOW | Simple settings page section: per-method fee % (PIX, debit, credit à vista, credit parcelado 2x–12x). Stored in `tenants/{id}.mpFeeRates`. Admin-only edit. |
| MP fee in dashboard summary | "This month you paid R$X in MP fees" — operational insight that helps merchants decide whether to pass fees to customers or absorb them | MEDIUM | Aggregate `mpFeeAmount` from transactions by period. Requires `mpFeeAmount` indexed on transaction docs. Compute client-side from existing transactions query where possible to avoid new backend endpoints. |
| Reactivation CTA that bypasses dunning friction | During `cancelAtPeriodEnd`, a single-click reactivate (via Stripe `cancel_at_period_end: false`) with no re-entry of payment details is superior to requiring a new checkout; most tools redirect to a new checkout | LOW | Call existing Stripe reactivate endpoint; update `cancelAtPeriodEnd` field on tenant doc. The CTA on the yellow banner should do this in one click with a confirmation dialog. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Allow cancellation during `past_due` with "cancel anyway" escape hatch | Admins want flexibility; seems user-friendly | Allows subscribers to escape payment obligation, re-subscribe at promotional rates, breaks revenue recovery funnel; FTC "Click-to-Cancel" rules apply to US only and don't mandate this for B2B | Force regularization first: show Stripe Customer Portal link to update payment method. If genuinely unpayable, superadmin manual override in admin panel. |
| Real-time MP fee calculation via API on every transaction display | Accurate fees per-negotiated rate | MP does not expose a public "calculate fee" API; each merchant's rate may be negotiated differently; calling MP API per-render is slow and adds an external dependency on a hot path | Store fee rates in tenant config (`mpFeeRates`); calculate client-side using stored rates. Accept that rates may drift if MP changes them — require admin to update in settings. |
| Permanent dismissal of `past_due` banner | Users find banners annoying | Hiding a past_due banner means user forgets, misses payment deadline, subscription cancels, calls support — cost to you is high | Allow session-level hide at most (localStorage flag cleared on next login). Never allow permanent dismiss for past_due. |
| Webhook retry from admin UI | Looks powerful | Payment state is not idempotent if reprocessed incorrectly; partial state (e.g., wallet credited once, then credited again on retry) requires rollback logic that doesn't exist | Use Stripe/MP dashboards for webhook replay; in-app audit log lets support see what happened without retrying. |
| Prorating cancellation refund when past_due | Seems fair | Introduces Stripe proration complexity on already-failing subscription; proration creates a new invoice, which may also fail and worsen the `past_due` state | Cancel at period end only; never prorate a failing subscription. Prorations should only apply on plan upgrades. |

---

## Feature Dependencies

```
[MP fee disclosure in settings] (mpFeeRates on tenant doc)
    └──required by──> [MP fee preview at transaction launch]
    └──required by──> [MP fee on transaction detail/list]
    └──required by──> [MP fee in dashboard summary]
    └──required by──> [MP fee disclosure in proposals]

[Webhook audit log collection + idempotency check]
    └──required by──> [external_reference fallback (safe to retry)]
    └──required by──> [MP fee fields written from webhook]

[MP webhook writes mpFeeAmount to transaction]
    └──required by──> [MP fee on transaction detail/list]
    └──required by──> [MP fee in dashboard summary]

[past_due banner (frontend state read)]
    └──requires──> [tenant doc subscriptionStatus field — already exists]
    └──conflicts──> [permanent banner dismiss]

[cancelAtPeriodEnd banner + reactivation CTA]
    └──requires──> [tenant doc cancelAtPeriodEnd field — already exists]
    └──requires──> [Stripe reactivate endpoint — existing]

[Block cancel during past_due — backend 409]
    └──required by──> [UI cancel button disabled state]
    └──independent of banners (separate enforcement layer)]
```

### Dependency Notes

- **MP fee settings must come before any fee display**: all disclosure features read `mpFeeRates` from the tenant doc. If rates are not stored, calculation is impossible. Build settings write-path first.
- **Webhook audit log must precede external_reference fallback**: the fallback lookup adds an external API call that could itself fail; idempotency store ensures the fallback result is recorded and not re-executed on retry.
- **MP webhook must write `mpFeeAmount` before transaction detail can show it**: the detail UI is a read-only consumer; the write must happen in the webhook handler when MP confirms the charge outcome.
- **Banners are independent of cancel-block enforcement**: banners are UX warnings; the 409 block is the actual enforcement. Both are needed — the banner tells users why the block exists.

---

## MVP Definition (for this milestone — v4.0)

### Launch With (all P1–P5 items in milestone)

- [ ] Addon ghost cleanup — eliminates stale badge states visible to users right now in production
- [ ] `past_due` red banner — required so users know why access may be restricted
- [ ] `cancelAtPeriodEnd` yellow banner + reactivation CTA — prevents confused support tickets
- [ ] Block cancellation during `past_due` (409 + UI disabled) — revenue protection, prevents abuse
- [ ] MP webhook structured logging + idempotency + `external_reference` fallback — reliability fix for lost payments
- [ ] MP fee rates in tenant settings — prerequisite for all disclosure features
- [ ] MP fee preview at transaction launch — most visible disclosure touchpoint, first seen by user

### Add After Core Is Working (v4.x)

- [ ] MP fee on transaction detail/list — visible only after webhook has written fee data; low risk to defer one phase
- [ ] MP fee in dashboard summary — aggregate computation; defer until fee fields are populated in production data
- [ ] MP fee in proposals — proposal PDF pipeline change; test separately, risk of PDF regression

### Future Consideration (v5+)

- [ ] Prorated refunds on cancellation — requires careful Stripe proration handling, defer until billing flows are stable
- [ ] Webhook replay from admin UI — requires rollback logic that doesn't exist; not worth building without full idempotency infrastructure

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Addon ghost cleanup | HIGH (visible broken state in prod) | LOW (cron + one-shot script) | P1 |
| `past_due` red banner | HIGH (user confusion, churn) | LOW (read existing field, render component) | P1 |
| `cancelAtPeriodEnd` yellow banner + reactivate | HIGH (support ticket reduction) | LOW (same pattern as past_due banner) | P1 |
| Block cancel during `past_due` | HIGH (revenue protection) | LOW backend / MEDIUM UI | P1 |
| MP webhook idempotency + audit log | HIGH (silent payment loss) | MEDIUM (new Firestore collection, transaction wrap) | P1 |
| `external_reference` fallback | HIGH (payments silently unprocessed) | MEDIUM (MP API call + error handling) | P1 |
| MP fee rates in settings | MEDIUM (transparency) | LOW (tenant doc field + UI form) | P2 |
| MP fee preview at launch | MEDIUM (trust, transparency) | MEDIUM (calculation logic + UI modal step) | P2 |
| MP fee on transaction detail/list | MEDIUM (bookkeeping) | LOW (display stored field) | P2 |
| MP fee in dashboard | LOW (nice insight) | MEDIUM (aggregation or client-side compute) | P3 |
| MP fee in proposals | LOW (edge case touchpoint) | HIGH (PDF template change, regression risk) | P3 |

**Priority key:**
- P1: Must ship in this milestone (revenue protection, visible production bugs)
- P2: Should ship in this milestone (transparency, trust)
- P3: Can slip to next milestone without blocking current goals

---

## Competitor Feature Analysis

| Feature | Stripe Billing (self) | Hotmart / Eduzz (BR platforms) | ProOps Approach |
|---------|----------------------|-------------------------------|-----------------|
| Past due banner | Customer Portal shows failed state; in-app banner requires custom build | Locks access immediately with modal, no grace | Persistent top banner with grace period; access not blocked until Stripe exhausts retries |
| Fee disclosure | Stripe shows net in payout dashboard (post-charge); no pre-charge preview | Hotmart shows fee deducted in checkout flow; merchant-facing reports show net | Show fee preview before launch AND on settled transaction — more transparent than Stripe, comparable to Hotmart |
| Cancel UX | Stripe Customer Portal: immediate or end-of-period; no block on past_due | Platform-specific; typically immediate cancel allowed | Block during past_due; offer end-of-period only; reactivate in one click |
| Webhook reliability | Stripe event dashboard + retry on failure; idempotency keys enforced | Platform-specific | Firestore audit log + idempotency key store; fallback lookup for MP's known `external_reference` gap |

---

## Sources

- [Stripe dunning documentation](https://stripe.com/resources/more/dunning-what-subscription-based-businesses-need-to-know) — MEDIUM confidence (official Stripe resource, patterns verified)
- [Stripe Cancel subscriptions docs](https://docs.stripe.com/billing/subscriptions/cancel) — HIGH confidence (official API docs)
- [MercadoPago tabela de taxas](https://www.mercadopago.com.br/ajuda/tabela-taxas-tarifas_45243) — HIGH confidence (official MP help page; rates: PIX 0.99%, debit 1.99%, credit à vista ~3.98–4.98% depending on settlement window)
- [MercadoPago custo receber pagamentos](https://www.mercadopago.com.br/ajuda/custo-receber-pagamentos_453) — HIGH confidence (official MP source)
- [Webhook idempotency guide — hookdeck](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) — MEDIUM confidence (reputable webhook infra vendor)
- [MP external_reference missing in webhook — Bubble forum](https://forum.bubble.io/t/bubble-mercado-pago-mercadopago-checkout-pro-renato-asse-plugin-webhook-not-returning-external-reference/389155) — MEDIUM confidence (community-confirmed issue; consistent with MP docs stating webhook body is notification-only, not full payment object)
- [SaaS cancellation flow patterns — userpilot](https://userpilot.com/blog/cancellation-flow-examples/) — LOW confidence (WebSearch only, not primary source; used for pattern reference only)
- [Dunning management — maxio](https://www.maxio.com/blog/dunning-101-the-art-of-retaining-past-due-accounts) — MEDIUM confidence (SaaS billing vendor, industry benchmark)
- Existing codebase analysis: `apps/functions/src/stripe/stripeWebhook.ts`, `apps/functions/src/api/services/mercadopago.service.ts`, CLAUDE.md files — HIGH confidence (direct evidence)

---

## Brazilian Context Notes

- MP fee for PIX is 0.99% (e-commerce) or 0.49% (QR Code presencial). For Checkout Pro (online), use 0.99%.
- Credit card rates: ~3.98% (recebimento em 14 dias) to 4.98% (recebimento em 30 dias). Rates also vary by installment count.
- Debit: 1.99% flat.
- Merchants negotiate custom rates above volume thresholds — fee config should be editable in settings, not hardcoded.
- LGPD implications: fee amounts stored on transaction docs are business data, not personal data — no special handling needed.
- Brazilian B2B SaaS is not subject to FTC Click-to-Cancel (US regulation). Blocking cancellation during `past_due` is legally permissible in Brazil.

---

*Feature research for: Billing & Payment Hardening milestone (v4.0) — ProOps multi-tenant SaaS Brazil*
*Researched: 2026-05-07*
