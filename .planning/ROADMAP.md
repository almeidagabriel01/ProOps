# Roadmap: ProOps Testing Suite

## Overview

This milestone builds a complete testing suite from zero for a brownfield multi-tenant SaaS. The work flows from infrastructure outward: the Playwright + Firebase Emulator foundation enables auth E2E, which unlocks proposal and financial flow tests, then billing/webhook tests, and finally performance and security validation. Every phase delivers independently verifiable confidence in a critical slice of the system.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Test Infrastructure** - Playwright, Firebase Emulators, seed data, CI pipeline
- [ ] **Phase 2: Auth & Multi-Tenant E2E** - Login, session, logout, claims, route guards, tenant isolation
- [ ] **Phase 3: Proposals & CRM E2E** - CRUD, PDF generation, public links, status transitions
- [ ] **Phase 4: Financial Module E2E** - Transactions, wallets, transfers, installments
- [ ] **Phase 5: Stripe & Billing E2E** - Subscription flows, webhooks, plan limits, WhatsApp overage
- [ ] **Phase 6: Performance Tests** - Lighthouse CI with Core Web Vitals thresholds and API baselines
- [ ] **Phase 7: Security Tests** - OWASP ZAP scan, Firestore rules audit, tenant isolation validation

## Phase Details

### Phase 1: Test Infrastructure

**Goal**: Developer can run any test suite locally with a single command against isolated Firebase Emulators, and CI executes all suites automatically on every PR.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):

1. Developer runs `npm run test:e2e` locally and tests execute against Firebase Emulators with no manual setup
2. Developer runs `npm run test:performance` and a Lighthouse report is generated locally
3. Developer runs `npm run test:security` and an OWASP ZAP report is generated locally
4. Playwright is configured with TypeScript, Page Object Model, and reusable fixtures for main pages
5. Seed data factory deterministically populates emulators with 2 tenants, multiple roles, proposals, transactions, and wallets; CI uploads test reports as downloadable artifacts on every PR
   **Plans:** 3 plans
   Plans:

- [x] 01-01-PLAN.md -- Playwright + Firebase Emulators + Seed Data + Page Object Model
- [x] 01-02-PLAN.md -- Lighthouse Performance + Security Scan Scripts
- [x] 01-03-PLAN.md -- GitHub Actions CI Pipeline

### Phase 2: Auth & Multi-Tenant E2E

**Goal**: E2E tests prove that authentication works end-to-end and that multi-tenant data isolation is enforced — the security foundation for all other test phases.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):

1. Test suite validates that a user can log in with email and password and that Firebase custom claims (`tenantId`, `role`, `masterId`) are correct post-login
2. Test suite validates that session persists after page refresh via `__session` cookie and that logout clears the session
3. Test suite validates that unauthenticated requests to protected routes are redirected to the login page
4. Test suite validates that Tenant A cannot read, create, or modify any document belonging to Tenant B — CI blocks the PR if this test fails
   **Plans:** 2 plans
   Plans:

- [x] 02-01-PLAN.md -- Auth Flow E2E Tests (Login, Session, Logout, Custom Claims)
- [x] 02-02-PLAN.md -- Route Guards + Tenant Isolation E2E Tests

### Phase 3: Proposals & CRM E2E

**Goal**: E2E tests cover the full proposal lifecycle — the highest-value business flow in ProOps — from creation through status transitions, PDF generation, and public sharing.
**Depends on**: Phase 2
**Requirements**: PROP-01, PROP-02, PROP-03, PROP-04, PROP-05, PROP-06
**Success Criteria** (what must be TRUE):

1. Test suite validates that a user can create, edit, and delete a proposal with valid data
2. Test suite validates that a proposal generates a PDF correctly via the backend endpoint
3. Test suite validates that a public proposal link is accessible without authentication
4. Test suite validates the full status lifecycle: draft → sent → approved/rejected
   **Plans:** 3 plans
   Plans:

- [ ] 01-01-PLAN.md -- Playwright + Firebase Emulators + Seed Data + Page Object Model
- [ ] 01-02-PLAN.md -- Lighthouse Performance + Security Scan Scripts
- [ ] 01-03-PLAN.md -- GitHub Actions CI Pipeline

### Phase 4: Financial Module E2E

