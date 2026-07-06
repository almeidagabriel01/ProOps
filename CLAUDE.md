# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit & PR Rules

- **Never** include `Co-Authored-By` or any attribution to Claude/Anthropic in commit messages.
- Every commit is authored by the repository's **current git user** (the developer's own configured `user.name` / `user.email`). Do **not** override the author with `--author` or any hardcoded name/email. No co-author lines.
- **Commit after each task completes** — one logical commit per completed task.
- **Never run `git push`** — the user pushes manually.
- **Never merge to `main`** — only the user does that.
- **PRs are only created targeting `develop`**, never `main`. The user is the sole author of PRs to `main`.

## Documentation Maintenance (`.claude/` and `CLAUDE.md` files)

- When a change you make to the project renders any `CLAUDE.md` or `.claude/` doc stale (stack versions, folder structure, routes, integrations, commands, agents, rules, env vars), **update that doc in the same task**, as part of the same logical change.
- Only do this as a side effect of a change the user asked for. **Never** edit docs proactively or rewrite content the user did not ask you to touch — fix only what your change made inaccurate.
- This rule does not apply to vendored/installed tooling: `.claude/gsd-*`, `.claude/get-shit-done/`, `.claude/skills/` (installed plugins), and stale copies under `.worktrees/`. Leave those alone.

## Bug Fix Policy

Every confirmed bug fix **must** include automated test coverage for the exact failing scenario and the closest reasonable variants, committed in the same PR as the fix. The test must fail without the fix and pass with it.

Choose the layer that best isolates the regression:

- **Pure functions / helpers**: Vitest unit test in `apps/web/src/**/__tests__/*.test.ts` (or Jest in `apps/functions/src/**/*.test.ts`)
- **Firestore security rules**: `@firebase/rules-unit-testing` test in `tests/firestore-rules/*.test.ts`
- **User-facing flows** (auth, redirects, guards, UI permissions): Playwright E2E in `tests/e2e/**/*.spec.ts`
- **API / backend handlers**: Jest test in `apps/functions/`

Coverage requirement: include the exact reported scenario **plus** variants that exercise the same code path with different role/permission/subscription combinations. A bug found on a free user almost always implies tests for paying/superadmin/blocked variants as well.

Run `npm run test:web` for unit tests, `npm run test:rules` for Firestore rules, `npm run test:e2e` for the full E2E suite.

---

## Project Overview

ProOps is a multi-tenant SaaS platform (proposals, CRM, finances, team, integrations).
Stack: Next.js 16 (App Router) + Firebase Cloud Functions V2 (Express), Firestore, Firebase Auth.
Region: `southamerica-east1`. Firebase projects: `erp-softcode` (dev), `erp-softcode-prod` (prod).

## Commands

### Frontend (`apps/web/`)
```bash
npm run dev           # Next.js dev server
npm run build         # Production build (standalone)
npm run lint          # ESLint
```

### Backend (`apps/functions/`)
```bash
npm run dev:backend                    # Functions watch + Firebase emulators
cd apps/functions && npm run build     # Compile TypeScript → apps/functions/lib/
cd apps/functions && npm run lint
```

### Deploy
```bash
npm run deploy:dev    # → erp-softcode (dev)
npm run deploy:prod   # → erp-softcode-prod (prod)
```

### Testing
```bash
firebase emulators:start               # Ports: 5001/8080/9099/9199, UI:4000
npm run test:e2e                       # Playwright E2E (requires emulators)
npm run test:rules                     # Firestore security rules (Jest)
npm run security:scan                  # OWASP ZAP baseline
```

## Architecture

### Split-Backend Pattern
- **Frontend** (`apps/web/src/`): Next.js on Vercel. Only `NEXT_PUBLIC_*` env vars. Calls backend via `/api/backend/*` proxy — never direct Cloud Functions URLs.
- **Backend** (`apps/functions/`): Express monolith on Cloud Run. Holds all secrets. Never expose to frontend.

### Multi-Tenant Model
- Every Firestore document has `tenantId`. Firebase Auth custom claims: `tenantId`, `role`, `masterId`.
- Firestore rules are DENY-by-default. Stale-claims fallback reads `users/{uid}`.

