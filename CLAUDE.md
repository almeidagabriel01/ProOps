# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProOps is a multi-tenant SaaS business management platform (proposals, CRM, finances, team, integrations). Stack: Next.js 16 (App Router) frontend + Firebase Cloud Functions (Express) backend, with Firestore as the database and Firebase Auth.

## Commands

### Frontend (root)
```bash
npm run dev           # Next.js dev server
npm run build         # Production build (standalone output)
npm run lint          # ESLint
```

### Backend (Firebase Functions)
```bash
npm run dev:backend           # Concurrently: functions watch + Firebase emulators
cd functions && npm run build # Compile TypeScript to functions/lib/
cd functions && npm run lint  # ESLint for functions
```

### Deploy
```bash
npm run deploy:dev    # Deploy to dev Firebase project
npm run deploy:prod   # Deploy to prod Firebase project
```

### Firebase Emulators
```bash
firebase emulators:start  # All emulators (Functions:5001, Firestore:8080, Auth:9099, Storage:9199, UI:4000)
```

### Security & Maintenance
```bash
npm run security:scan                    # Audit both frontend and functions
npm run security:claims:backfill         # Backfill Firebase custom claims
npm run security:claims:validate         # Validate custom claims
```

## Architecture

### Split-Backend Pattern (Critical)
- **Frontend** (`src/`): Next.js App Router on Vercel. Only uses `NEXT_PUBLIC_*` env vars (public Firebase config). Communicates with backend exclusively through `/api/backend/*` proxy routes.
- **Backend** (`functions/`): Firebase Cloud Functions V2 running Express on Cloud Run (`southamerica-east1`). Holds all sensitive secrets (`STRIPE_SECRET_KEY`, `WHATSAPP_APP_SECRET`, etc.) in `functions/.env`. Never expose these to the frontend.

### Multi-Tenant Model
- Every Firestore document has a `tenantId` field.
- Firebase Auth tokens carry custom claims: `tenantId`, `role`, `masterId` for fast authorization.
- Firestore security rules enforce tenant isolation with DENY-by-default policy.
- Stale-claims fallback: API middleware falls back to user document if custom claims are stale.

### Authentication Flow
1. Firebase Auth issues ID tokens (email/password)
2. Next.js middleware reads `__session` cookie for SSR route protection (`middleware.ts`)
3. Backend Express middleware validates ID tokens + custom claims on every request
4. Firestore rules provide a final enforcement layer

### Backend API Structure (`functions/src/api/`)
- **Single Express monolith** registered as one Cloud Function (`/api`)
- `controllers/` — ~25 CRUD controllers
- `routes/` — 13 route groups: `core`, `finance`, `stripe`, `admin`, `auxiliary`, `internal`, `notifications`, `whatsapp`, `kanban`, `calendar`, `validation`, `sharedProposals`, `sharedTransactions`
- `middleware/` — auth verification, PDF rate limiting
- `services/` — PDF generation (Playwright/Chromium), WhatsApp, notifications

### Frontend Structure (`src/`)
- `app/` — Next.js App Router pages (25+ route segments)
- `components/` — UI components (Radix UI primitives + shadcn/ui patterns)
- `providers/` — React context: Auth, Theme, Tenant, Permissions
- `services/` — Client-side API calls to `/api/backend/*`
- `hooks/` — Custom data-fetching and state hooks
- `lib/` — Firebase init, auth helpers, plan limits, niche config
- `types/` — TypeScript interfaces
- `utils/` — Formatting utilities

### Key Integrations
- **Stripe**: Webhook at `/stripe/stripeWebhook` (signature-verified). Manages subscriptions, plan enforcement, and WhatsApp overage billing.
- **WhatsApp**: Webhook at `/webhooks/whatsapp`. Verify token from `WHATSAPP_VERIFY_TOKEN`. Overage billing cron runs on the 1st of each month at 03:00 AM (`reportWhatsappOverage`). Manual debug: `POST /internal/cron/whatsapp-overage-report` (requires `x-cron-secret` header).
- **PDF Generation**: Server-side via Playwright + Chromium headless. Rate-limited endpoints. Shared/public proposals have dedicated routes.
- **Google Calendar**: Via `googleapis`.

