---
phase: 16-lia-seguranca-billing
plan: "03"
subsystem: frontend
tags: [lia, ai-usage, billing, progress-bar, ui]
dependency_graph:
  requires: [16-01]
  provides: [AIBI-04]
  affects: [src/components/profile/MySubscriptionTab.tsx]
tech_stack:
  added: [src/components/ui/progress.tsx]
  patterns: [Radix Progress primitive via radix-ui meta-package, self-contained card component with internal hook consumption]
key_files:
  created:
    - src/components/profile/ai-usage-card.tsx
    - src/components/ui/progress.tsx
  modified:
    - src/components/profile/MySubscriptionTab.tsx
decisions:
  - "Progress component created from radix-ui meta-package (not @radix-ui/react-progress) — meta-package already installed, no new dependency needed"
  - "Free plan guard uses !user || user.role === 'free' — explicit null check per Phase 15-10 pattern to avoid auth bypass via undefined != 'free'"
  - "AiUsageCard is self-contained; MySubscriptionTab renders it with no props or conditional wrapper"
metrics:
  duration: 2
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_changed: 3
---

# Phase 16 Plan 03: AI Usage Card on Billing Page Summary

**One-liner:** Radix Progress-based AiUsageCard on billing page showing monthly AI message consumption with amber/red thresholds for paid users.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create AiUsageCard component | eb05d96d | ai-usage-card.tsx, progress.tsx |
| 2 | Render AiUsageCard in MySubscriptionTab | 49c5cbdd | MySubscriptionTab.tsx |

## What Was Built

- **`src/components/ui/progress.tsx`** — Radix-based Progress bar component using `radix-ui` meta-package (same pattern as `collapsible.tsx`). Exposes `<Progress value={0-100} className="" />` with `[&>div]` indicator slot for color overrides via Tailwind.

- **`src/components/profile/ai-usage-card.tsx`** — Self-contained AI usage card. Calls `useLiaUsage()` internally for real-time Firestore usage data and `useAuth()` for free-plan detection. Renders a `<Progress>` bar capped at 100%, a count label `"X de Y mensagens usadas"`, and a reset date `"Renova em {date}"`. Returns `null` for free-plan users and while loading.

- **`src/components/profile/MySubscriptionTab.tsx`** — Added import and `<AiUsageCard />` render between the plan info Card (line 560) and Add-ons Card (line 565). No props passed — component manages its own visibility logic.

## Behavior

| Scenario | Result |
|----------|--------|
| Free plan user | Card hidden (returns null) |
| Paid user, data loading | Card hidden (returns null) |
| Paid user, < 80% usage | Progress bar at primary color |
| Paid user, >= 80% usage | Progress bar turns amber |
| Paid user, >= 100% usage | Progress bar turns destructive red |
| Usage exceeds limit | Progress bar capped at 100% display |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing Dependency] Created progress.tsx — component referenced in plan but not yet installed**
- **Found during:** Task 1 pre-read
- **Issue:** `src/components/ui/progress.tsx` did not exist. Plan referenced `Progress` from `@/components/ui/progress` but no `@radix-ui/react-progress` package was installed. The `radix-ui` meta-package already includes `Progress`.
- **Fix:** Created `progress.tsx` using `Progress` from `radix-ui` meta-package, matching the existing `collapsible.tsx` pattern. No new npm dependency needed.
- **Files modified:** `src/components/ui/progress.tsx` (new file)
- **Commit:** eb05d96d

**2. [Rule 2 - Missing Critical Check] Added explicit null check on user before role access**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `user?.role === "free"` guard, but per Phase 15-10 decision, `user?.role` with optional chaining returns `undefined` when `user` is null, and `undefined !== "free"` evaluates to true — allowing unauthenticated users through.
- **Fix:** Changed guard to `!user || user.role === "free"` per established project pattern.
- **Files modified:** `src/components/profile/ai-usage-card.tsx`
- **Commit:** eb05d96d

## Verification Results

- `npx tsc --noEmit` — PASS
- `grep "AiUsageCard" MySubscriptionTab.tsx` — import + JSX found at lines 45 and 563
- `grep "export function AiUsageCard" ai-usage-card.tsx` — PASS
- `grep "useLiaUsage" ai-usage-card.tsx` — PASS

## Known Stubs

None — AiUsageCard reads live Firestore data via `useLiaUsage()`.

## Threat Flags

No new threat surface introduced. AiUsageCard is read-only — it consumes `useLiaUsage()` which reads `tenants/{tenantId}/aiUsage/{YYYY-MM}` via `onSnapshot`. Tenant isolation enforced by Firestore rule `belongsToTenant(tenantId)` (AIBI-06). No writes from this component.

## Self-Check: PASSED

- `src/components/profile/ai-usage-card.tsx` — FOUND
- `src/components/ui/progress.tsx` — FOUND
- `src/components/profile/MySubscriptionTab.tsx` — modified, AiUsageCard import and JSX present
- Commit eb05d96d — FOUND
- Commit 49c5cbdd — FOUND
