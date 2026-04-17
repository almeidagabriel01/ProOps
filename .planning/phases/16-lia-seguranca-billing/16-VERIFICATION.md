---
phase: 16-lia-seguranca-billing
verified: 2026-04-14T21:50:00-03:00
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Lia panel as a paid tenant with 80-99% usage — verify amber banner appears with exact count and reset date"
    expected: "Amber banner shows 'Você usou N de M mensagens este mês. Renova em {date}.' with X dismiss button"
    why_human: "Banner visibility depends on live Firestore usage data; cannot trigger isNearLimit programmatically in a read-only check"
  - test: "Dismiss the near-limit banner and reload the page"
    expected: "Banner reappears after reload (session-only dismiss)"
    why_human: "Session persistence behavior cannot be verified without a running browser"
  - test: "Open the billing/subscription page as a paid tenant"
    expected: "AiUsageCard appears between plan info and add-ons sections, showing progress bar, count label, and reset date in Portuguese"
    why_human: "Visual placement and real-time data rendering require a browser"
  - test: "Open the billing/subscription page as a free plan user"
    expected: "AiUsageCard does NOT appear on the page"
    why_human: "Free plan guard (user.role === 'free') behavior requires authenticated session"
---

# Phase 16: Lia Segurança & Billing Verification Report