### Key Integrations
- **Stripe** — subscriptions, plan enforcement, overage billing. Webhook: `/stripe/stripeWebhook`
- **WhatsApp** — webhooks, monthly overage cron (1st of month, 03:00 AM BRT). Webhook: `/webhooks/whatsapp`
- **Asaas** — payment processing (PIX/boleto/card) for shared-transaction payments. Webhook: `/webhooks/asaas/:tenantId`; public payment API mounted at `/v1`. (Replaced the former MercadoPago webhook.)
- **AI/Lia** — Google Gemini + Groq. Module: `apps/functions/src/ai/`. Rate-limited per user.
- **PDF** — Playwright/Chromium headless, rate-limited (5 req/60s per user)
- **Google Calendar** — via `@googleapis/calendar` + `@googleapis/oauth2` (lazy-loaded)
- **Zoom** — video meeting creation for demo bookings. Module: `apps/functions/src/services/zoom/`

### Multi-Niche Support
Niches: `automacao_residencial` | `cortinas`. Logic in `apps/web/src/lib/niches/`. Uses `tenantNiche` on tenant documents.

## Stack Versions

| Package | Version |
|---|---|
| Next.js | 16.1.6 |
| React | 19.2.1 |
| TypeScript | 5.x |
| Firebase (client) | 12.6.0 |
| Firebase Admin | 13.6.1 (functions) · 12.7.0 (web server routes) |
| Tailwind CSS | v4 (via CSS, no tailwind.config.ts) |
| Stripe SDK | 20.0.0 (web) · 17.0.0 (functions) |
| Node.js | 22 |

## Repository Structure

```
/
├── apps/
│   ├── web/          # Next.js frontend (proops-web workspace member)
│   │   └── src/
│   │       ├── app/          # App Router (30+ segments) + api/backend/ proxy
│   │       ├── components/   # ui/(Shadcn), admin, auth, lia, features, shared...
│   │       ├── hooks/        # Data-fetching + UI hooks (32, + proposal/ subfolder)
│   │       ├── providers/    # Auth, Tenant, Permissions, Theme, Plan
│   │       ├── services/     # Client-side API calls → /api/backend/* (32)
│   │       ├── lib/          # Firebase init, niches/, plan limits
│   │       └── types/        # TypeScript interfaces
│   └── functions/    # Firebase Cloud Functions V2 (Express monolith)
│       └── src/
│           ├── api/          # controllers/(36), routes/(24), middleware/, services/, security/
│           ├── ai/           # Lia AI module (Gemini, Groq, rate limiter, tools)
│           ├── billing/      # Billing queue, price-drift reconciliation
│           ├── services/     # Email (Resend), Zoom, WhatsApp billing
│           ├── stripe/       # Stripe config + webhook handling
│           ├── lib/          # Admin helpers, logger, security-observability
│           └── shared/       # Shared types
├── tests/
│   ├── e2e/              # Playwright E2E + ZAP security
│   └── firestore-rules/  # Jest security rules tests
├── firebase/             # firestore.rules, indexes, storage.rules
└── .claude/              # agents/, commands/, rules/
```

## Claude Code Agents
- `@frontend` — components, pages, hooks, providers, styles
- `@backend` — Cloud Functions, Firestore, Auth, Stripe, WhatsApp, AI module
- `@full-stack` — cross-layer features, bug investigation

## Claude Code Commands
- `/deploy-check` — pre-deploy checklist
- `/new-feature` — guided feature implementation (types → backend → service → hook → UI)
- `/debug` — systematic bug investigation
- `/document-api` — API documentation for a route or controller

## Observability
- **Frontend**: Vercel Analytics, Speed Insights. Client errors are captured by error boundaries and reported to the backend observability endpoint (see error observability module).
- **Backend**: structured logger (`logger.ts`, JSON + `severity` for GCP Cloud Logging), security audit events in Firestore, and the error observability pipeline (grouped error issues in Firestore, surfaced in the superadmin dashboard). No third-party error-monitoring SaaS (no Sentry).

## Module Docs
Detailed documentation per module lives in CLAUDE.md files within each folder:
- Financial module (frontend): `apps/web/src/app/transactions/CLAUDE.md`
- Financial module (backend): `apps/functions/CLAUDE.md`
- Backend services: `apps/functions/src/api/services/CLAUDE.md`
- Backend middleware: `apps/functions/src/api/middleware/CLAUDE.md`
- CI/CD, GitHub Secrets, workflows: `.claude/rules/ci-cd.md`
