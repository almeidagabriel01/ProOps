---
phase: 01-test-infrastructure
plan: 1
subsystem: e2e-infrastructure
tags: [playwright, firebase-emulators, seed-data, page-object-model, test-fixtures]
dependency_graph:
  requires: []
  provides: [e2e-test-runner, firebase-emulator-setup, seed-data-factory, page-object-model, auth-fixture]
  affects: [all-subsequent-e2e-plans]
tech_stack:
  added: ["@playwright/test@^1.59.1"]
  patterns: [global-setup-teardown, page-object-model, fixture-composition, firebase-admin-seed]
key_files:
  created:
    - playwright.config.ts
    - e2e/global-setup.ts
    - e2e/global-teardown.ts
    - e2e/tsconfig.json
    - e2e/smoke.spec.ts
    - .env.test
    - e2e/seed/seed-factory.ts
    - e2e/seed/data/tenants.ts
    - e2e/seed/data/users.ts
    - e2e/seed/data/proposals.ts
    - e2e/seed/data/transactions.ts
    - e2e/seed/data/wallets.ts
    - e2e/pages/login.page.ts
    - e2e/pages/dashboard.page.ts
    - e2e/pages/proposals.page.ts
    - e2e/pages/transactions.page.ts
    - e2e/fixtures/base.fixture.ts
    - e2e/fixtures/auth.fixture.ts
  modified:
    - package.json
    - .gitignore
decisions:
  - "Used firebase-admin (already a project dependency) for seed factory rather than adding a separate devDependency"
  - "Used demo-proops-test as Firebase project ID (demo- prefix avoids needing real credentials)"
  - "Stored emulator PID in .emulator-pid file for cross-process teardown"
  - "Used -f to force-add .env.test since it contains only demo values, not real secrets"
  - "Emulator hub polling at 4400 rather than checking individual emulator ports for unified readiness check"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 18
  files_modified: 2
---

# Phase 01 Plan 01: Playwright + Firebase Emulators + Seed Data + Page Object Model Summary

Playwright E2E test infrastructure with auto-starting Firebase Emulators, deterministic seed data factory (2 tenants, 4 users, proposals, transactions, wallets), Page Object Model classes for all main pages, and reusable auth fixtures — zero manual setup required.

## What Was Built

### Task 1: Playwright + Firebase Emulator Configuration (commit 04a1995)

- `playwright.config.ts` — Playwright config with `globalSetup`/`globalTeardown`, `webServer` (Next.js dev server), single Chromium project, HTML+list reporters, CI-aware retries
- `e2e/global-setup.ts` — Spawns Firebase Emulators as a child process, polls Emulator Hub at `127.0.0.1:4400`, calls `seedAll()` once emulators are ready, writes PID to `.emulator-pid`
- `e2e/global-teardown.ts` — Reads PID file, kills emulator process tree (Windows: taskkill /T /F, Unix: negative PID SIGTERM), deletes PID file
- `e2e/tsconfig.json` — `module: "commonjs"` for Playwright Node runtime, extends root tsconfig
- `e2e/smoke.spec.ts` — 2-test smoke spec validating login page loads and authenticated user sees dashboard
- `.env.test` — Demo Firebase project env vars (no real secrets, safe to commit)
- `package.json` — Added `test:e2e`, `test:e2e:ui`, `test:e2e:debug` scripts
- `.gitignore` — Added `playwright-report/`, `test-results/`, `e2e/dist/`, `.emulator-pid`

### Task 2: Seed Factory + Page Object Model + Auth Fixtures (commit 6f15023)

**Seed Data Factory:**
- `e2e/seed/seed-factory.ts` — `seedAll()` / `clearAll()` using Firebase Admin SDK connecting to `demo-proops-test` emulators
- `e2e/seed/data/tenants.ts` — `TENANT_ALPHA` (automacao_residencial) and `TENANT_BETA` (cortinas)
- `e2e/seed/data/users.ts` — 4 users with custom claims (tenantId, role, masterId): admin-alpha, member-alpha, admin-beta, member-beta; all with password `Test1234!`
- `e2e/seed/data/proposals.ts` — 3 proposals for tenant-alpha (draft/sent/approved), 1 for tenant-beta
- `e2e/seed/data/transactions.ts` — 3 transactions for tenant-alpha (income-paid/expense-pending/installment), 1 for tenant-beta
- `e2e/seed/data/wallets.ts` — 2 wallets for tenant-alpha with `balance` field, 1 for tenant-beta

**Page Object Model:**
- `e2e/pages/login.page.ts` — `LoginPage` with `goto`, `fillEmail`, `fillPassword`, `submit`, `login(email, password)`, `getErrorMessage`; uses `#email`/`#password` id selectors matching actual form fields
- `e2e/pages/dashboard.page.ts` — `DashboardPage` with `goto`, `isLoaded`, `getWelcomeText`, `navigateTo(section)`
- `e2e/pages/proposals.page.ts` — `ProposalsPage` with `goto`, `isLoaded`, `getProposalCount`, `clickNewProposal`, `getProposalByTitle`
- `e2e/pages/transactions.page.ts` — `TransactionsPage` with `goto`, `isLoaded`, `getTransactionCount`, `clickNewTransaction`

**Fixtures:**
- `e2e/fixtures/base.fixture.ts` — Extends Playwright base `test` with typed POM fixtures: `loginPage`, `dashboardPage`, `proposalsPage`, `transactionsPage`
- `e2e/fixtures/auth.fixture.ts` — Provides `authenticatedPage` (logged in as admin@alpha.test) and `authenticatedAsBeta` fixtures

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all files are complete implementations. POM selectors include comments noting that `data-testid` attributes are fallbacks for when the app adds them; current selectors use existing `id` attributes and role-based selectors from the real DOM.

## Threat Flags

None — the e2e infrastructure only touches demo Firebase project data, never production. Seed credentials (Test1234!) are demo-only and scoped to the emulator project `demo-proops-test`.

## Self-Check: PASSED

All 18 created files verified present. Both commits (04a1995, 6f15023) verified in git log. TypeScript compilation (`npx tsc --noEmit -p e2e/tsconfig.json`) completed with no errors. Playwright test list shows 2 tests discovered correctly.