**Phase Goal:** The AI chat endpoint is protected by plan and subscription checks before any stream starts, usage limits are enforced at the API boundary, and users can see their AI consumption on the billing page.
**Verified:** 2026-04-14T21:50:00-03:00
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Free plan tenant gets 403 with `AI_FREE_TIER_BLOCKED` before stream; inactive subscription gets 403 with `AI_SUBSCRIPTION_INACTIVE` | ✓ VERIFIED | `chat.route.ts` lines 51-57 (`AI_FREE_TIER_BLOCKED`) and lines 60-70 (`AI_SUBSCRIPTION_INACTIVE`) — both fire before `res.flushHeaders()` at line 163 |
| 2 | Tenant at monthly limit gets 429 with `resetAt` field; input bar is disabled in UI | ✓ VERIFIED | `chat.route.ts` lines 76-84: `AI_LIMIT_EXCEEDED` + `resetAt: limitCheck.resetAt`; `lia-input-bar.tsx` line 26: `const disabled = isStreaming \|\| isAtLimit` |
| 3 | User sees AI usage section on billing page with progress bar and reset date in Portuguese | ✓ VERIFIED | `ai-usage-card.tsx` exports `AiUsageCard` with `<Progress>`, `mensagens usadas`, `Renova em`; `MySubscriptionTab.tsx` renders `<AiUsageCard />` at line 563 between plan info and add-ons |
| 4 | User sees in-app warning when usage reaches 80% of monthly limit | ✓ VERIFIED | `lia-container.tsx` lines 92-203: `showNearLimitBanner = usage.isNearLimit && !usage.isAtLimit && !nearLimitDismissed`; amber banner with count + reset date + dismiss button |
| 5 | Firestore rules enforce `aiUsage` read-only from client; `aiConversations` accessible only to owning user | ✓ VERIFIED | `firestore.rules` lines 433-446: `aiUsage` — `allow write: if false`; `aiConversations` — `allow read: if ... resource.data.uid == request.auth.uid; allow write: if false` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/ui/progress.tsx` | Shadcn Progress primitive | ✓ VERIFIED | Radix-based, exports `Progress`, 32 lines, commit `a314fe9b` |
| `functions/src/ai/chat.route.ts` | Three sequential guards before SSE stream | ✓ VERIFIED | Free-tier (403) → inactive-subscription (403) → limit (429) → `flushHeaders()` at line 163 |
| `src/components/profile/ai-usage-card.tsx` | Standalone AI usage card | ✓ VERIFIED | Exports `AiUsageCard`, uses `useLiaUsage()` + `useAuth()`, Progress bar with amber/destructive thresholds |
| `src/components/profile/MySubscriptionTab.tsx` | Renders AiUsageCard | ✓ VERIFIED | Import at line 45, `<AiUsageCard />` at line 563 between plan info and addons |
| `src/components/lia/lia-container.tsx` | Near-limit warning banner | ✓ VERIFIED | `nearLimitDismissed` state, `showNearLimitBanner` guard, amber banner with dismiss, Fragment wrapping banner + `LiaInputBar` |
| `firestore.rules` | AI collection security rules | ✓ VERIFIED | `aiUsage/{month}` and `aiConversations/{sessionId}` rules at lines 433-446 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `chat.route.ts` | `tenant-plan-policy.ts` | `evaluateSubscriptionStatusAccess` import | ✓ WIRED | Line 5: `import { getTenantPlanProfile, evaluateSubscriptionStatusAccess } from "../lib/tenant-plan-policy"` — function called at lines 60-63 |
| `ai-usage-card.tsx` | `src/hooks/useLiaUsage.ts` | `useLiaUsage()` hook call | ✓ WIRED | Line 3 import, line 12 call — all six return fields destructured |
| `ai-usage-card.tsx` | `src/components/ui/progress.tsx` | `Progress` import | ✓ WIRED | Line 5: `import { Progress } from "@/components/ui/progress"` — rendered at line 30 |
| `MySubscriptionTab.tsx` | `ai-usage-card.tsx` | import and render | ✓ WIRED | Line 45 import, line 563 JSX `<AiUsageCard />` |
| `lia-container.tsx` | `useLiaUsage.ts` | `usage.isNearLimit` and `usage.isAtLimit` | ✓ WIRED | `const usage = useLiaUsage()` consumed at line 93 for `showNearLimitBanner` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ai-usage-card.tsx` | `messagesUsed`, `messagesLimit`, `resetDate` | `useLiaUsage()` → `onSnapshot(doc(db, "tenants", tenantId, "aiUsage", yearMonth))` | Yes — real Firestore reads via `onSnapshot` | ✓ FLOWING |
| `lia-container.tsx` (banner) | `usage.isNearLimit`, `usage.messagesUsed`, `usage.resetDate` | Same `useLiaUsage()` hook — Firestore `aiUsage` doc | Yes — same real-time subscription | ✓ FLOWING |
| `chat.route.ts` | `planProfile.subscriptionStatus`, `limitCheck` | `getTenantPlanProfile(user.tenantId)` → Firestore `users/{uid}` + `checkAiLimit()` | Yes — server-side Firestore reads on every request | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend TypeScript compiles | `npx tsc --noEmit` (root) | Exit 0, no output | ✓ PASS |
| Backend TypeScript compiles | `cd functions && npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| `AI_FREE_TIER_BLOCKED` in chat.route.ts | `grep "AI_FREE_TIER_BLOCKED" functions/src/ai/chat.route.ts` | Line 54: match found | ✓ PASS |
| `AI_SUBSCRIPTION_INACTIVE` in chat.route.ts | `grep "AI_SUBSCRIPTION_INACTIVE" functions/src/ai/chat.route.ts` | Line 67: match found | ✓ PASS |
| `evaluateSubscriptionStatusAccess` exported from policy | `grep "export function evaluateSubscriptionStatusAccess" functions/src/lib/tenant-plan-policy.ts` | Line 542: match found | ✓ PASS |
| SSE stream starts after all guards | `grep -n "flushHeaders" functions/src/ai/chat.route.ts` | Line 163 — after free-tier (56), subscription (69), and limit (84) guards | ✓ PASS |
| All phase 16 commits present in git log | `git log --oneline` | `a314fe9b`, `27e57d3f`, `eb05d96d`, `49c5cbdd`, `a1b072cf` all found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AIBI-01 | 16-01 | Free plan tenant blocked with 403 before stream starts | ✓ SATISFIED | `chat.route.ts` line 51-57: `if (planProfile.tier === "free")` → 403 `AI_FREE_TIER_BLOCKED`; before `flushHeaders` at line 163 |
| AIBI-02 | 16-02 | Tenant with inactive subscription blocked with 403 before stream | ✓ SATISFIED | `chat.route.ts` lines 59-70: `evaluateSubscriptionStatusAccess` → 403 `AI_SUBSCRIPTION_INACTIVE`; `pastDueSince` passed to enable grace-period logic |
| AIBI-03 | 16-01 | Tenant at message limit receives 429 with `resetAt`; input disabled | ✓ SATISFIED | `chat.route.ts` lines 74-85: 429 `AI_LIMIT_EXCEEDED` with `resetAt`; `lia-input-bar.tsx` line 26: `disabled = isStreaming \|\| isAtLimit` |
| AIBI-04 | 16-03 | User views AI usage on billing page (progress bar + reset date) | ✓ SATISFIED | `ai-usage-card.tsx` with Progress bar, "X de Y mensagens usadas", "Renova em {date}"; rendered in `MySubscriptionTab.tsx` line 563 |
| AIBI-05 | 16-04 | User sees in-app warning at 80% monthly message usage | ✓ SATISFIED | `lia-container.tsx` banner: `showNearLimitBanner = usage.isNearLimit && !usage.isAtLimit && !nearLimitDismissed`; amber banner with count, reset date, and X dismiss |
| AIBI-06 | 16-01 | Firestore rules restrict `aiUsage` (read-only) and `aiConversations` (owner-only) | ✓ SATISFIED | `firestore.rules` lines 433-446: `allow write: if false` on both collections; `aiConversations` read requires `resource.data.uid == request.auth.uid` |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `ai-usage-card.tsx:16` | `return null` | ℹ️ Info | Legitimate conditional guard: free plan and loading state — not a stub. Real data flows when user is paid and loaded. |
| `ai-usage-card.tsx:17` | `return null` | ℹ️ Info | Legitimate loading guard — `isLoading` is false once `onSnapshot` populates state. |

No blocking anti-patterns found. The two `return null` cases are intentional conditional rendering guards, not stubs — real data flows through `useLiaUsage()` via `onSnapshot` in all other code paths.

### Guard Order Verification (AIBI-01 + AIBI-02 Critical)

The guard sequence in `chat.route.ts` was confirmed in order:
1. Auth check → 401 (line 19-22)
2. Input validation → 400 (lines 25-39)
3. Resolve `planProfile` from Firestore (lines 42-48)
4. **AIBI-01**: Free-tier block → 403 `AI_FREE_TIER_BLOCKED` (lines 50-57)
5. **AIBI-02**: Inactive subscription block → 403 `AI_SUBSCRIPTION_INACTIVE` (lines 59-70)
6. **AIBI-03**: Monthly limit check → 429 `AI_LIMIT_EXCEEDED` (lines 74-85)
7. SSE stream start: `res.flushHeaders()` (line 163)

All three security gates fire **before** any SSE stream begins.

### Human Verification Required

#### 1. Near-limit amber banner appearance

**Test:** Log in as a paid tenant (starter/pro) with 80-99% of monthly AI messages used. Open the Lia panel.
**Expected:** Amber banner displays "Você usou N de M mensagens este mês. Renova em {date}." with an X button.
**Why human:** Banner visibility requires `isNearLimit = true` from live Firestore data. Cannot manipulate Firestore state in a read-only check.

#### 2. Banner dismiss persistence

**Test:** Dismiss the amber banner via the X button. Navigate away and return to the Lia panel without a full page reload.
**Expected:** Banner stays dismissed within the session. After a full page reload, the banner reappears.
**Why human:** Session-only `useState` dismiss behavior requires a running browser to validate.

#### 3. AiUsageCard visible on billing page for paid users

**Test:** Log in as a paid plan user. Navigate to the billing/subscription page (profile → subscription tab).
**Expected:** An AI usage card appears between the plan info section and the add-ons section, showing a progress bar, "X de Y mensagens usadas", and "Renova em {date}".
**Why human:** Visual placement, real-time data population from Firestore, and Portuguese text formatting require a browser.

#### 4. AiUsageCard hidden for free plan users

**Test:** Log in as a free plan user. Navigate to the billing/subscription page.
**Expected:** No AI usage card appears anywhere on the page.
**Why human:** The `user.role === "free"` guard behavior requires an authenticated free-plan session to validate.

### Gaps Summary

No gaps found. All 6 requirements (AIBI-01 through AIBI-06) are satisfied with real implementations wired to live Firestore data. The 4 human verification items concern visual rendering and session behavior that cannot be validated with static code analysis.

---

_Verified: 2026-04-14T21:50:00-03:00_
_Verifier: Claude (gsd-verifier)_
