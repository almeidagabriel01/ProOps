# Codebase Concerns

**Analysis Date:** 2026-05-04

## Tech Debt

**Monorepo Migration Incomplete:**
- Issue: Migration to npm workspaces is partially done (PR 0+1 merged in develop). PR 2 (functions→apps/functions) completed, but PRs 3 (tests move) and PR 4 (CI workflow updates) not yet executed.
- Files: `package.json` (workspaces config), `.firebaserc`, `firebase.json`, root-level test configs
- Impact: CI workflows still reference old `functions/` paths; E2E and Firestore rules tests still at root level instead of `tests/`; Firebase emulator builds against outdated paths; deployment may fail if CI paths incorrect
- Fix approach: Execute PR 3 (move `e2e/` → `tests/e2e/`, `jest.config.js` → `tests/firestore-rules/jest.config.js`, update all path references in configs) then PR 4 (update all 6 GitHub Actions workflows with new path structure). See `/memory/project_monorepo_migration.md` for detailed steps.

**Build Artifact at Root:**
- Issue: `.next/` directory exists at root (`/d/DEV/ProOps/.next/`) instead of in `apps/web/.next/` after monorepo move
- Files: `.next/` (entire directory), `.gitignore` (gitignore rules)
- Impact: Build outputs in wrong location; may cause CI confusion or incorrect caching; Vercel Root Directory must be set to `apps/web` before deploying
- Fix approach: Delete `/d/DEV/ProOps/.next/` locally and in builds; ensure `.gitignore` ignores both `/.next/` (root) and `apps/web/.next/` (workspace); update Vercel dashboard to set Root Directory to `apps/web/` before next push to main/develop.

**Node.js Version Constraint Mismatch:**
- Issue: `package.json` specifies `"engines": {"node": "20"}` but CLAUDE.md and deployment config target Node.js 22 for Cloud Functions
- Files: `package.json` (line 8), `apps/functions/src/deploymentConfig.ts`, `CLAUDE.md` (root, functions section)
- Impact: Local development may run on Node 20 while production runs on Node 22; potential runtime incompatibilities if ES features differ
- Fix approach: Update `package.json` `engines.node` to `"22"` to match Cloud Functions deployment target.

## Known Bugs

**PDF Share Link Rerender Issue (Status: Fixed):**
- Symptoms: PDF displays "SUCCESS" briefly then re-renders to ERROR; share link shows only down payment, not full installment group
- Files: `apps/web/src/app/share/transaction/[token]/page.tsx`, `apps/functions/src/api/controllers/payment-public.controller.ts`
- Root cause: (1) `useSearchParams()` without Suspense boundary; (2) `waitUntil: "networkidle"` timing race with React hydration; (3) relatedTransactions query only matched one side of transaction group
- Status: Fixed in commit 1c5023b7; added `installmentGroupId` to down payments, fixed query logic for grouped transactions
- Verification: Manual smoke test required on payment page with installment transactions

## Security Considerations

**Vulnerable Dependencies (High/Moderate):**
- Risk: 56 total vulnerabilities (5 low, 29 moderate, 22 high); critical packages affected: `uuid` (9+ transitive deps), `minimatch` (ReDoS in jest), `fast-xml-parser` (CDATA injection), `xlsx` (Prototype Pollution + ReDoS)
- Files: `package.json` (all workspaces), `package-lock.json`
- Current mitigation: Most vulns are transitive through Firebase Admin SDK (requires breaking upgrade), Playwright, jest, exceljs, xlsx. No direct app code uses vulnerable APIs.
- Recommendations: 
  1. Immediate: `npm audit fix` to patch non-breaking vulnerabilities (fast-xml-parser, etc.)
  2. Medium-term: Monitor Firebase Admin SDK for v13+ which should resolve `uuid` chain
  3. xlsx + minimatch: No fixes available without breaking changes; isolate xlsx to admin/report-generation features only, use as optional dependency

**Merchant Gateway Dependencies at Risk:**
- Risk: Mercado Pago SDK (`@mercadopago/sdk-js`, `@mercadopago/sdk-react`) are tight-coupled in payment flow; API contract stability depends on MP API version
- Files: `apps/functions/src/api/services/mercadopago.service.ts` (~400 lines), `apps/functions/src/api/services/transaction-payment.service.ts`, `apps/web/src/app/share/transaction/[token]/_components/payment-modal.tsx`, `apps/web/src/app/share/transaction/[token]/_components/card-payment-brick.tsx`
- Current mitigation: Payment Brick isolated to share page; fallback paths for webhook failures; `environment` field pinned (not `live_mode`)
- Recommendations: 
  1. Version-lock MP SDKs; monitor breaking changes in release notes
  2. Abstract MP SDK behind service layer (already done in `mercadopago.service.ts`)
  3. Add sandbox/production test cases to E2E suite (currently manual)

