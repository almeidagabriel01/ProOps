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
- [x] **Phase 15: Lia Frontend Chat UI** - LiaPanel, streaming SSE, message bubbles, tool dialogs, useAiChat hook (completed 2026-04-14)
- [ ] **Phase 16: Lia Segurança & Billing** - ai-auth middleware, AI_LIMITS, Firestore rules, billing page AI usage
- [ ] **Phase 17: Lia Testes & QA** - E2E AI-01–12, seed tenant ai-test pro, CI smoke test

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

**Plans:** 3/3 plans complete
Plans:

- [ ] 13-01-PLAN.md -- Fundacao: tipos AI_LIMITS, model-router, usage-tracker
- [ ] 13-02-PLAN.md -- Conversation store e context builder (system prompt)
- [ ] 13-03-PLAN.md -- Chat route SSE, integracao Express monolith, Firestore rules

### Phase 14: Lia — Tool System

**Goal**: Implementar o sistema completo de tools da Lia — definitions, schemas Zod, executor com validação dupla, e lógica de filtro de disponibilidade por planId, role e módulo. A Lia passa a executar ações reais no ProOps (criar propostas, buscar contatos, lançar transações, etc.) com confirmação obrigatória antes de qualquer delete.
**Depends on**: Phase 13
**Requirements**: LIA-03
**Success Criteria** (what must be TRUE):

1. `buildAvailableTools()` filtra tools por planId, role e módulo ativo antes de enviá-las ao modelo
2. `executeToolCall()` valida módulo + role antes de executar e chama services existentes (nunca Firestore direto)
3. Toda tool de delete exige `confirmed === true` (precedida por `request_confirmation`)
4. Criar uma proposta via Lia com emuladores funcionando end-to-end
5. Tentar criar transação com módulo financeiro inativo → Lia recusa sem executar

**Plans:** 4/4 plans complete
Plans:

- [x] 14-01-PLAN.md -- Service extraction: pure business logic functions from controllers for AI executor
- [x] 14-02-PLAN.md -- Tool definitions (29 FunctionDeclarations), Zod schemas, buildAvailableTools() filter
- [x] 14-03-PLAN.md -- Tool executor: executeToolCall() dispatcher with all 29 handlers calling service functions
- [x] 14-04-PLAN.md -- Chat route integration: Gemini multi-turn tool calling loop wiring

### Phase 15: Lia Frontend Chat UI

**Goal**: Users can interact with Lia through a full chat interface — opening the panel, sending messages, seeing streaming responses, reviewing tool results, and confirming or cancelling destructive actions.
**Depends on**: Phase 14
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09
**Success Criteria** (what must be TRUE):

1. User can click the floating trigger button (bottom-right) to open the LiaPanel and click again (or a close button) to slide it out with animation
2. User types a message, submits, and sees the response streamed token by token with a "Lia está digitando..." indicator during active streaming
3. User sees tool execution results in compact LiaToolResultCards that can be expanded for full details
4. User is shown a confirmation dialog before Lia executes any delete action; cancelling leaves data unchanged
5. Free plan tenants do not see the trigger button or panel; Pro/Enterprise tenants see a usage badge and chat history persists across sessions
**Plans**: 2/7 plans complete
**UI hint**: yes

### Phase 16: Lia Segurança & Billing

**Goal**: The AI chat endpoint is protected by plan and subscription checks before any stream starts, usage limits are enforced at the API boundary, and users can see their AI consumption on the billing page.
**Depends on**: Phase 14
**Requirements**: AIBI-01, AIBI-02, AIBI-03, AIBI-04, AIBI-05, AIBI-06
**Success Criteria** (what must be TRUE):

1. A free plan tenant calling the chat endpoint receives 403 before any stream begins; an inactive subscription also returns 403
2. A tenant at their monthly message limit receives 429 with a `resetAt` timestamp; the input bar in the UI is disabled and shows the reset date
3. User can view an AI usage section on the billing page showing a progress bar (messages used / limit) and the next reset date in Portuguese
4. User sees an in-app warning when their message usage reaches 80% of the monthly limit
5. Firestore rules enforce that `aiUsage` documents are read-only from client and `aiConversations` documents are accessible only to the owning user
**Plans**: TBD

### Phase 17: Lia Testes & QA

**Goal**: A dedicated E2E suite covering all 12 AI scenarios (access control, tool execution, plan limits, isolation, permissions, delete confirmation) runs automatically in CI on every PR.
**Depends on**: Phase 15, Phase 16
**Requirements**: AIQA-01, AIQA-02, AIQA-03, AIQA-04, AIQA-05, AIQA-06
**Success Criteria** (what must be TRUE):

1. E2E scenarios AI-01 to AI-03 pass: free tenant sees no trigger button; Starter badge shows correct limit (80); Pro badge shows correct limit (400)
2. E2E scenarios AI-04 to AI-07 pass: tool execution creates real data; inactive module causes Lia to refuse; plan limits surface correct messaging
3. E2E scenario AI-08 passes: tenant at message limit sees disabled input with reset date displayed
4. E2E scenarios AI-10 to AI-12 pass: cross-tenant data isolation holds; member role cannot execute admin actions; delete confirmation dialog appears and cancelling does not delete
5. Seed data creates `ai-test` pro tenant with `ai-admin@test.com` (admin) and `ai-member@test.com` (member) and all modules active; Lia smoke test job runs on every CI PR
**Plans**: TBD

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
   **Plans:** 7/7 plans complete
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17

| Phase                             | Plans Complete | Status      | Completed  |
| --------------------------------- | -------------- | ----------- | ---------- |
| 1. Test Infrastructure            | 3/3            | Complete    | 2026-04-06 |
| 2. Auth & Multi-Tenant E2E        | 2/2            | Complete    | 2026-04-06 |
| 3. Proposals & CRM E2E            | 3/3            | Complete    | 2026-04-07 |
| 4. Financial Module E2E           | 3/3            | Complete    | 2026-04-07 |
| 5. Stripe & Billing E2E           | 3/3            | Complete    | 2026-04-08 |
| 6. Performance Tests              | 2/2            | Complete    | 2026-04-08 |
| 7. Security Tests                 | 2/2            | Complete    | 2026-04-08 |
| 8. Contacts & Products CRUD E2E   | 2/2            | Complete    | 2026-04-09 |
| 9. Auth Registration E2E          | 1/1            | Complete    | 2026-04-09 |
| 10. Financial Gaps E2E            | 1/2            | In Progress | -          |
| 11. Performance Expansion         | 0/1            | Not started | -          |
| 12. Lia — Arquitetura & Pesquisa  | 1/1            | Complete    | 2026-04-13 |
| 13. Lia — Backend Core            | 3/3            | Complete    | 2026-04-13 |
| 14. Lia — Tool System             | 4/4            | Complete    | 2026-04-14 |
| 15. Lia Frontend Chat UI          | 7/7 | Complete   | 2026-04-14 |
| 16. Lia Segurança & Billing       | 0/?            | Not started | -          |
| 17. Lia Testes & QA               | 0/?            | Not started | -          |
