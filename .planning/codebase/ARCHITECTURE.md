# Architecture

**Analysis Date:** 2026-05-04

## Pattern Overview

**Overall:** Split-Backend Pattern (Microfrontend + Backend Monolith)

**Key Characteristics:**
- Frontend and backend are completely decoupled: Next.js 16 (App Router) on Vercel communicates with Cloud Functions backend exclusively via HTTP proxy routes
- Backend is a single Express monolith registered as one Cloud Function V2 running on Cloud Run (`southamerica-east1`)
- All state changes flow through backend; frontend is read-only until backend responds
- Multi-tenant architecture with tenant isolation enforced at Firestore rules (DENY-by-default) and backend middleware layers
- Custom Firebase Auth claims (`tenantId`, `role`, `masterId`) drive authorization decisions across all layers

## Layers

**Presentation Layer (Frontend):**
- Purpose: User interface, form handling, client-side state management, real-time updates
- Location: `apps/web/src/`
- Contains: React components (Radix UI + shadcn/ui), hooks, providers (Auth, Tenant, Theme, Permissions), service layer
- Depends on: Firebase Auth (client SDK), Firestore (client SDK for reading public data only), backend API via `/api/backend/*` proxy
- Used by: Browser clients (desktop, mobile)

**Backend API Layer:**
- Purpose: Business logic, data persistence, financial calculations, external service integrations
- Location: `apps/functions/src/api/`
- Contains: Controllers (CRUD), routes (13 groups), middleware (auth, rate limiting), services (PDF, WhatsApp, notifications)
- Depends on: Firestore (Admin SDK), Firebase Auth (Admin SDK), Stripe, MercadoPago, Google Calendar, WhatsApp
- Used by: Next.js `/api/backend/*` proxy, scheduled cron functions

**Cron/Scheduled Functions:**
- Purpose: Batch operations, notifications, billing reports, cleanup
- Location: `apps/functions/src/*.ts` (top-level: `checkDueDates.ts`, `checkManualSubscriptions.ts`, `checkStripeSubscriptions.ts`, `reportWhatsappOverage.ts`, `cleanupStorageAndSharedLinks.ts`)
- Contains: Scheduled function exports
- Depends on: Firestore, Stripe, email services
- Used by: Cloud Scheduler

**Data Persistence Layer:**
- Purpose: Single source of truth for all application state
- Location: Firestore (multi-region, dual-tenant databases: `erp-softcode` for dev, `erp-softcode-prod` for production)
- Contains: Collections (users, tenants, proposals, transactions, wallets, notifications, etc.)
- Security: Enforced by Firestore rules (tenant isolation), stale claims fallback to user document

## Data Flow

**User Action → API Request → Backend Processing → State Update → UI Refresh:**

1. User interacts with UI component in Next.js (clicks button, submits form)
2. Component calls hook in `src/hooks/` (e.g., `useCreateProposal()`)
3. Hook calls service in `src/services/` (e.g., `proposalService.create()`)
4. Service calls `/api/backend/*` Next.js proxy route (e.g., `POST /api/backend/v1/proposals`)
5. Proxy route forwards request to Cloud Functions Express API (via `apps/web/src/app/api/backend/[...path]/route.ts`)
6. Express controller in `apps/functions/src/api/controllers/` validates input, calls business logic service
7. Service updates Firestore atomically (uses transactions for multi-document writes)
8. Controller returns response to proxy route
9. Proxy route returns response to hook
10. Hook updates React state (or uses SWR/TanStack Query for automatic refetch)
11. Component re-renders with new data

**Real-Time Updates (Firestore Subscriptions):**
- Components subscribe to Firestore collections via `onSnapshot()` (client SDK)
- Firestore rules validate tenant isolation for each read
- Data flows directly to component state; no backend polling needed

**Financial Transaction State Machine:**
```
pending ──(pay)──> paid ──(revert)──> pending
                     ↓
              walletBalance updated
              (via FieldValue.increment)
```

**Wallet Balance Management:**
- Balances are DESNORMALIZED on `wallets/{id}` document (field: `balance`)
- Every write that affects balance uses Firestore Transaction + `FieldValue.increment()` for atomicity
- Wallet resolution via `resolveWalletRef()` in `apps/functions/src/lib/finance-helpers.ts` handles both legacy NAME-based and new ID-based references

