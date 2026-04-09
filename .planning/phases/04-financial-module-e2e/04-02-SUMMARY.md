---
phase: 04-financial-module-e2e
plan: 02
subsystem: e2e-testing
tags: [e2e, playwright, wallets, POM, FIN-04, FIN-05]
dependency_graph:
  requires: [04-01]
  provides: [FIN-04, FIN-05]
  affects: [e2e/financial/wallet-operations.spec.ts, e2e/pages/wallets.page.ts, e2e/fixtures/base.fixture.ts]
tech_stack:
  added: []
  patterns: [wallet-card-locator-by-class, radix-dropdown-text-filter, url-predicate-waitForURL]
key_files:
  created:
    - e2e/pages/wallets.page.ts
    - e2e/financial/wallet-operations.spec.ts
  modified:
    - e2e/fixtures/base.fixture.ts
    - playwright.config.ts
decisions:
  - "WalletCard locator: div.rounded-lg.border with h3 filter — CardContent has no class suffix in rendered HTML"
  - "Radix DropdownMenuItem: use text filter (not getByRole menuitem) — items render as generic divs in Playwright accessibility tree"
  - "isLoaded() URL predicate: (url) => url.pathname === /wallets — avoids false match on /login?redirect=/wallets query string"
  - "reuseExistingServer: !process.env.CI — allows local dev to reuse running test server"
  - "TransferDialog fromSelect: evaluate() to find option by text prefix — De options show name + balance suffix"
metrics:
  duration_minutes: 13
  completed_date: "2026-04-07"
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 02: Wallet Operations E2E Summary

**One-liner:** WalletsPage POM with full wallet CRUD + transfer lifecycle, FIN-04 create-transfer-verify-cleanup and FIN-05 atomic balance delta assertions, both passing against Firebase Emulators.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create WalletsPage POM and register in base fixture | `04c27b6c` | e2e/pages/wallets.page.ts, e2e/fixtures/base.fixture.ts |
| 2 | Write wallet operations E2E tests (FIN-04, FIN-05) | `907f2fe6` | e2e/financial/wallet-operations.spec.ts, e2e/pages/wallets.page.ts, playwright.config.ts |

## Decisions Made

1. **WalletCard locator strategy:** `div.rounded-lg.border` with `h3` text filter. The `CardContent` Shadcn component renders as a plain `<div class="p-6 pt-0 p-5">` — no "CardContent" in any class name. Using the outer `<Card>` Tailwind classes (`rounded-lg border`) as the anchor is reliable.

2. **Radix DropdownMenuItem ARIA:** Items render as `generic [cursor=pointer]` (not `menuitem`) in Playwright's accessibility snapshot. Using `page.locator("div").filter({ hasText: /^Transferir$/ }).last()` with exact text is the correct approach.

3. **isLoaded() URL predicate:** Changed from regex `/wallets/` to `(url) => url.pathname === "/wallets"`. The regex falsely matched `/login?redirect=/wallets` in the query string, causing the test to proceed to `getByText("Conta Principal")` while actually on the login page. This was the root cause of FIN-04's intermittent failure.

4. **playwright.config.ts reuseExistingServer:** Changed `false` to `!process.env.CI` — preserves strict isolation in CI while allowing local dev to reuse a running test server without clearing `.next`.

5. **TransferDialog select by value:** `De` select options display `"{name} - R$ {balance}"` so exact label match fails. Used `evaluate()` to find option by `text.startsWith(name)` and extract its `value` (wallet ID), then pass that to `selectOption(value)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WalletCard locator using CSS class that doesn't exist in rendered DOM**
- **Found during:** Task 2 (first test run)
- **Issue:** `div[class*='CardContent']` never matched — CardContent is a React component, its rendered `<div>` has only Tailwind classes
- **Fix:** Changed to `div.rounded-lg.border` with `h3` text filter — outer Card div has reliable Tailwind classes
- **Files modified:** e2e/pages/wallets.page.ts
- **Commit:** 907f2fe6

**2. [Rule 1 - Bug] Radix DropdownMenuItem ARIA role mismatch**
- **Found during:** Task 2 (second test run)
- **Issue:** `getByRole("menuitem")` found nothing — Radix DropdownMenuItem renders as generic div in Playwright accessibility tree
- **Fix:** Changed to `locator("div").filter({ hasText: /^Transferir$/ }).last()` for all dropdown items
- **Files modified:** e2e/pages/wallets.page.ts
- **Commit:** 907f2fe6

**3. [Rule 1 - Bug] isLoaded() URL regex false-matched login redirect query string**
- **Found during:** Task 2 (third test run)
- **Issue:** After transfer + navigate-away-and-back, middleware redirected to `/login?redirect=/wallets`. The regex `/wallets/` matched the query string so `waitForURL` resolved, but the page was actually the login page
- **Fix:** Changed to URL predicate `(url) => url.pathname === "/wallets"` to match pathname only
- **Files modified:** e2e/pages/wallets.page.ts
- **Commit:** 907f2fe6

## Verification Results

```
Running 2 tests using 1 worker
  ✓ [chromium] FIN-04: Wallet creation and balance transfer (25.8s)
  ✓ [chromium] FIN-05: Wallet balance updates correctly after operations (7.6s)
  2 passed (42.6s)
```

## Known Stubs

None — all wallet operations are fully wired to the Firebase Emulator backend.

## Threat Flags

None — tests run exclusively against emulator data with synthetic balances.

## Self-Check: PASSED

- e2e/pages/wallets.page.ts: FOUND
- e2e/financial/wallet-operations.spec.ts: FOUND
- .planning/phases/04-financial-module-e2e/04-02-SUMMARY.md: FOUND
- Commit 04c27b6c (Task 1): FOUND
- Commit 907f2fe6 (Task 2): FOUND
