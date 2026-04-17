# Phase 16: Lia Segurança & Billing - Research

**Researched:** 2026-04-14
**Domain:** AI access control, subscription gating, usage billing UI, Firestore security rules
**Confidence:** HIGH

---

## Summary

Phase 16 adds the remaining security and billing layer to the Lia AI feature. The backend chat endpoint (`chat.route.ts`) already blocks the free tier (403) and enforces the monthly message limit (429). Two things are missing at the API boundary: (1) a check for inactive subscription status (canceled, past_due beyond grace) before the stream starts, and (2) a GET endpoint so the billing page can fetch usage without requiring the client to read Firestore directly.

On the frontend, `useLiaUsage` already computes `isNearLimit` (80% threshold) and `isAtLimit`, and `LiaInputBar` already disables and shows a tooltip when `isAtLimit`. What is missing: a banner inside the Lia panel that fires when `isNearLimit && !isAtLimit`, and an AI usage card in the `MySubscriptionTab` (billing page).

The Firestore rules for `aiUsage` and `aiConversations` are **already fully implemented** in `firestore.rules` (lines 430–446). AIBI-06 is structurally complete. The research confirms no new security rules are required — the existing rules match the requirement exactly.

**Primary recommendation:** Three focused changes: (1) add inactive-subscription 403 to `chat.route.ts`, (2) add a near-limit warning banner to `LiaPanel`/`LiaContainer`, (3) add an AI usage card to `MySubscriptionTab` reading from `useLiaUsage`.

---

## Project Constraints (from CLAUDE.md)

- No `Co-Authored-By` in commit messages
- Every Firestore query must filter by `tenantId` (from auth context, never request body)
- New code uses `logger` from `../lib/logger` (GCP-structured JSON)
- TypeScript strict mode — no implicit `any`
- Files: kebab-case. Components: PascalCase. Variables/functions: camelCase
- `interface` for data shapes; `type` for unions/literals
- `import type {}` for type-only imports
- Frontend: all backend calls via `src/services/` layer → `/api/backend/*` proxy
- Frontend: `useTenant()` for `tenantId`, never hardcode or read from URL
- Never call Firebase SDK from Server Components (add `'use client'` directive)
- `src/components/ui/` is Shadcn/ui — never edit manually
- Tailwind v4 — configured via CSS, no `tailwind.config.ts`; use `cn()` for class merging
- New Firestore collections need explicit security rules (DENY-by-default)
- `functions/lib/` is TypeScript output — always run `npm run build` before emulators/deploy
- Financial/billing operations must run server-side in Cloud Functions

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AIBI-01 | Free plan tenant blocked with 403 before stream starts | ALREADY DONE in `chat.route.ts` lines 51–57. No changes needed. |
| AIBI-02 | Inactive subscription blocked with 403 before stream starts | MISSING — `chat.route.ts` resolves `planProfile.subscriptionStatus` but never checks it. `evaluateSubscriptionStatusAccess()` exists in `tenant-plan-policy.ts` for exactly this. |
| AIBI-03 | Tenant at message limit gets 429 with `resetAt`; input bar disabled in UI | 429 with `resetAt` ALREADY DONE in `chat.route.ts` lines 62–72. Input bar ALREADY DONE in `LiaInputBar` (`isAtLimit` prop disables and shows tooltip). No changes needed. |
| AIBI-04 | AI usage section on billing page (progress bar + reset date) | MISSING — `MySubscriptionTab` has no AI usage card. `useLiaUsage` hook exists and has all required data. |
| AIBI-05 | In-app warning at 80% of monthly limit | MISSING — `useLiaUsage.isNearLimit` exists and `LiaUsageBadge` turns amber at 80%, but no explicit warning banner is shown in the panel. The badge color change is insufficient for AIBI-05. |
| AIBI-06 | Firestore rules: `aiUsage` read-only, `aiConversations` owner-only | ALREADY DONE in `firestore.rules` lines 430–446. Verified. |
</phase_requirements>

---

## What Already Exists (Do Not Re-implement)