**State Management:**
- Auth state: React Context (`AuthProvider` in `apps/web/src/providers/auth-provider.tsx`)
- Tenant state: React Context (`TenantProvider`)
- Plan/subscription state: React Context (`PlanProvider`)
- Theme state: React Context (`ThemeProvider`)
- Permissions state: React Context (`PermissionsProvider`)
- Component-level state: `useState()` for UI-only state (form inputs, modals, etc.)
- Server-side data: Firestore subscriptions (client) or API calls (hooks)

## Key Abstractions

**AuthContext:**
- Purpose: Represents authenticated user and their authorization claims
- Examples: `apps/functions/src/lib/auth-context.ts`, `apps/web/src/providers/auth-provider.tsx`
- Pattern: Extracted from Firebase ID token + stale claims fallback to user Firestore document
- Fields: `uid`, `tenantId`, `role`, `masterId`, `isSuperAdmin`, `hasRequiredClaims`

**Tenant Isolation:**
- Purpose: Ensures multi-tenant data segregation
- Examples: All Firestore queries filter by `tenantId` (from `req.user.tenantId` in backend, from `useTenant()` hook in frontend)
- Pattern: DENY-by-default Firestore rules; every collection document has `tenantId` field
- Enforcement: Backend middleware validates tenant in token vs. request data; Firestore rules block cross-tenant reads

**Service Layer (Client-Side):**
- Purpose: Centralized API call definitions
- Examples: `apps/web/src/services/proposal-service.ts`, `apps/web/src/services/transaction-service.ts`
- Pattern: Functions call `/api/backend/*` proxy; errors propagate to hook consumers
- No business logic here; purely HTTP layer

**Service Layer (Backend):**
- Purpose: Business logic encapsulation (PDF generation, WhatsApp messaging, financial calculations)
- Examples: `apps/functions/src/api/services/transaction.service.ts` (~1350 lines, all financial logic), `apps/functions/src/api/services/whatsapp/`, `apps/functions/src/lib/finance-helpers.ts`
- Pattern: Receives data from controller, performs validation + business logic, returns result or throws error
- Dependency: Services are consumed by controllers only (not directly by other services to avoid cycles)

**Controller Pattern (Backend):**
- Purpose: HTTP endpoint handlers
- Examples: `apps/functions/src/api/controllers/proposals.controller.ts`, `apps/functions/src/api/controllers/transactions.controller.ts`
- Pattern: Validate input → call service → map errors to HTTP status → return response
- Error mapping: Uses dedicated `mapXxxErrorStatus()` helpers (e.g., `mapTransactionErrorStatus()`)

**Route Groups:**
- Purpose: Organize 30+ endpoints into 13 logical groups
- Examples: `apps/functions/src/api/routes/core.routes.ts` (proposals, clients, products), `apps/functions/src/api/routes/finance.routes.ts` (transactions, wallets), `apps/functions/src/api/routes/stripe.routes.ts`
- Pattern: Each route file imports its controller, registers routes with middleware, exports router

**Next.js Proxy Pattern:**
- Purpose: Isolate backend URL; support frontend-only Vercel deployment
- Examples: `apps/web/src/app/api/backend/[...path]/route.ts` (catch-all route handler)
- Pattern: Receives request at `/api/backend/v1/proposals`, resolves upstream URL, forwards headers + body, returns response
- Security: Strips sensitive headers (Authorization via Firebase token in frontend), validates CORS

## Entry Points

**Frontend Entry Point:**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: Browser navigation to `https://<domain>`
- Responsibilities: Root layout (fonts, Sentry/Vercel setup), provider initialization (Auth, Tenant, Theme, Permissions), shell rendering

**Protected Routes (Frontend):**
- Location: `apps/web/src/app/*/page.tsx` (54 route pages total)
- Triggers: Navigation to protected paths (proposals, transactions, dashboard, etc.)
- Responsibilities: Fetch data from Firestore or backend API, render page UI
- Protection: Next.js middleware checks `__session` cookie; client-side `ProtectedRoute` component re-checks auth state

**API Proxy Entry Point (Frontend):**
- Location: `apps/web/src/app/api/backend/[...path]/route.ts`
- Triggers: Any service call to `/api/backend/*`
- Responsibilities: Forward request to Cloud Functions, validate CORS, transform response