### Multi-Niche Support
The system supports multiple business niches (`automacao_residencial`, `cortinas`). Niche-specific logic lives in `src/lib/niches/` and affects product configurations, PDF templates, and conditional UI rendering (`tenantNiche` field on tenant documents).

## Environment Setup

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

**Backend** (`functions/.env`):
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
CRON_SECRET=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

Firebase projects: `erp-softcode` (dev), `erp-softcode-prod` (prod). Configured in `.firebaserc`.

## Important Constraints

- Never commit real secrets. Use `.env.example` / `functions/.env.example` with placeholders only.
- All financial and critical operations must be handled server-side in Cloud Functions, never in the Next.js frontend.
- Frontend must only communicate with sensitive operations through the `/api/backend/*` proxy, never directly calling Cloud Functions URLs.
- Firestore rules are DENY-by-default — all new collections need explicit rules.
- Functions compile TypeScript to CommonJS in `functions/lib/`. Always run `npm run build` in `functions/` before deploying or running emulators.

## Stack Versions

- Next.js: 16.1.6
- React: 19.2.1
- TypeScript: 5.x
- Firebase (client): 12.6.0
- Firebase Admin: 12.7.0
- Tailwind CSS: v4 (configured via CSS, no `tailwind.config.ts`)
- Stripe SDK: 20.0.0
- Node.js target: 20

## Repository Structure

```
/
├── src/
│   ├── app/              # Next.js App Router — 25+ route segments
│   │   ├── api/          # Next.js Route Handlers (proxy to Cloud Functions)
│   │   │   └── backend/  # Proxy: forwards to Cloud Functions Express
│   │   └── [routes]/     # proposals, contacts, products, transactions, etc.
│   ├── components/       # React components
│   │   ├── ui/           # Shadcn/ui (Radix primitives) — DO NOT edit manually
│   │   ├── admin/        # Admin panel components
│   │   ├── auth/         # Auth flow components
│   │   ├── pdf/          # PDF display components
│   │   ├── shared/       # Truly generic components
│   │   └── [domain]/     # Domain-specific component groups
│   ├── hooks/            # Custom React hooks (data fetching + UI)
│   ├── lib/              # Firebase init, helpers, niche config, plan limits
│   │   └── niches/       # Multi-niche logic (automacao_residencial | cortinas)
│   ├── providers/        # React context: Auth, Theme, Tenant, Permissions
│   ├── services/         # Client-side API calls → /api/backend/*
│   ├── types/            # TypeScript interfaces (domain, API, Firebase)
│   └── utils/            # Formatting utilities
├── functions/            # Firebase Cloud Functions V2 (Express monolith)
│   └── src/
│       ├── api/
│       │   ├── controllers/  # ~20 CRUD controllers
│       │   ├── routes/       # 13 route groups
│       │   ├── middleware/   # Auth verification, rate limiting
│       │   └── services/     # PDF (Playwright), WhatsApp, notifications
│       ├── lib/              # Admin helpers, auth context, billing helpers
│       └── shared/           # Shared types between controllers
├── .claude/              # Claude Code configuration
│   ├── agents/           # frontend.md, backend.md, full-stack.md
│   ├── commands/         # /deploy-check, /new-feature, /debug, /document-api
│   └── skills/           # new-component, new-api-route, new-firebase-query, review-security
├── firestore.rules       # Firestore security rules
├── firestore.indexes.json
└── storage.rules
```

## Claude Code Agents

- `@frontend` — Next.js components, UI, hooks, providers, routes (`src/app/`, `src/components/`, `src/hooks/`, `src/providers/`)
- `@backend` — Cloud Functions, API routes, Firestore, Auth, Stripe, WhatsApp (`functions/src/`, `src/app/api/`, `src/services/`, `src/lib/`, `src/types/`)
- `@full-stack` — Features that span both layers, cross-cutting refactors, bug investigation

## Claude Code Commands

- `/deploy-check` — pre-deploy checklist (lint, TypeScript, security, Firestore impact, billing impact)
- `/new-feature` — guided feature implementation (types → backend → service → hook → UI)
- `/debug` — systematic bug investigation across all layers
- `/document-api` — generate API documentation for a route or controller

## Claude Code Skills

- `/new-component` — create React component following project patterns
- `/new-api-route` — create Cloud Function route or Next.js Route Handler
- `/new-firebase-query` — create typed Firestore query with tenant isolation
- `/review-security` — security checklist for features, endpoints, rules