[VERIFIED: direct code inspection]

| Feature | Location | Status |
|---------|----------|--------|
| Free tier 403 block | `functions/src/ai/chat.route.ts` lines 51–57 | Complete |
| Monthly limit 429 with `resetAt` | `functions/src/ai/chat.route.ts` lines 62–72 | Complete |
| Input bar disabled at limit | `src/components/lia/lia-input-bar.tsx` — `isAtLimit` prop | Complete |
| `useLiaUsage` hook (messagesUsed, isNearLimit, isAtLimit, resetDate) | `src/hooks/useLiaUsage.ts` | Complete |
| Firestore rules for `aiUsage` and `aiConversations` | `firestore.rules` lines 430–446 | Complete |
| `AiUsageData` and `AI_TIER_LIMITS` frontend types | `src/types/ai.ts` | Complete |
| `LiaUsageBadge` turns amber at 80% | `src/components/lia/lia-usage-badge.tsx` | Partial (badge only, no banner) |

---

## Standard Stack

### Core (All Already Installed)
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `firebase-admin/firestore` | via firebase-admin 12.7.0 | Backend Firestore reads for subscription check | [VERIFIED: functions/package.json] |
| `firebase/firestore` | via firebase 12.6.0 | Frontend real-time `onSnapshot` for usage | [VERIFIED: useLiaUsage.ts — already used] |
| `../lib/tenant-plan-policy` | internal | `getTenantPlanProfile`, `evaluateSubscriptionStatusAccess` | [VERIFIED: functions/src/lib/tenant-plan-policy.ts] |
| `./usage-tracker` | internal | `checkAiLimit`, `getAiUsage` | [VERIFIED: functions/src/ai/usage-tracker.ts] |
| Shadcn/ui (`Progress`, `Card`, `Badge`) | installed | Billing page AI usage card UI | [VERIFIED: src/components/ui/] |

**No new npm packages required.**

---

## Architecture Patterns

### Pattern 1: Inactive Subscription Check in `chat.route.ts`

The `getTenantPlanProfile()` already returns `subscriptionStatus`. The function `evaluateSubscriptionStatusAccess()` encapsulates the grace-period logic (past_due within grace = allow, past_due expired = block, canceled = block).

Insert this check immediately after the free-tier check (line 57), before line 59 (`const planTier = planProfile.tier`):

```typescript
// Source: functions/src/lib/tenant-plan-policy.ts — evaluateSubscriptionStatusAccess()
import { evaluateSubscriptionStatusAccess } from "../lib/tenant-plan-policy";

// After free tier check:
const subscriptionAccess = evaluateSubscriptionStatusAccess({
  subscriptionStatus: planProfile.subscriptionStatus,
  pastDueSince: planProfile.pastDueSince,
});
if (!subscriptionAccess.allowWrite) {
  res.status(403).json({
    message: "Assinatura inativa. Regularize seu plano para usar a Lia.",
    code: "AI_SUBSCRIPTION_INACTIVE",
  });
  return;
}
```

**Key:** `evaluateSubscriptionStatusAccess` is already exported from `tenant-plan-policy.ts` and handles past_due grace period automatically. No custom logic needed.

### Pattern 2: Near-Limit Warning Banner in LiaPanel

`useLiaUsage` already returns `isNearLimit` (true when `messagesUsed >= Math.floor(messagesLimit * 0.8)`). The banner must appear inside the panel, above the input bar. It should be dismissible within the session (local state) to avoid repeating every re-render.

The banner is passed as a prop slot in `LiaPanel` (or rendered inline in `LiaContainer`):

```typescript
// In LiaContainer — the banner is only shown when isNearLimit && !isAtLimit
// Dismissed state via useState (session-only, not persisted)
const [nearLimitBannerDismissed, setNearLimitBannerDismissed] = useState(false);
const showNearLimitBanner = usage.isNearLimit && !usage.isAtLimit && !nearLimitBannerDismissed;
```

Banner text: `"Você usou X% das suas mensagens mensais. Renova em [resetDate]."` — shown in amber, with an X button to dismiss.