**Firestore Security Rules — DENY-by-default:**
- Risk: Any new collection without explicit rules is implicitly DENY. Silent failures if rules not deployed with feature.
- Files: `firebase/firestore.rules`, `apps/functions/src/api/controllers/` (all controllers), `tests/firestore-rules/`
- Current mitigation: Security rules test suite in `tests/firestore-rules/`; PR checklist requires rules review
- Recommendations: Enforce rules test before deploying new collections; add CI gate to require rules coverage (no untested collections)

## Performance Bottlenecks

**Large Monolithic Express Backend (~34,705 lines):**
- Problem: All 13 route groups and ~25 controllers in single `apps/functions/src/api/` directory; single Cloud Function instance serves all traffic; no separation of concerns at deployment level
- Files: `apps/functions/src/api/controllers/` (20+ files), `apps/functions/src/api/routes/` (13 groups), `apps/functions/src/api/index.ts` (single entry point)
- Cause: Greenfield startup pattern; monolith premature before feature/traffic split justifies splitting
- Improvement path: 
  1. Short-term: Optimize hot paths (transaction queries, PDF generation, WhatsApp messaging); add Redis caching for wallet balances if < 2s P95 latency critical
  2. Medium-term: Split by billing domain if WhatsApp/Stripe/PDF generating > 30% overhead
  3. Long-term: Separate Cloud Functions by feature (functions-transactions, functions-billing, functions-core) with shared admin libraries

**PDF Generation with Playwright (Headless Chromium):**
- Problem: Server-side PDF rendering via Playwright requires spawning browser process; rate-limited to 5 req/60s per user; cold start latency high on low-traffic instances
- Files: `apps/functions/src/api/services/pdf-generation.service.ts`, `apps/functions/src/api/middleware/pdf-rate-limit.middleware.ts`
- Cause: Chromium is memory-intensive (each instance ~200MB); Cloud Run instances limited to 2GB default
- Improvement path:
  1. Validate PDF rate limit is tuned for production traffic (currently 5 req/60s)
  2. Async PDF generation with queue (Pub/Sub topic) if async acceptable
  3. Consider headless browser API (e.g., Browserless) if scale requires on-demand PDF generation > 50 req/hour

**Multi-Niche Configuration Logic:**
- Problem: Niche-specific logic scattered across UI components and backend; `tenantNiche` field on tenant documents drives conditional rendering and business rules
- Files: `apps/web/src/lib/niches/`, `apps/web/src/components/` (multiple conditional renders on `useCurrentNicheConfig()`), `apps/functions/src/api/services/` (niche-specific pricing/validation)
- Cause: Early feature request for white-label support; not refactored post-MVP
- Improvement path: Centralize niche rules in `useCurrentNicheConfig()` hook; never hardcode niche strings in component logic; document supported niches in STRUCTURE.md

## Fragile Areas

**Transaction & Wallet Balance Consistency:**
- Files: `apps/functions/src/api/services/transaction.service.ts` (~1350 lines), `apps/functions/src/lib/finance-helpers.ts`, `apps/web/src/app/transactions/_hooks/useFinancialData.ts` (~1500+ lines), `apps/functions/src/api/controllers/wallets.controller.ts`
- Why fragile: Wallet balances are denormalized (stored in `balance` field, not calculated); every transaction status change must atomically update parent + child transactions + wallet impacts within `db.runTransaction()`. Multiple paths can affect balance (income/expense toggle, installment payment, manual adjustment), each with different impact formulas. Optimistic updates in frontend must match backend logic exactly.
- Safe modification: 
  1. Never update wallet balance outside `db.runTransaction()`
  2. Test all balance-affecting operations locally with emulator before deploying
  3. When adding new transaction type, validate `getWalletImpacts()` logic in both frontend (`useFinancialData.ts`) and backend (`transaction.service.ts`)
  4. Backup plan: Firestore can re-sync balances via admin script if inconsistency detected
- Test coverage: Unit tests for `transaction.service.ts` exist in Phase 4; E2E tests in `tests/e2e/financial/`. Recommend: add invariant checks on balance updates to catch bugs immediately.

