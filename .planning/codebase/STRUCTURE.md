# Codebase Structure

**Analysis Date:** 2026-05-04

## Directory Layout

```
ProOps/
├── apps/
│   ├── web/                          # Next.js 16 frontend (Vercel deployment)
│   │   ├── src/
│   │   │   ├── app/                  # Next.js App Router (54+ pages)
│   │   │   │   ├── (auth)/           # Auth route group: login, register, forgot-password
│   │   │   │   ├── (admin)/          # Admin route group
│   │   │   │   ├── dashboard/        # Main dashboard page
│   │   │   │   ├── proposals/        # Proposals CRUD + list + detail pages
│   │   │   │   ├── transactions/     # Transactions (financial) CRUD + list
│   │   │   │   ├── wallets/          # Wallet management pages
│   │   │   │   ├── contacts/         # Clients/contacts CRUD
│   │   │   │   ├── products/         # Products CRUD
│   │   │   │   ├── team/             # Team management
│   │   │   │   ├── settings/         # Tenant settings
│   │   │   │   ├── calendar/         # Google Calendar integration
│   │   │   │   ├── crm/              # CRM/pipeline pages
│   │   │   │   ├── kanban/           # Kanban board
│   │   │   │   ├── api/              # Next.js Route Handlers
│   │   │   │   │   ├── backend/[...path]/ # Proxy: forwards to Cloud Functions
│   │   │   │   │   ├── auth/         # Firebase Auth endpoints
│   │   │   │   │   ├── admin/        # Admin-only endpoints
│   │   │   │   │   └── ...           # Other API routes
│   │   │   │   └── [other pages]/    # 25+ additional route segments
│   │   │   ├── components/           # React components (~100 total)
│   │   │   │   ├── ui/               # Shadcn/ui (auto-generated, don't edit)
│   │   │   │   ├── shared/           # Truly generic components
│   │   │   │   ├── auth/             # Auth flow components (login, register)
│   │   │   │   ├── layout/           # Layout components (header, sidebar, footer)
│   │   │   │   ├── admin/            # Admin-only components
│   │   │   │   ├── pdf/              # PDF display components
│   │   │   │   ├── notifications/    # Notification UI
│   │   │   │   ├── [domain]/         # Domain-specific components (proposals, products, etc.)
│   │   │   │   └── ...               # 10+ other component folders
│   │   │   ├── hooks/                # React hooks (~20 total)
│   │   │   │   ├── useAuth()         # Auth state and login/logout
│   │   │   │   ├── useTenant()       # Current tenant context
│   │   │   │   ├── useProposals()    # Fetch proposals with pagination
│   │   │   │   ├── useTransactions() # Fetch transactions with filtering
│   │   │   │   └── ...               # 15+ other hooks
│   │   │   ├── lib/                  # Utilities and helpers (~30 files)
│   │   │   │   ├── firebase.ts       # Firebase SDK initialization (client)
│   │   │   │   ├── auth/             # Auth helpers
│   │   │   │   ├── api-client.ts     # HTTP client for `/api/backend/*`
│   │   │   │   ├── validations/      # Zod schemas for form validation
│   │   │   │   ├── plans/            # Plan/subscription logic
│   │   │   │   ├── niches/           # Multi-niche support (automacao_residencial, cortinas)
│   │   │   │   ├── notifications/    # Notification helpers
│   │   │   │   └── ...               # Server-side helpers, formatters, etc.
│   │   │   ├── providers/            # React Contexts
│   │   │   │   ├── auth-provider.tsx       # Auth state (user, login, logout, session)
│   │   │   │   ├── tenant-provider.tsx     # Current tenant context
│   │   │   │   ├── permissions-provider.tsx # User permissions/role
│   │   │   │   ├── plan-provider.tsx       # Subscription status
│   │   │   │   └── theme-provider.tsx      # Dark/light theme
│   │   │   ├── services/             # Client-side API layer (25+ services)
│   │   │   │   ├── proposal-service.ts      # Proposals CRUD
│   │   │   │   ├── transaction-service.ts   # Transactions CRUD
│   │   │   │   ├── wallet-service.ts        # Wallets CRUD
│   │   │   │   ├── product-service.ts       # Products CRUD
│   │   │   │   ├── client-service.ts        # Clients/contacts CRUD
│   │   │   │   ├── plan-service.ts          # Plan/subscription queries
│   │   │   │   ├── stripe-service.ts        # Stripe portal, pricing
│   │   │   │   ├── notification-service.ts  # Notification queries
│   │   │   │   ├── storage-service.ts       # Firebase Storage upload/download
│   │   │   │   ├── pdf/                     # PDF generation and display
│   │   │   │   └── ...                      # 15+ more services
│   │   │   ├── types/                # TypeScript type definitions
│   │   │   │   ├── proposal.ts       # Proposal types
│   │   │   │   ├── transaction.ts    # Transaction and wallet types
│   │   │   │   ├── plan.ts           # Subscription types
│   │   │   │   ├── index.ts          # Exported types (User, Tenant, etc.)
│   │   │   │   └── ...               # Other domain types
│   │   │   └── utils/                # Formatting and calculation utilities
│   │   ├── public/                   # Static assets (images, fonts, icons)
│   │   ├── middleware.ts             # Next.js middleware (route protection via __session cookie)
│   │   ├── next.config.ts            # Next.js config
│   │   ├── tsconfig.json             # TypeScript config (includes @ alias)
│   │   └── package.json              # Frontend dependencies
│   │
│   └── functions/                    # Firebase Cloud Functions backend (Cloud Run deployment)
│       ├── src/
│       │   ├── api/                  # Express monolith (single Cloud Function)
│       │   │   ├── index.ts          # Express app initialization
│       │   │   ├── controllers/      # ~28 controllers (CRUD handlers)
│       │   │   │   ├── proposals.controller.ts
│       │   │   │   ├── transactions.controller.ts
│       │   │   │   ├── wallets.controller.ts
│       │   │   │   ├── products.controller.ts
│       │   │   │   ├── clients.controller.ts
│       │   │   │   ├── stripe.controller.ts
│       │   │   │   ├── whatsapp.controller.ts
│       │   │   │   ├── shared-proposals.controller.ts
│       │   │   │   ├── admin.controller.ts
│       │   │   │   └── ... (20+ more)
│       │   │   ├── routes/           # 15 route groups
│       │   │   │   ├── core.routes.ts          # proposals, clients, products, services
│       │   │   │   ├── finance.routes.ts       # transactions, wallets
│       │   │   │   ├── stripe.routes.ts        # Stripe integration
│       │   │   │   ├── mercadopago.routes.ts   # MercadoPago integration
│       │   │   │   ├── whatsapp.routes.ts      # WhatsApp bot
│       │   │   │   ├── admin.routes.ts         # Admin operations
│       │   │   │   ├── internal.routes.ts      # Internal APIs
│       │   │   │   ├── notifications.routes.ts
│       │   │   │   ├── calendar.routes.ts
│       │   │   │   ├── kanban.routes.ts
│       │   │   │   ├── shared-proposals.routes.ts
│       │   │   │   ├── shared-transactions.routes.ts
│       │   │   │   └── ... (5+ more)
│       │   │   ├── middleware/       # Express middleware
│       │   │   │   ├── auth.ts                 # Firebase ID token validation + custom claims
│       │   │   │   ├── pdf-rate-limiter.ts    # Rate limit PDF generation (5 req/60s)
│       │   │   │   └── payment-public-rate-limiter.ts
│       │   │   ├── services/         # Business logic services
│       │   │   │   ├── transaction.service.ts  # ~1350 lines, all financial logic
│       │   │   │   ├── whatsapp/               # WhatsApp messaging and state management
│       │   │   │   ├── proposal-notification.ts
│       │   │   │   └── ... (other services)
│       │   │   ├── helpers/          # Route-specific helpers
│       │   │   ├── security/         # CORS policy, security headers
│       │   │   └── shared/           # Types shared between controllers
│       │   │
│       │   ├── lib/                  # Backend utilities and business logic
│       │   │   ├── auth-context.ts   # Auth verification and claims resolution
│       │   │   ├── auth-helpers.ts   # Firebase token utilities
│       │   │   ├── finance-helpers.ts # Financial calculations (wallet resolution, balance impacts)
│       │   │   ├── billing-helpers.ts # Stripe/MercadoPago billing logic
│       │   │   ├── logger.ts         # Structured JSON logger for GCP Cloud Logging
│       │   │   ├── security-observability.ts # Audit events, security metrics
│       │   │   ├── tenant-plan-policy.ts    # Plan limit enforcement
│       │   │   ├── storage-helpers.ts       # Firebase Storage operations
│       │   │   ├── admin-helpers.ts         # Super admin utilities
│       │   │   ├── rate-limit/              # Rate limiting factory
│       │   │   └── ... (10+ more helpers)
│       │   │
│       │   ├── services/             # Cross-cutting services
│       │   │   ├── proposal-service/  # PDF generation (Playwright + Chromium)
│       │   │   ├── whatsapp/          # WhatsApp API client + session management
│       │   │   └── ...
│       │   │
│       │   ├── shared/               # Types shared between controllers and services
│       │   │
│       │   ├── stripe/               # Stripe webhook handler
│       │   │   └── stripeWebhook.ts
│       │   │
│       │   ├── ai/                   # AI features (Claude API integration)
│       │   │
│       │   ├── checkDueDates.ts      # Cron: daily, checks transaction/proposal deadlines
│       │   ├── checkStripeSubscriptions.ts # Cron: daily, syncs Stripe subscription status
│       │   ├── checkManualSubscriptions.ts # Cron: daily, manages manual subscriptions
│       │   ├── reportWhatsappOverage.ts    # Cron: day 1 03:00 AM, billing WhatsApp overage
│       │   ├── cleanupStorageAndSharedLinks.ts # Cron: cleanup expired links
│       │   ├── index.ts              # Exports all Cloud Functions
│       │   ├── deploymentConfig.ts   # Centralized deployment config (CPU, memory, region)
│       │   └── init.ts               # Firebase Admin initialization
│       ├── lib/                      # Compiled TypeScript (CommonJS) — build output
│       ├── package.json              # Backend dependencies
│       └── tsconfig.json             # TypeScript config
│
├── tests/                            # Test suites (E2E and unit)
│   ├── e2e/                          # Playwright E2E tests (59 tests)
│   │   ├── auth/                     # Authentication flows
│   │   ├── billing/                  # Stripe/billing tests
│   │   ├── proposals/                # Proposal CRUD + workflows
│   │   ├── financial/                # Transaction and wallet tests
│   │   ├── contacts/                 # Client/contact management
│   │   ├── products/                 # Product catalog tests
│   │   ├── security/                 # OWASP ZAP security scans
│   │   ├── performance/              # Core Web Vitals + API baselines
│   │   ├── ai/                       # AI feature tests
│   │   ├── seed/                     # Test data generation
│   │   ├── fixtures/                 # Reusable test data
│   │   ├── helpers/                  # Test utility functions
│   │   └── pages/                    # Page object models (Playwright)
│   │
│   ├── firestore-rules/              # Firebase Security Rules unit tests (41 tests)
│   │   └── *.test.ts                 # Jest tests for firestore.rules
│   │
│   ├── playwright.config.ts          # E2E test runner config
│   ├── playwright.perf.config.ts     # Performance test config
│   ├── jest.config.js                # Unit test runner config
│   └── tsconfig.rules.json           # TypeScript config for rules tests
│
├── firebase/                         # Firebase configuration and rules
│   ├── firestore.rules               # Firestore security rules (DENY-by-default + tenant isolation)
│   ├── storage.rules                 # Firebase Storage rules
│   ├── firestore.indexes.json        # Composite Firestore indexes
│   └── cors.json                     # CORS configuration
│
├── .github/                          # GitHub Actions workflows
│   └── workflows/
│       ├── push-checks.yml           # Runs on every push (type-check, lint, security, E2E, Firestore rules)
│       ├── test-suite.yml            # Runs on PR to main/develop (consolidated checks)
│       ├── deploy-functions.yml      # Auto-deploys Cloud Functions on push to develop/main
│       ├── deploy-production.yml     # Production deployment workflow
│       ├── dependency-review.yml     # Checks new dependencies for vulnerabilities
│       └── stale.yml                 # Auto-closes stale issues
│
├── .claude/                          # Claude Code configuration
│   ├── agents/                       # Agent definitions
│   │   ├── frontend.md               # @frontend agent context
│   │   ├── backend.md                # @backend agent context
│   │   └── full-stack.md             # @full-stack agent context
│   ├── commands/                     # Custom commands for Claude Code
│   │   ├── /deploy-check             # Pre-deploy validation checklist
│   │   ├── /new-feature              # Guided feature implementation
│   │   ├── /debug                    # Systematic bug investigation
│   │   └── /document-api             # Generate API documentation
│   ├── rules/                        # Project guidelines
│   │   ├── backend.md                # Backend conventions and constraints
│   │   ├── frontend.md               # Frontend conventions and constraints
│   │   ├── conventions.md            # Code style, naming, file organization
│   │   ├── deployment.md             # Deployment procedures
│   │   └── security.md               # Security guidelines
│   └── skills/                       # Reusable code generation skills
│       ├── new-component/            # React component scaffolding
│       ├── new-api-route/            # Cloud Function route scaffolding
│       ├── new-firebase-query/       # Firestore query scaffolding
│       └── review-security/          # Security checklist
│
├── .planning/                        # GSD agent output (codebase maps)
│   └── codebase/
│       ├── ARCHITECTURE.md           # Layer structure, data flow, abstractions
│       ├── STRUCTURE.md              # Directory layout, file locations, conventions
│       ├── STACK.md                  # Technology stack and dependencies
│       ├── INTEGRATIONS.md           # External service integrations
│       ├── CONVENTIONS.md            # Code style and patterns
│       ├── TESTING.md                # Test structure and patterns
│       └── CONCERNS.md               # Technical debt and issues
│
├── .firebaserc                       # Firebase project config (dev: erp-softcode, prod: erp-softcode-prod)
├── firebase.json                     # Firebase deployment config
├── CLAUDE.md                         # Top-level project instructions
├── package.json                      # Monorepo root coordinator (workspaces: [apps/web])
├── package-lock.json                 # Dependency lock
├── tsconfig.json                     # Root TypeScript config
└── README.md                         # Project overview
```

## Directory Purposes

**apps/web/src/app/:**
- Purpose: Next.js App Router routes (server-side page rendering, automatic code splitting)
- Contains: Page components (`page.tsx`), layouts (`layout.tsx`), error boundaries (`error.tsx`), loading states (`loading.tsx`)
- Key files: `layout.tsx` (root layout with providers), 54+ `page.tsx` files for different routes

**apps/web/src/components/:**
- Purpose: Reusable React components
- Contains: UI primitives (shadcn/ui wrapping Radix), form components, domain-specific components
- `ui/` subdirectory is auto-generated by shadcn/ui CLI — never edit manually
- Domain-specific folders (e.g., `proposals/`, `products/`, `transactions/`) contain components only used in those domains

**apps/web/src/hooks/:**
- Purpose: Custom React hooks for data fetching and state management
- Contains: Hooks that call services and manage loading/error/data states
- Naming: `use[ResourcePlural]()` (e.g., `useProposals()`, `useTransactions()`)
- Pattern: Hooks call services, return `{ data, loading, error }` or auto-refetching state

**apps/web/src/lib/:**
- Purpose: Utilities, configuration, and helpers
- Contains: Firebase initialization, validation schemas, formatting functions, plan logic, niche configuration
- Notable: `api-client.ts` (HTTP wrapper for calling backend), `validations/` (Zod schemas)

**apps/web/src/providers/:**
- Purpose: React Context definitions for global state
- Contains: Auth, Tenant, Theme, Permissions, Plan providers
- Usage: Wrap app in `<Providers>` (see `apps/web/src/app/providers.tsx`)

**apps/web/src/services/:**
- Purpose: Client-side API layer (all backend communication goes here)
- Contains: 25+ service files, each wrapping API endpoints
- Pattern: `async function operationName(params): Promise<Result>` calling `/api/backend/*`
- Error handling: Services propagate errors to consumers (no silent failures)

**apps/functions/src/api/controllers/:**
- Purpose: HTTP request handlers (one per domain/resource type)
- Contains: Input validation, service calls, error mapping to HTTP status, response formatting
- Files: `proposals.controller.ts`, `transactions.controller.ts`, `wallets.controller.ts`, etc.
- Pattern: Controller validates, calls service, returns HTTP response

**apps/functions/src/api/routes/:**
- Purpose: Express route registration (groups 30+ endpoints into logical route groups)
- Contains: 15 route files, each mounting multiple endpoints under a base path (e.g., `/v1/proposals`, `/v1/transactions`)
- Pattern: `router.get()`, `router.post()`, etc., with middleware chaining

**apps/functions/src/api/middleware/:**
- Purpose: Express middleware for cross-cutting concerns
- Contains: Auth verification (validates Firebase ID token), rate limiting (PDF generation)
- `auth.ts`: Verifies token, extracts custom claims, validates tenant isolation
- `pdf-rate-limiter.ts`: Limits PDF generation (5 requests per 60 seconds per user)

**apps/functions/src/lib/:**
- Purpose: Business logic utilities and helpers
- Contains: Financial calculations, billing logic, authentication utilities, logging
- Notable: `finance-helpers.ts` (wallet resolution, balance impacts), `auth-context.ts` (claim extraction)

**apps/functions/src/services/:**
- Purpose: Service implementations (PDF generation, WhatsApp messaging, notifications)
- Contains: Integrations with external services and complex business logic
- `transaction.service.ts`: ~1350 lines, all financial transaction logic (create, update, delete, balance reconciliation)

**tests/e2e/:**
- Purpose: End-to-end Playwright tests
- Contains: 59 test cases covering user workflows (auth, proposal CRUD, transactions, billing)
- Structure: Organized by domain (auth, proposals, financial, products, contacts)
- Fixtures: Reusable test data in `seed/` and `fixtures/`

**tests/firestore-rules/:**
- Purpose: Jest unit tests for Firestore security rules
- Contains: 41 test cases validating rule logic (tenant isolation, auth, permissions)
- Pattern: Jest tests that run emulator, create test documents, assert rule allows/denies access

**firebase/:**
- Purpose: Firebase configuration and security rules
- Contains: Firestore security rules (tenant isolation, DENY-by-default), Storage rules, composite indexes
- `firestore.rules`: 800+ lines defining access control for all collections
- Deployment: Managed via `firebase deploy` in CI/CD

## Key File Locations

**Entry Points:**

| Purpose | File | Type |
|---------|------|------|
| Frontend root layout | `apps/web/src/app/layout.tsx` | Page component |
| Middleware (route protection) | `apps/web/middleware.ts` | Next.js middleware |
| Backend Express app | `apps/functions/src/api/index.ts` | Express initialization |
| Backend entry point | `apps/functions/src/index.ts` | Cloud Function exports |

**Configuration:**

| Purpose | File | Type |
|---------|------|------|
| Frontend build | `apps/web/next.config.ts` | Next.js config |
| Frontend types | `apps/web/tsconfig.json` | TypeScript config (includes `@/` alias) |
| Backend config | `apps/functions/src/deploymentConfig.ts` | CPU, memory, region settings |
| Backend types | `apps/functions/tsconfig.json` | TypeScript config |
| Monorepo root | `package.json` | NPM workspaces |

**Core Logic:**

| Purpose | File | Type |
|---------|------|------|
| Financial transactions | `apps/functions/src/api/services/transaction.service.ts` | Service (~1350 lines) |
| Wallet management | `apps/functions/src/api/controllers/wallets.controller.ts` | Controller |
| Balance calculations | `apps/functions/src/lib/finance-helpers.ts` | Helpers |
| Auth context | `apps/functions/src/lib/auth-context.ts` | Auth utilities |
| Plan enforcement | `apps/functions/src/lib/tenant-plan-policy.ts` | Billing logic |
| PDF generation | `apps/functions/src/api/services/proposal-service/` | Service |
| WhatsApp integration | `apps/functions/src/api/services/whatsapp/` | Service |

**Testing:**

| Purpose | File | Type |
|---------|------|------|
| E2E test config | `tests/playwright.config.ts` | Playwright config |
| Performance tests | `tests/playwright.perf.config.ts` | Playwright config |
| Firestore rules tests | `tests/jest.config.js` | Jest config |
| Test data generation | `tests/e2e/seed/` | Seed scripts |

**Security:**

| Purpose | File | Type |
|---------|------|------|
| Firestore rules | `firebase/firestore.rules` | Security rules |
| Storage rules | `firebase/storage.rules` | Security rules |
| CORS policy | `apps/functions/src/api/security/cors-policy.ts` | CORS middleware |
| Security observability | `apps/functions/src/lib/security-observability.ts` | Audit trail |

## Naming Conventions

**Files:**
- React components: kebab-case with `.tsx` extension (e.g., `proposal-form.tsx`, `transaction-list.tsx`)
- Services: kebab-case with `-service.ts` suffix (e.g., `proposal-service.ts`, `transaction-service.ts`)
- Controllers: kebab-case with `.controller.ts` suffix (e.g., `proposals.controller.ts`)
- Routes: kebab-case with `.routes.ts` suffix (e.g., `finance.routes.ts`)
- Helpers: kebab-case with `.ts` extension (e.g., `finance-helpers.ts`, `auth-helpers.ts`)
- Tests: same name as source file with `.test.ts` or `.spec.ts` suffix
- Firestore collections: snake_case plural (e.g., `proposals`, `transactions`, `wallets`, `users`)

**Directories:**
- Next.js route segments: kebab-case or wrap in parentheses for grouping (e.g., `(auth)`, `(admin)`)
- Component folders: kebab-case (e.g., `pdf-components/`, `shared-components/`)
- Feature folders: kebab-case (e.g., `proposal-templates/`, `transaction-history/`)

**Variables and Functions:**
- camelCase (e.g., `transactionId`, `resolveWalletRef`, `createProposal`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_ATTACHMENTS_PER_PROPOSAL`, `DEFAULT_CURRENCY`)
- React component props: use `interface [ComponentName]Props {}` pattern

**TypeScript Types:**
- Use `interface` for object shapes and component props
- Use `type` for unions, literals, and mapped types
- Enum vs. union: prefer string unions over enums (e.g., `'pending' | 'paid' | 'overdue'`)

## Where to Add New Code

**New Feature (full-stack):**
1. **Types:** Add to `apps/web/src/types/` (frontend) and `apps/functions/src/shared/` (backend types)
2. **Backend:** Create controller in `apps/functions/src/api/controllers/` → register routes in `apps/functions/src/api/routes/` → add service logic in `apps/functions/src/api/services/` if complex
3. **Frontend service:** Create in `apps/web/src/services/[domain]-service.ts` to wrap `/api/backend/*` calls
4. **Frontend hook:** Create in `apps/web/src/hooks/use[Resource]()` to manage state and call service
5. **Frontend component:** Create in `apps/web/src/components/[domain]/` or route-local `_components/` folder
6. **Tests:** E2E tests in `tests/e2e/[domain]/`, Firestore rule tests in `tests/firestore-rules/` if rules changed

**New React Component:**
- File: `apps/web/src/components/[domain]/[component-name].tsx`
- Route-local component: `apps/web/src/app/[route]/_components/[component-name].tsx`
- Props: Always define `interface [ComponentName]Props {}`
- Export: Use named export (`export function [ComponentName]`)

**New API Route:**
1. **Create controller:** `apps/functions/src/api/controllers/[domain].controller.ts` (if new domain)
2. **Create routes:** `apps/functions/src/api/routes/[domain].routes.ts`
3. **Register routes:** Add import and `app.use()` in `apps/functions/src/api/index.ts`
4. **Create service:** `apps/functions/src/api/services/[name].service.ts` if business logic is complex
5. **Front-end wrapper:** Create service in `apps/web/src/services/[domain]-service.ts`

**New Firestore Query:**
1. **Frontend:** Query in service file or hook
2. **Backend:** Query in controller or service, always filter by `req.user.tenantId`
3. **Rules:** Update `firebase/firestore.rules` if accessing new collection; test with emulator

**New Utility Function:**
- Shared helpers: `apps/web/src/lib/` (frontend) or `apps/functions/src/lib/` (backend)
- Domain-specific: Keep in the service or controller that uses it first; extract if used in 3+ places

## Special Directories

**apps/web/src/components/ui/:**
- Purpose: Auto-generated Shadcn/ui components (Radix UI primitives wrapped with styling)
- Generated: `npx shadcn-ui@latest add [component]` auto-adds files here
- Committed: Yes (components committed to git after generation)
- Rule: Never edit manually; regenerate if updating shadcn/ui

**apps/functions/lib/:**
- Purpose: Compiled TypeScript output (CommonJS)
- Generated: `npm run build` in `apps/functions/` compiles `src/` to `lib/`
- Committed: No (generated files, not in git)
- Rule: Never edit directly; changes must be made to `.ts` files in `src/` and recompiled

**tests/e2e/dist/:**
- Purpose: Compiled Playwright tests (TypeScript → JavaScript)
- Generated: `npm run test:e2e` auto-compiles before running
- Committed: No (generated files)
- Rule: Never edit directly

**.next/ and .next/ (various):**
- Purpose: Build output directories
- Generated: Next.js build process, Firebase emulator cache
- Committed: No (ignored in `.gitignore`)
- Rule: Safe to delete; will be regenerated on next build/dev

---

*Structure analysis: 2026-05-04*