### Pattern 3: AI Usage Card in MySubscriptionTab

The billing page (`MySubscriptionTab`) is a large component (851 lines). The AI usage card is added as a new visual block after the existing plan features section. It uses `useLiaUsage` directly inside the component (or a sub-component).

The card shows:
- Progress bar: `messagesUsed / messagesLimit` using Shadcn `Progress`
- Label: `"X de Y mensagens de IA usadas este mês"`
- Reset date: `"Renova em [resetDate]"` (pt-BR from `useLiaUsage.resetDate`)
- Conditional: only shown when `planTier !== "free"` (free plan has no AI access)

```typescript
// Pattern: read from useLiaUsage inside MySubscriptionTab or a child component
import { useLiaUsage } from "@/hooks/useLiaUsage";
import { Progress } from "@/components/ui/progress";

// Inside the component:
const { messagesUsed, messagesLimit, resetDate, isLoading } = useLiaUsage();
const percentage = messagesLimit > 0 ? Math.round((messagesUsed / messagesLimit) * 100) : 0;
```

**Alternative:** Create a standalone `AiUsageCard` component in `src/components/profile/` and render it inside `MySubscriptionTab`. This is the cleaner approach because `MySubscriptionTab` is already 851 lines.

### Pattern 4: Firestore Rules — Already Complete

```
// firestore.rules lines 430–446 (ALREADY IMPLEMENTED — do not change)
match /tenants/{tenantId}/aiUsage/{month} {
  allow read: if isAuthenticated() && belongsToTenant(tenantId);
  allow write: if false;
}

match /tenants/{tenantId}/aiConversations/{sessionId} {
  allow read: if isAuthenticated()
              && belongsToTenant(tenantId)
              && resource.data.uid == request.auth.uid;
  allow write: if false;
}
```

AIBI-06 is satisfied by the existing rules. No changes to `firestore.rules` required.

### Recommended File Structure for New Work

```
functions/src/ai/
└── chat.route.ts          # MODIFY: add inactive subscription check (lines 57–59)

src/components/lia/
└── lia-container.tsx      # MODIFY: add near-limit banner (isNearLimit state + JSX)

src/components/profile/
├── AiUsageCard.tsx        # CREATE: new component for AI usage on billing page
└── MySubscriptionTab.tsx  # MODIFY: import and render AiUsageCard
```

### Anti-Patterns to Avoid