**Wallet ID vs NAME Migration (Incomplete Legacy Support):**
- Files: `apps/functions/src/lib/finance-helpers.ts` (resolveWalletRef), `apps/web/src/app/transactions/_hooks/useEditTransaction.ts`, `apps/web/src/app/transactions/_components/transaction-card.tsx` (~1300+ lines), `apps/web/src/components/features/wallet-select.tsx`
- Why fragile: Migration from wallet.name → wallet.id completed in April 2025 but backend must support both formats indefinitely. Any new wallet resolution code must check `w.id === val || w.name === val`. Display logic scattered across transaction-card.tsx with multiple wallet lookups. Form population in useEditTransaction uses `resolveWalletId()` helper but edge cases possible if wallet deleted after transaction created.
- Safe modification: Always use pattern `wallets.find(w => w.id === tx.wallet || w.name === tx.wallet)?.name ?? tx.wallet` for display; never assume `tx.wallet` is always ID. When rendering forms, use `resolveWalletId()` from useEditTransaction.ts. Test with mix of old (NAME-only) and new (ID) transactions.
- Test coverage: Manual testing required for legacy data; E2E doesn't cover old-format transactions. Recommend: seed test data with both formats.

**Session History Race Condition in Lia AI Chat:**
- Files: `apps/web/src/app/actions/lia-session.ts`, `apps/web/src/components/lia/use-ai-chat.ts`, `apps/web/src/components/lia/lia-panel.tsx`
- Why fragile: Lia session ID generated on first mount but localStorage restore is async. If `tenantId` is null during hydration, `useState(generateSessionId)` generates new ID instead of restoring. Subsequently persisting that ID overwrites previous session history.
- Safe modification: Always check `tenantId` is defined before mounting LiaPanel. useAiChat uses deferred restoration with `useEffect` + `isRestoredRef` to prevent race.
- Test coverage: Fixed in Phase 18 (BUG-2); manual test required on first page load after logout/login cycle.

**Stripe & Webhook Verification:**
- Files: `apps/functions/src/api/routes/stripe.routes.ts`, `apps/functions/src/api/controllers/stripe.controller.ts` (~500 lines), `apps/web/src/services/stripe-service.ts`
- Why fragile: Webhook processing is critical for subscription state; signature verification happens via `stripe.webhooks.constructEvent()`. If secret changes or request comes unsigned, webhook silently fails. Subscription state can drift if webhook is missed.
- Safe modification: All webhook handlers must log signature verification failures to error handler. Validate `stripe_signature` header present. Never skip signature validation for testing — use Stripe CLI for local testing.
- Test coverage: Phase 5 (Stripe & Billing E2E) covers webhook flows. Recommend: add background job to reconcile subscription state on diff (weekly cron).

## Scaling Limits

**In-Memory Rate Limiting for PDF:**
- Current capacity: 5 requests per 60 seconds per user; tracked in-memory on Cloud Run instance
- Limit: If traffic spikes across multiple instances, rate limit is per-instance not global. Two instances can each serve 5 req/60s = 10 total, not 5 globally.
- Scaling path: Migrate to Cloud Firestore or Redis-backed rate limiter if PDF endpoints become bottleneck (> 100 concurrent PDF requests/min)

**Firestore Read/Write Quota:**
- Current capacity: Standard Spark plan (pay-as-you-go); no quota enforcement configured
- Limit: ~100k reads/day free; billing kicks in after. Daily transactions export + nightly reports can consume quota quickly during month-end processing
- Scaling path: Monitor GCP billing daily; consider Blaze plan commitments if daily read cost > $10/day

**Cloud Run Memory per Instance:**
- Current capacity: Default 512MB or 2GB (check `apps/functions/src/deploymentConfig.ts`)
- Limit: PDF rendering + streaming can spike memory; OOMKill if > limit
- Scaling path: Increase instance memory to 4GB if PDF generation fails with OOMKill; consider async PDF generation via Pub/Sub if bursty traffic

## Dependencies at Risk

**xlsx (SheetJS) — No Fix Available:**
- Risk: High-severity Prototype Pollution + ReDoS vulnerabilities (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9); no patched version available
- Impact: If transaction export feature uses xlsx to generate Excel, malicious input could inject prototype pollution or DOS via regex
- Migration plan: 
  1. Short-term: Restrict xlsx usage to admin-only features; validate input (no untrusted field names in export)
  2. Medium-term: Replace with `exceljs` (fewer vulns) or server-side PDF export instead of Excel
  3. Audit: Search codebase for xlsx usage in `apps/functions/` and `apps/web/src/services/`

