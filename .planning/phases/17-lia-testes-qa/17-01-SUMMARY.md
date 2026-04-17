---
phase: 17-lia-testes-qa
plan: "01"
subsystem: e2e-infrastructure
tags: [e2e, seed, page-object, ci, playwright, lia]
dependency_graph:
  requires: []
  provides:
    - e2e/seed/data/ai.ts (AI test tenant + user constants + seedAiTenants)
    - e2e/pages/lia.page.ts (LiaPage page object)
    - e2e/seed/seed-factory.ts (updated seedAll + clearAll)
  affects:
    - .github/workflows/push-checks.yml (GEMINI_API_KEY env)
    - .github/workflows/test-suite.yml (GEMINI_API_KEY env)
tech_stack:
  added: []
  patterns:
    - Seed data file pattern (constants + async seed function) matching existing users.ts/tenants.ts
    - Page Object Model pattern (class with typed Locator properties) matching existing login.page.ts
    - SeedUserFreeRole interface extension (Omit<SeedUser, "role"> with role: "free") for custom claim testing
key_files:
  created:
    - e2e/seed/data/ai.ts
    - e2e/pages/lia.page.ts
  modified:
    - e2e/seed/seed-factory.ts
    - .github/workflows/push-checks.yml
    - .github/workflows/test-suite.yml
decisions:
  - "SeedUserFreeRole extends Omit<SeedUser, 'role'> to accommodate role: 'free' which is not in the SeedUser union — avoids casting, keeps type safety"
  - "AI_TENANT_PLANS lookup map used in seedAiTenants to keep plan metadata co-located and avoid repetition across tenants"
  - "seedAiTenants called after seedUsers() in seedAll() — Auth/Firestore dependencies already set up at that point"
  - "clearAll() deletes AI subcollections (aiConversations, aiUsage) per tenant rather than top-level — subcollections are not deleted by parent document deletion in Firestore"
metrics:
  duration_minutes: 6
  completed_date: "2026-04-15T00:22:54Z"
  tasks_completed: 3
  files_changed: 5
---

# Phase 17 Plan 01: AI E2E Infrastructure — Seed, Page Object, CI

**One-liner:** AI test seed infrastructure with 3 plan-tier tenants, 5 users (including free-role), LiaPage POM with aria-label selectors, and GEMINI_API_KEY wired into both CI pipelines.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create AI seed data file | e7393df2 | e2e/seed/data/ai.ts (created) |
| 2 | Create LiaPage POM + update seed-factory | 79b6139e | e2e/pages/lia.page.ts (created), e2e/seed/seed-factory.ts (modified) |
| 3 | Add GEMINI_API_KEY to CI workflows | 9f44baed | .github/workflows/push-checks.yml, .github/workflows/test-suite.yml |

## What Was Built

### `e2e/seed/data/ai.ts`
Defines the AI test data foundation:
- **3 tenants:** TENANT_AI_TEST (pro/active), TENANT_AI_STARTER (starter/active), TENANT_AI_FREE (free/canceled)
- **5 users:** USER_AI_ADMIN, USER_AI_MEMBER (ai-test tenant), USER_AI_STARTER (ai-starter), USER_AI_FREE (ai-free), USER_AI_FREE_ROLE (ai-free, role: "free")
- `SeedUserFreeRole` interface extending `SeedUser` with `role: "free"` — required because `SeedUser` only allows `"admin" | "member"`
- `seedAiTenants(auth, db)` — creates all tenants + users in emulator Auth and Firestore
- `seedAiUsage(db, tenantId, messagesUsed)` — seeds current-month usage for plan-limits tests
- `clearAiUsage(db, tenantId)` — resets current-month usage between test cases

### `e2e/pages/lia.page.ts`
Typed Playwright Page Object Model for the Lia AI panel:
- **Locators:** triggerButtonOpen, triggerButtonClose, panel, usageBadge, messageInput, sendButton, nearLimitBannerClose
- All selectors derived from actual aria-labels in Lia components
- **Methods:** openPanel, closePanel, isTriggerVisible, getBadgeText, isInputDisabled, getInputPlaceholder, sendMessage

### `e2e/seed/seed-factory.ts`
- `seedAll()` now calls `seedAiTenants(auth, db)` after `seedUsers()`
- `clearAll()` includes 5 new AI user UIDs for deletion
- `clearAll()` deletes `aiConversations` and `aiUsage` subcollections for all 3 AI tenants

### CI Workflows
- `push-checks.yml` e2e-push job: `GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}` added after `STRIPE_SECRET_KEY`
- `test-suite.yml` e2e job: same line added in the same relative position

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all seed data is fully wired and functional.

## Threat Flags

None — GEMINI_API_KEY is accessed via GitHub secrets reference (`${{ secrets.GEMINI_API_KEY }}`), which GitHub masks in logs. No key value is echoed or hardcoded.

## Self-Check

Files created/modified:
- [x] e2e/seed/data/ai.ts exists
- [x] e2e/pages/lia.page.ts exists
- [x] e2e/seed/seed-factory.ts modified (seedAiTenants import + call + clearAll updates)
- [x] .github/workflows/push-checks.yml contains GEMINI_API_KEY line
- [x] .github/workflows/test-suite.yml contains GEMINI_API_KEY line

Commits exist:
- [x] e7393df2 (Task 1)
- [x] 79b6139e (Task 2)
- [x] 9f44baed (Task 3)

TypeScript: passes with 0 errors.

## Self-Check: PASSED