- **Checking subscription status in the frontend** — the 403 must come from the backend API boundary before any stream starts (success criterion 1 explicitly says "before any stream begins").
- **Adding AI usage route handler when Firestore read suffices** — the billing page can read directly from Firestore via `useLiaUsage` (the rule already allows authenticated tenant members to read their own `aiUsage` subcollection). No new API endpoint needed.
- **Modifying `firestore.rules`** — the AI rules are complete. Adding redundant rules creates maintenance burden.
- **Re-implementing `evaluateSubscriptionStatusAccess`** — it exists and handles grace period logic. Use it, do not copy-paste the logic into `chat.route.ts`.
- **Calling `evaluateSubscriptionStatusAccess` before `getTenantPlanProfile`** — the profile must be resolved first (it provides `subscriptionStatus` and `pastDueSince`). These are already resolved at line 44 in `chat.route.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription status grace-period logic | Custom date math | `evaluateSubscriptionStatusAccess()` from `tenant-plan-policy.ts` | Already handles `past_due` grace days, normalization, edge cases |
| 80% limit threshold | Re-derive in component | `useLiaUsage().isNearLimit` | Already computed; matches backend definition |
| AI usage progress display | Custom progress bar | Shadcn `Progress` component | Already in `src/components/ui/` |
| Month key computation | `new Date().toISOString().slice(0,7)` inline | `buildMonthlyPeriodKeyUtc()` from `tenant-plan-policy.ts` | Already used by `usage-tracker.ts` — consistent |
| Reset date formatting | Custom date math | `useLiaUsage().resetDate` | Already returns pt-BR formatted string |

---

## Common Pitfalls

### Pitfall 1: Plan Cache May Return Stale Subscription Status
**What goes wrong:** `getTenantPlanProfile()` uses an in-memory cache (`PLAN_CACHE`). If a tenant's subscription is canceled/reactivated, the cache may still show the old status for the TTL window.
**Why it happens:** The plan cache TTL is intentional for performance (avoids Firestore reads on every request).
**How to avoid:** This is acceptable behavior — the cache is a known architectural choice. Do not bypass it. The status check will be correct within one cache TTL window.
**Warning signs:** Not a bug — document in implementation that status check reflects cache.

### Pitfall 2: `evaluateSubscriptionStatusAccess` Called With Wrong Field Name
**What goes wrong:** `planProfile.pastDueSince` is the correct field (type `string | undefined`). If `pastDueSince` is omitted from the call, the function returns `allowWrite: false, reasonCode: "PAST_DUE_MISSING_TIMESTAMP"` for all `past_due` tenants — even those still within the grace period.
**Why it happens:** The function signature requires `pastDueSince` explicitly when status is `past_due`.
**How to avoid:** Always pass `pastDueSince: planProfile.pastDueSince` from the profile object.

### Pitfall 3: `useLiaUsage` Uses `usePlanLimits().planTier` Which Never Returns "free"
**What goes wrong:** `usePlanLimits` has a known behavior (observation 37 in STATE.md) where `planTier` defaults to `"starter"` for free-plan users. This means `useLiaUsage` will compute `messagesLimit = 80` (starter limit) for free users on the billing page — rather than showing 0 or a "not available" state.
**Why it happens:** `usePlanLimits` normalizes unrecognized tiers to starter.
**How to avoid:** In `AiUsageCard`, guard with: only render if `planTier !== "free"`. Check `user?.planId === "free"` or check `planTier === "free"` from `usePlanLimits()`. Hide the AI usage section entirely for free users (they have no AI access).
**Warning signs:** Free users see an AI usage card showing 0/80, which would be confusing.

### Pitfall 4: Near-Limit Banner Shown to Users at Full Limit
**What goes wrong:** If `isNearLimit` is true whenever `messagesUsed >= 80%`, it remains true when `messagesUsed >= 100%`. The banner and the disabled input bar would both show simultaneously.
**Why it happens:** `useLiaUsage.isNearLimit` is defined as `messagesUsed >= Math.floor(messagesLimit * 0.8)` — this is true even when `isAtLimit` is also true.
**How to avoid:** Always gate the banner with `isNearLimit && !isAtLimit`. The disabled input bar handles the at-limit state.

### Pitfall 5: MySubscriptionTab Already Has 851 Lines
**What goes wrong:** Adding AI usage directly inline makes the file unwieldy and harder to review.
**Why it happens:** The tab accumulated features over time without extracting sub-components.
**How to avoid:** Create `AiUsageCard.tsx` in `src/components/profile/` as a standalone component that calls `useLiaUsage()` internally. Import and render it in `MySubscriptionTab` with a single line. Export from `src/components/profile/index.ts`.

---

## Code Examples

### Backend: Inactive Subscription Check
```typescript
// Source: functions/src/lib/tenant-plan-policy.ts (evaluateSubscriptionStatusAccess export)
// Insert after line 57 in chat.route.ts, before `const planTier = planProfile.tier;`

import { getTenantPlanProfile, evaluateSubscriptionStatusAccess } from "../lib/tenant-plan-policy";

const subscriptionAccess = evaluateSubscriptionStatusAccess({
  subscriptionStatus: planProfile.subscriptionStatus,
  pastDueSince: planProfile.pastDueSince,
});
if (!subscriptionAccess.allowWrite) {
  res.status(403).json({
    message: "Assinatura inativa. Regularize seu plano para usar a Lia.",
    code: "AI_SUBSCRIPTION_INACTIVE",
  });
  return;
}
```

### Frontend: AiUsageCard Component
```typescript
// Source: useLiaUsage hook (src/hooks/useLiaUsage.ts) + Progress from Shadcn
"use client";