**Minimatch ReDoS in jest:**
- Risk: High-severity Regular Expression Denial of Service in glob pattern matching
- Impact: CI test runs could be DOS'd by malicious test file names or paths
- Migration plan: This is transitive via jest > glob. `npm audit fix --force` requires Jest 30.2.0 (from current 30.3.0), breaking change. Monitor Jest changelog for patch version fix without breaking change. For now, keep override in `package.json`: `"overrides": {"minimatch": "10.2.1"}` (already present, good).

**firebase-admin Transitive Vulnerabilities:**
- Risk: firebase-admin@12.7.0 depends on vulnerable @google-cloud/* packages which depend on vulnerable uuid and teeny-request
- Impact: No direct attack surface (these are backend infrastructure libraries), but supply chain risk
- Migration plan: Wait for firebase-admin v13+ which should update Google Cloud dependencies. Monitor Firebase release notes.

## Missing Critical Features

**E2E Test Coverage Gaps:**
- Problem: Phases 1-7 of testing roadmap implemented (Auth, multi-tenancy, performance, security); Phases 3-4 (Proposals CRUD, Financial E2E) still marked incomplete in ROADMAP.md
- Blocks: Cannot confidently refactor proposal or transaction logic without E2E regression tests
- Solution: Roadmap planned; prioritize Phase 3 (Proposals & CRM E2E) and Phase 4 (Financial Module E2E)

**Performance Baseline Regression Detection for Non-Dashboard Pages:**
- Problem: Phase 6 (Performance Tests) only covers login, dashboard, proposals, transactions; contacts, products, CRM, calendar, team pages missing baseline thresholds
- Blocks: Cannot detect regressions on secondary pages; Phase 11 (Performance Expansion) planned but not executed
- Solution: Use Phase 11 plan to add Core Web Vitals thresholds to all data-heavy pages

**Contacts CRUD E2E Tests:**
- Problem: Contacts collection has no E2E test coverage (Phase 3 in roadmap)
- Blocks: Contact list/search/edit changes could break undetected
- Solution: Scheduled for Phase 3; medium priority behind financial module

**GCP Monitoring for Production:**
- Problem: GCP Cloud Monitoring configured for dev (erp-softcode) but production (erp-softcode-prod) NOT configured
- Blocks: No alerts on production outages, 5xx errors, or latency spikes
- Solution: Run `gcloud config set project erp-softcode-prod && bash scripts/setup-gcp-monitoring.sh erp-softcode-prod gestao@proops.com.br` (script exists; user must execute)

## Test Coverage Gaps

**Firestore Rules Coverage:**
- What's not tested: Admin bypass (users with `isSuperAdmin=true`); edge cases in `proposalGroupId` vs `installmentGroupId` matching; budget limits enforcement
- Files: `tests/firestore-rules/`, `firebase/firestore.rules`
- Risk: Rule bugs could expose data between tenants or allow unauthorized writes
- Priority: High — security-critical. Recommend: add rules for all new collections before deploy; test both allow and deny paths.

**API Route Handler Isolation:**
- What's not tested: Ensure Route Handlers in `apps/web/src/app/api/backend/*` properly isolate requests by tenantId (header injection, token manipulation)
- Files: `apps/web/src/app/api/backend/` (proxy routes), `apps/functions/src/api/index.ts` (backend validation)
- Risk: If proxy layer misconfigured, a user could request another tenant's data
- Priority: Medium — test via Phase 2 (AUTH-06, already covered) but recommend explicit tests for header manipulation

**Mercado Pago Sandbox Integration:**
- What's not tested: Full payment flow with Payment Brick (new in April 2026); iframe tokenization, error handling, invalid_users error (code 106)
- Files: `apps/web/src/app/share/transaction/[token]/_components/card-payment-brick.tsx`, `tests/e2e/billing/mercadopago.spec.ts`
- Risk: Payment flow failures in production if sandbox behavior differs from live
- Priority: High — financial-critical. Recommend: add E2E test for MP Payment Brick with test credit cards + valid test emails (non-@testuser.com)

**WhatsApp Overage Billing Cron:**
- What's not tested: `reportWhatsappOverage` cron job runs on 1st of month at 03:00 AM; manual test endpoint exists but E2E not automated
- Files: `apps/functions/src/reportWhatsappOverage.ts`, `tests/e2e/billing/whatsapp-overage.spec.ts`
- Risk: Overage billing could fail silently; tenants not charged or double-charged
- Priority: High — billing-critical. Recommend: add E2E test that advances Firebase emulator clock to 1st of month, triggers cron, validates charges.

---

*Concerns audit: 2026-05-04*
