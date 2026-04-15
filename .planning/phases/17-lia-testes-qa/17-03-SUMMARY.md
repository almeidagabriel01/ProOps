---
phase: 17-lia-testes-qa
plan: "03"
subsystem: e2e-tests
tags: [e2e, playwright, ai, plan-limits, lia]
dependency_graph:
  requires: [17-01]
  provides: [AI-06-test, AI-07-test, AI-08-test]
  affects: [e2e/ai/]
tech_stack:
  added: []
  patterns: [playwright-api-test, playwright-ui-test, firestore-seed-per-test]
key_files:
  created:
    - e2e/ai/plan-limits.spec.ts
  modified: []
decisions:
  - "AI-06 and AI-07 as pure API tests using signInWithEmailPassword + fetch — no browser needed for HTTP assertions"
  - "AI-08 uses uiTest from base fixture to get emulator route interception for browser tests"
  - "Custom Tooltip component uses role='tooltip' on portal div — confirmed via tooltip.tsx source; getByRole('tooltip') selector is correct"
  - "describe.configure({ mode: 'serial' }) per describe block to prevent Firestore state collisions between API tests"
  - "Single commit for Tasks 1 and 2 since they both write to the same file (plan-limits.spec.ts) sequentially"
metrics:
  duration_seconds: 100
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 17 Plan 03: AI Plan Limit E2E Tests Summary

**One-liner:** Playwright E2E tests for AI monthly message cap enforcement — 429 AI_LIMIT_EXCEEDED API response (AI-06/07) and disabled input UI with reset date tooltip (AI-08).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write AI-06 and AI-07 plan limit API tests | 26633eae | e2e/ai/plan-limits.spec.ts (created) |
| 2 | Write AI-08 at-limit disabled input + reset date UI test | 26633eae | e2e/ai/plan-limits.spec.ts (appended) |

Both tasks wrote to the same file sequentially; committed together in one atomic commit.

## What Was Built

Created `e2e/ai/plan-limits.spec.ts` with three describe blocks:

**AI-06 — "Plan limit enforcement at message cap"** (pure API test):
- Seeds `ai-test` tenant aiUsage to 400 (pro plan limit) before each test
- Posts to `/v1/ai/chat` authenticated as `USER_AI_ADMIN`
- Asserts `response.status === 429` and `body.code === "AI_LIMIT_EXCEEDED"`
- Cleans up aiUsage after each test

**AI-07 — "Limit response includes correct metadata"** (pure API test):
- Same seeding pattern as AI-06
- Asserts `body.messagesUsed === 400`, `body.messagesLimit === 400`
- Asserts `body.resetAt` is defined, is a string, and is a future timestamp (next month's 1st)

**AI-08 — "At-limit disabled input with reset date"** (UI tests with browser):
- Uses `uiTest` from `e2e/fixtures/base.fixture` for emulator route interception
- Three test cases:
  1. Disabled input: `messageInput` asserted `toBeDisabled()`, placeholder = "Limite de mensagens atingido."
  2. Badge text: aria-label on usage badge = "400 de 400 mensagens usadas"
  3. Tooltip: hovers disabled send button, waits for `role="tooltip"` portal div to appear, asserts "Limite atingido" and "Renova em" text

## Key Implementation Notes

- `e2e/ai/` directory created (did not exist before this plan)
- Tooltip selector confirmed: custom `Tooltip` component renders a portal `<div role="tooltip">` — no Radix dependency needed
- `describe.configure({ mode: "serial" })` placed within each describe block (not at file level) to avoid Playwright scoping issues while still preventing intra-describe parallelism
- LoginPage `login()` method confirmed present in `e2e/pages/login.page.ts`
- TypeScript check `npx tsc --noEmit -p e2e/tsconfig.json` passed with zero errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — tests assert real contracts with no hardcoded stubs.

## Threat Flags

None — test-only file, no new network endpoints or security surface introduced.

## Self-Check: PASSED

- e2e/ai/plan-limits.spec.ts exists: FOUND
- Commit 26633eae exists: FOUND
- grep for AI-06, AI-07, AI-08 describe blocks: FOUND (18 keyword matches)
- grep for AI_LIMIT_EXCEEDED, messagesUsed, resetAt: FOUND
- grep for "Limite de mensagens atingido.": FOUND
- TypeScript: zero errors
