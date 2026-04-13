# Roadmap: ProOps Testing Suite

## Overview

This roadmap spans two milestones. **v1.0** built the full testing infrastructure and coverage for Auth, Proposals, Financial, Billing, Performance, and Security. **v2.0** closes the gaps identified post-v1.0: Contacts CRUD, Products CRUD, Auth registration, missing financial flows, and performance expansion to additional pages.

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

- [x] 07-01-PLAN.md -- Firestore Rules Tests + Tenant Isolation Validation
- [x] 07-02-PLAN.md -- OWASP ZAP Automated Scan + CI Integration

---

## v3.0 — AI Assistant (Lia)

### Phase 12: Lia — Arquitetura & Pesquisa

**Goal**: Mapear o codebase real, fechar todas as decisões de arquitetura e produzir um plano de execução detalhado para a Lia antes de escrever qualquer código.
**Depends on**: Nothing (research phase)
**Requirements**: LIA-01
**Success Criteria** (what must be TRUE):

1. RESEARCH.md preenchido com achados reais do codebase (services, auth, Firestore patterns, layout constraints)
2. Todas as decisões em aberto no CONTEXT.md fechadas com justificativa
3. Schema TypeScript de `AiUsageDocument` e `AiConversationDocument` validado contra o Firestore existente
4. PLAN.md com checklist granular por arquivo para as fases 2–6

**Plans:** 1 plan
Plans:

- [x] 12-PLAN.md -- Arquitetura, pesquisa e plano de execução da Lia

### Phase 13: Lia — Backend Core

**Goal**: API de chat com streaming SSE, integração com Gemini, controle de usage mensal, persistência de conversa Pro/Enterprise, e rota Express `/v1/ai/chat` integrada ao monolito.
**Depends on**: Phase 12
**Requirements**: LIA-02
**Success Criteria** (what must be TRUE):

1. `POST /v1/ai/chat` recebe mensagem e retorna streaming SSE com resposta da Lia via Gemini
2. Tenant Free recebe 403; tenant com limite esgotado recebe 429 com `resetAt`
3. `aiUsage/{YYYY-MM}` incrementado atomicamente após cada mensagem processada
4. Histórico persiste em `aiConversations/{sessionId}` para planos Pro/Enterprise; Starter retorna array vazio
5. Todos os testes passam nos emuladores Firebase locais

**Plans:** 2/3 plans executed
Plans:

- [ ] 13-01-PLAN.md -- Fundacao: tipos AI_LIMITS, model-router, usage-tracker
- [ ] 13-02-PLAN.md -- Conversation store e context builder (system prompt)
- [ ] 13-03-PLAN.md -- Chat route SSE, integracao Express monolith, Firestore rules

---

## v2.0 — E2E Coverage Expansion

### Phase 8: Contacts & Products CRUD E2E

**Goal**: E2E tests cover the full CRUD lifecycle for Contacts and Products — two modules with zero coverage in v1.0.
**Depends on**: Phase 1 (infrastructure)
**Requirements**: CONT-01, CONT-02, CONT-03, PROD-01, PROD-02, PROD-03
**Success Criteria** (what must be TRUE):

1. Test suite validates that a user can create, edit, and delete a contact with valid data
2. Test suite validates that a user can create, edit, and delete a product with valid data
3. Seed data includes at least one contact and one product for tenant-alpha before tests run
   **Plans:** 2 plans
   Plans:

- [x] 08-01-PLAN.md -- Contacts CRUD E2E Tests
- [x] 08-02-PLAN.md -- Products CRUD E2E Tests

### Phase 9: Auth Registration E2E

**Goal**: E2E tests validate the tenant self-signup flow end-to-end — new tenant registers, gets provisioned with correct Firebase custom claims, and can access the dashboard.
**Depends on**: Phase 1 (infrastructure)
**Requirements**: REG-01, REG-02, REG-03
**Success Criteria** (what must be TRUE):

1. Test suite validates that a new user can complete the registration form and submit successfully
2. Test suite validates that the newly registered tenant has correct custom claims (`tenantId`, `role`, `masterId`) after signup
3. Test suite validates that the new tenant can navigate to and load the dashboard after registration
   **Plans:** 1 plan
   Plans:

- [x] 09-01-PLAN.md -- Auth Registration E2E Tests

### Phase 10: Financial Gaps E2E

**Goal**: E2E tests close the three financial coverage gaps: expense-type transactions, selective installment payment, and the proposal-approval → transaction sync flow.
**Depends on**: Phase 4 (financial module E2E baseline)
**Requirements**: FIN-07, FIN-08, FIN-09
**Success Criteria** (what must be TRUE):

1. Test suite validates CRUD for transactions with `type=expense` (create, edit, delete)
2. Test suite validates that a user can pay individual installments in a group without paying all — remaining installments stay unpaid
3. Test suite validates that approving a proposal triggers `syncApprovedProposalTransactions` and the correct transactions (amount, structure) appear in the financial module
   **Plans:** 1/2 plans executed
   Plans:

- [x] 10-01-PLAN.md -- Expense CRUD + Selective Installment Payment E2E
- [ ] 10-02-PLAN.md -- Proposal Approval → Transaction Sync E2E

### Phase 11: Performance Expansion

**Goal**: Extend Lighthouse CI and API baseline coverage to /contacts and /products pages — closing the performance gap left by v1.0 which only covered login, dashboard, proposals, and transactions.
**Depends on**: Phase 6 (performance tests baseline)
**Requirements**: PERF-04, PERF-05, PERF-06
**Success Criteria** (what must be TRUE):

1. Lighthouse CI measures LCP ≤ 2.5s and CLS ≤ 0.1 on /contacts and /products pages
2. API response time baseline for contacts list and products list endpoints is documented and validated (≤ 500ms p95)
3. CI fails if Lighthouse scores for these pages degrade beyond configured thresholds
   **Plans:** 1 plan
   Plans:

- [ ] 11-01-PLAN.md -- Contacts & Products Performance Tests

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

| Phase                           | Plans Complete | Status      | Completed  |
| ------------------------------- | -------------- | ----------- | ---------- |
| 1. Test Infrastructure          | 3/3            | Complete    | 2026-04-06 |
| 2. Auth & Multi-Tenant E2E      | 2/2            | Complete    | 2026-04-06 |
| 3. Proposals & CRM E2E          | 3/3            | Complete    | 2026-04-07 |
| 4. Financial Module E2E         | 3/3            | Complete    | 2026-04-07 |
| 5. Stripe & Billing E2E         | 3/3            | Complete    | 2026-04-08 |
| 6. Performance Tests            | 2/2            | Complete    | 2026-04-08 |
| 7. Security Tests               | 2/2            | Complete    | 2026-04-08 |
| 8. Contacts & Products CRUD E2E | 2/2            | Complete    | 2026-04-09 |
| 9. Auth Registration E2E        | 1/1            | Complete    | 2026-04-09 |
| 10. Financial Gaps E2E          | 1/2 | In Progress|  |
| 11. Performance Expansion       | 0/1            | Not started | -          |
| 12. Lia — Arquitetura & Pesquisa | 1/1           | Complete    | 2026-04-13 |
| 13. Lia — Backend Core          | 2/3 | In Progress|  |