**Goal**: E2E tests validate the complete financial module — transactions, wallets, transfers, and installments — ensuring the core billing cycle works correctly and atomically.
**Depends on**: Phase 2
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06
**Success Criteria** (what must be TRUE):

1. Test suite validates that a user can create, edit, and delete a transaction with valid data
2. Test suite validates that a user can create a wallet and transfer balance between wallets
3. Test suite validates that wallet balance is updated correctly and atomically after operations
4. Test suite validates that a user can create an installment transaction and mark individual installments as paid
   **Plans:** 3 plans
   Plans:

- [ ] 01-01-PLAN.md -- Playwright + Firebase Emulators + Seed Data + Page Object Model
- [ ] 01-02-PLAN.md -- Lighthouse Performance + Security Scan Scripts
- [ ] 01-03-PLAN.md -- GitHub Actions CI Pipeline

### Phase 5: Stripe & Billing E2E

**Goal**: E2E tests cover Stripe subscription flows, webhook handling, plan enforcement, and WhatsApp overage billing — the complex async paths that must not regress silently.
**Depends on**: Phase 2
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05
**Success Criteria** (what must be TRUE):

1. Test suite validates that a tenant can subscribe to a plan and that plan features are unlocked accordingly
2. Test suite validates that the `subscription.created` webhook correctly updates tenant status and that `subscription.cancelled` correctly revokes plan access
3. Test suite validates that a free-tier tenant is blocked from creating resources beyond plan limits
4. Test suite validates that the WhatsApp overage cron calculates and records the correct charge for a given month
   **Plans:** 3 plans
   Plans:

- [ ] 01-01-PLAN.md -- Playwright + Firebase Emulators + Seed Data + Page Object Model
- [ ] 01-02-PLAN.md -- Lighthouse Performance + Security Scan Scripts
- [ ] 01-03-PLAN.md -- GitHub Actions CI Pipeline

### Phase 6: Performance Tests

**Goal**: Lighthouse CI enforces Core Web Vitals thresholds on critical pages and API response time baselines are documented and validated — CI fails on regression.
**Depends on**: Phase 1
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):

1. Lighthouse CI measures LCP ≤ 2.5s, FID ≤ 100ms, CLS ≤ 0.1 on dashboard, proposals, and transactions pages and produces a report
2. CI pipeline fails automatically if Lighthouse scores degrade beyond configured thresholds
3. API response time baselines for proposals list and transactions list (≤ 500ms p95) are documented and validated in CI
   **Plans:** 3 plans
   Plans:

- [ ] 01-01-PLAN.md -- Playwright + Firebase Emulators + Seed Data + Page Object Model
- [ ] 01-02-PLAN.md -- Lighthouse Performance + Security Scan Scripts
- [ ] 01-03-PLAN.md -- GitHub Actions CI Pipeline
      **UI hint**: yes

### Phase 7: Security Tests

**Goal**: OWASP ZAP automated scanning and Firestore rules tests provide a security baseline, with explicit validation that tenant isolation holds across all critical collections.
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):

1. OWASP ZAP scan runs automatically and produces a vulnerability report in CI
2. Firestore rules tests validate that a user without custom claims cannot access any collection
3. Firestore rules tests validate that tenant isolation is enforced across all critical Firestore collections
4. Firestore rules tests validate that a user from Tenant A cannot read or write documents belonging to Tenant B
   **Plans:** 3 plans
   Plans:

- [ ] 01-01-PLAN.md -- Playwright + Firebase Emulators + Seed Data + Page Object Model
- [ ] 01-02-PLAN.md -- Lighthouse Performance + Security Scan Scripts
- [ ] 01-03-PLAN.md -- GitHub Actions CI Pipeline

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase                      | Plans Complete | Status      | Completed |
| -------------------------- | -------------- | ----------- | --------- |
| 1. Test Infrastructure     | 0/?            | Not started | -         |
| 2. Auth & Multi-Tenant E2E | 0/?            | Not started | -         |
| 3. Proposals & CRM E2E     | 0/?            | Not started | -         |
| 4. Financial Module E2E    | 0/?            | Not started | -         |
| 5. Stripe & Billing E2E    | 0/?            | Not started | -         |
| 6. Performance Tests       | 0/?            | Not started | -         |
| 7. Security Tests          | 0/?            | Not started | -         |