import { useLiaUsage } from "@/hooks/useLiaUsage";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotMessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiUsageCard() {
  const { planTier } = usePlanLimits();
  const { messagesUsed, messagesLimit, resetDate, isLoading, isNearLimit, isAtLimit } = useLiaUsage();

  // Free plan has no AI access — don't show the card
  if (planTier === "free") return null;
  if (isLoading) return null; // or skeleton

  const percentage = messagesLimit > 0 ? Math.round((messagesUsed / messagesLimit) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BotMessageSquare className="w-4 h-4" />
          Lia — Uso de Mensagens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress
          value={percentage}
          className={cn(
            "h-2",
            isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-amber-500" : ""
          )}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{messagesUsed} de {messagesLimit} mensagens usadas</span>
          <span>Renova em {resetDate}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Frontend: Near-Limit Banner in LiaContainer
```typescript
// Source: useLiaUsage.isNearLimit + existing LiaContainer pattern
// Add inside LiaContainer, rendered inside LiaPanel above inputBar slot

const [nearLimitDismissed, setNearLimitDismissed] = useState(false);
const showNearLimitBanner = usage.isNearLimit && !usage.isAtLimit && !nearLimitDismissed;

// Banner JSX — passed to LiaPanel as a slot or rendered between chatWindow and inputBar
{showNearLimitBanner && (
  <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400 shrink-0">
    <span>
      Você usou {usage.messagesUsed}/{usage.messagesLimit} mensagens. Renova em {usage.resetDate}.
    </span>
    <button
      type="button"
      onClick={() => setNearLimitDismissed(true)}
      aria-label="Fechar aviso"
      className="shrink-0 hover:opacity-70"
    >
      ✕
    </button>
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | Impact for This Phase |
|--------------|------------------|----------------------|
| No subscription status check in AI route | Add `evaluateSubscriptionStatusAccess` call | AIBI-02 satisfied |
| `isNearLimit` computed but no UI warning | Add dismissible amber banner in panel | AIBI-05 satisfied |
| No AI usage on billing page | New `AiUsageCard` in `MySubscriptionTab` | AIBI-04 satisfied |
| Firestore AI rules: already implemented | No change needed | AIBI-06 already done |

---

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. No stored data or registered OS state is affected.

---

## Environment Availability

Phase 16 is purely code/config changes. The only external dependency is the Firebase Emulator for integration testing — already available from previous phases.

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Firebase Emulators | Integration test of 403 subscription check | [ASSUMED] | Required from prior phases — same dev machine |
| `evaluateSubscriptionStatusAccess` | AIBI-02 backend check | Yes | Exported from `functions/src/lib/tenant-plan-policy.ts` |
| Shadcn `Progress` | AiUsageCard | [ASSUMED] | Check `src/components/ui/progress.tsx` before writing the card |

---

## Validation Architecture

Config has no `nyquist_validation` key — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (E2E) — `npm run test:e2e` at root |
| Config file | `playwright.config.ts` |
| Quick run | Firebase Emulators + curl for API tests |
| Full suite | `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIBI-01 | Free tier gets 403 | Already satisfied — skip | N/A | N/A |
| AIBI-02 | Inactive subscription gets 403 | integration | `curl -X POST .../v1/ai/chat` with canceled tenant token | No — Wave 0 |
| AIBI-03 | At-limit gets 429 + input disabled | Already satisfied — skip | N/A | N/A |
| AIBI-04 | AI usage card visible on billing page | manual/smoke | Visual check on `/profile?tab=subscription` | No |
| AIBI-05 | Near-limit banner appears at 80% | integration | Set `messagesUsed = floor(limit * 0.8)` in emulator, check banner | No |
| AIBI-06 | Firestore rules enforce read-only aiUsage, owner-only aiConversations | rules test | `npm run test:rules` | [ASSUMED: rules test file may exist] |

### Wave 0 Gaps
- [ ] Integration test for AIBI-02: curl with a tenant whose `subscriptionStatus: "canceled"`
- [ ] Rules test assertions for `aiUsage` and `aiConversations` if not already covered

---

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Inherited | Firebase ID token validated by `validateFirebaseIdToken` middleware — no change |
| V4 Access Control | YES | Subscription status check before stream (AIBI-02); Firestore rules limit client reads |
| V5 Input Validation | Inherited | Existing input validation in `chat.route.ts` unchanged |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Canceled tenant continues to use AI via cached token | Elevation of Privilege | `evaluateSubscriptionStatusAccess()` checks status server-side on every request (within cache TTL) |
| Client directly writes to `aiUsage` to reset counter | Tampering | `allow write: if false` in Firestore rules — Admin SDK only |
| User reads another user's conversation history | Information Disclosure | `resource.data.uid == request.auth.uid` in `aiConversations` rule |
| Free user spoofs plan tier header to bypass 403 | Elevation of Privilege | Plan tier resolved server-side via `getTenantPlanProfile()` — never from request body |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Shadcn `Progress` component exists at `src/components/ui/progress.tsx` | Code Examples | If missing, run `npx shadcn@latest add progress` before implementing AiUsageCard |
| A2 | Firebase Emulators available for integration testing | Environment Availability | Cannot verify AIBI-02 subscription-inactive path without emulators |
| A3 | Firestore rules test file covers AI rules | Validation Architecture | If not covered, add rules test assertions for aiUsage and aiConversations |

---

## Open Questions

1. **Where exactly in MySubscriptionTab to insert AiUsageCard?**
   - What we know: The tab has plan info, addon list, billing actions. The card should appear in the "plan features" section.
   - Recommendation: Insert after the plan features list, before the addons section. Planner should read lines 200–400 of `MySubscriptionTab.tsx` to confirm the best insertion point.

2. **Should `LiaPanel` accept a new `warningBanner` slot or should the banner be hardcoded in `LiaContainer`?**
   - Recommendation: Render the banner inline in `LiaContainer` between the `chatWindow` and `inputBar` slots. `LiaPanel` already uses composition via slots — avoid adding a new slot just for one feature.

---

## Sources

### Primary (HIGH confidence)
- `functions/src/ai/chat.route.ts` — verified existing free-tier 403 and limit 429 checks; confirmed missing subscription status check
- `functions/src/ai/usage-tracker.ts` — verified `checkAiLimit`, `incrementAiUsage`, `getAiUsage` signatures
- `functions/src/ai/ai.types.ts` — verified `AI_LIMITS`, `AiUsageDocument`, `AiChatRequest`
- `functions/src/lib/tenant-plan-policy.ts` — verified `getTenantPlanProfile`, `evaluateSubscriptionStatusAccess`, `TenantPlanProfile.subscriptionStatus`, `TenantPlanProfile.pastDueSince`
- `firestore.rules` lines 430–446 — verified `aiUsage` and `aiConversations` rules are complete
- `src/hooks/useLiaUsage.ts` — verified `isNearLimit`, `isAtLimit`, `resetDate` outputs
- `src/components/lia/lia-input-bar.tsx` — verified `isAtLimit` already disables input
- `src/components/lia/lia-container.tsx` — verified composition pattern, `usage.isNearLimit` available
- `src/components/profile/MySubscriptionTab.tsx` — verified 851-line structure, no AI usage section exists
- `src/app/profile/page.tsx` — verified `MySubscriptionTab` is rendered under `?tab=subscription`
- `.planning/REQUIREMENTS.md` — verified AIBI-01 through AIBI-06 requirement text

### Secondary (MEDIUM confidence)
- `src/types/ai.ts` — `AI_TIER_LIMITS` constants match `AI_LIMITS` in backend
- `src/hooks/usePlanLimits.ts` — confirmed `planTier` export; confirmed defaults to `"starter"` for free users (observation 37)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in installed codebase
- Architecture: HIGH — insertion points identified from direct code inspection
- Pitfalls: HIGH — identified from reading actual implementations
- What-already-exists analysis: HIGH — verified by direct file reads

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain)
