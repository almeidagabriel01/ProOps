# Deferred Items — Phase 22

## Pre-existing Lint Errors (out of scope, not caused by Phase 22 changes)

Discovered during Task 1 lint verification. These errors exist in files not touched by this phase.

| File | Error | Rule |
|------|-------|------|
| `apps/web/src/components/billing/price-change-banner.tsx:34` | `Date.now` impure function in render | `react-hooks/purity` |
| `apps/web/src/components/shared/subscription-guard.tsx:64` | `Date.now` impure function in render | `react-hooks/purity` |
| `apps/web/src/components/shared/subscription-guard.tsx:86` | `Date.now` impure function in render | `react-hooks/purity` |
| `apps/web/src/hooks/usePriceChange.ts:43` | `setState` synchronously in effect | `react-hooks/set-state-in-effect` |
| `apps/web/src/hooks/usePriceChange.ts:68` | Existing memoization could not be preserved | `react-hooks/preserve-manual-memoization` |
| `apps/web/src/components/profile/MySubscriptionTab.tsx:6` | `auth` defined but never used | `@typescript-eslint/no-unused-vars` |

These should be fixed in a dedicated cleanup pass, not by Phase 22 plans.

## Future Cleanup

- `redirectReason` in `UseLoginFormReturn` interface: the field is kept because the session-recovery useEffect still reads it. After that flow is re-evaluated, `redirectReason` could be removed from the public hook contract if it's no longer needed at the page level.