**Backend Entry Point:**
- Location: `apps/functions/src/api/index.ts`
- Triggers: HTTP requests to Cloud Function (registered as `api`)
- Responsibilities: Initialize Express app, register middleware (CORS, auth, rate limiting), mount all route groups, handle uncaught errors

**Cron Entry Points (Backend):**
- Location: `apps/functions/src/index.ts`
- Triggers: Cloud Scheduler sends HTTP POST to cron endpoints
- Exported functions: `checkDueDates`, `checkStripeSubscriptions`, `checkManualSubscriptions`, `reportWhatsappOverage`, `cleanupStorageAndSharedLinks`
- Responsibilities: Each cron runs its batch logic, writes to Firestore, emits notifications

## Error Handling

**Strategy:** Multi-layer fallback with logging at each stage

**Frontend (Client-Side):**
- Service layer propagates errors to consuming hooks (never silent catch blocks)
- Hooks return error state; components display error UI or user-friendly message
- Unhandled errors caught by `ErrorBoundary` component (`apps/web/src/components/shared/error-boundary.tsx`)
- Sentry (`@sentry/nextjs`) auto-captures unhandled errors; requires `NEXT_PUBLIC_SENTRY_DSN` to initialize

**Backend (Server-Side):**
- Controllers validate input first; return 400 for invalid input
- Business logic throws errors with semantic keywords (`FORBIDDEN_*`, `not found`, `invalid`)
- Controllers map errors to HTTP status via `mapXxxErrorStatus()` helper
- Unhandled errors caught by global error handler in `apps/functions/src/api/index.ts`
- Global handler logs structured JSON, reports to Sentry (if `SENTRY_DSN` set), returns 500

**Patterns:**
```typescript
// Backend error handling in controller
try {
  const result = await service.create(req.body);
  return res.json({ success: true, data: result });
} catch (error) {
  const status = mapProposalErrorStatus(error);
  return res.status(status).json({ code: error.code, message: error.message });
}

// Frontend error handling in hook
const [error, setError] = useState<Error | null>(null);
const [loading, setLoading] = useState(false);
const createProposal = async (data: ProposalInput) => {
  setLoading(true);
  setError(null);
  try {
    const result = await proposalService.create(data);
    // update state with result
  } catch (err) {
    setError(err); // propagate to component
  } finally {
    setLoading(false);
  }
};
```

## Cross-Cutting Concerns

**Logging:**
- Frontend: Sentry + console (browser DevTools)
- Backend: Structured logger (`apps/functions/src/lib/logger.ts`) emits JSON with `severity` field recognized by GCP Cloud Logging
- New backend code should use `logger.info/warn/error()` instead of `console.log`

**Validation:**
- Frontend: Zod schemas in `apps/web/src/lib/validations/`
- Backend: Input validation in controllers before calling services
- Firestore rules: Document structure and tenant isolation validation

**Authentication:**
- Frontend: Firebase Auth SDK (`signInWithEmailAndPassword()`, `signOut()`)
- Backend middleware: Validates Firebase ID token, extracts custom claims (`tenantId`, `role`, `masterId`)
- Firestore: Rules validate authenticated user on every read/write
- Stale claims fallback: If custom claims incomplete, middleware fetches user document from Firestore to recover tenantId

**Authorization:**
- Frontend: `ProtectedRoute` component checks auth state; component-level UI guards (hide buttons/forms for unauthorized users)
- Backend middleware: Checks `req.user.tenantId` against document's `tenantId` before allowing access
- Firestore rules: Enforce DENY-by-default; explicit allow rules per collection per operation

**Rate Limiting:**
- PDF generation: In-memory rate limiter (5 req/60s per uid or IP) in `apps/functions/src/api/middleware/pdf-rate-limiter.ts`
- General API: Cloud Armor (setup in production via infrastructure)
- Firestore reads/writes: Quotas enforced by Firebase

**Security Observability:**
- Backend: `security-observability.ts` emits audit events (auth failures, CORS denials, plan violations) to `security_audit_events` and `security_metrics` Firestore collections
- Sentry: Error context includes `tenantId` and `uid` for tracing; secrets never logged

---

*Architecture analysis: 2026-05-04*
