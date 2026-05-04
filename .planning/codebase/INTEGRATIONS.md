# External Integrations

**Analysis Date:** 2026-05-04

## APIs & External Services

**Payment Processing:**
- **Stripe** - Subscription billing, one-time charges, add-ons
  - SDK: `stripe@20.0.0` (frontend), `stripe@17.0.0` (backend)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Config: `apps/functions/src/stripe/stripeConfig.ts`
  - Webhook: `POST /stripeWebhook` (signature verified)
  - Price IDs: Environment variables `STRIPE_PRICE_*_MONTHLY/YEARLY` for tiers (starter, pro, enterprise) and addons
  - Usage: Billing module, plan tier enforcement, addon management, subscription status sync

- **Mercado Pago** - Brazilian payment integration (alternative gateway)
  - SDK: `@mercadopago/sdk-react@1.0.7`
  - Auth: OAuth 2.0 with `MERCADOPAGO_APP_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_OAUTH_REDIRECT_URI`, `MERCADOPAGO_STATE_SECRET`
  - Config: `apps/functions/src/lib/mercadopago-client.ts`, `apps/functions/src/api/services/mercadopago.service.ts`
  - Webhook: `POST /webhooks/mercado-pago` (signature verified)
  - Implementation: OAuth flow for tenant connection, token refresh (10-min ahead), environment detection (sandbox vs production)
  - Storage: Tokens stored encrypted in `tenants/{tenantId}.mercadoPago`
  - Usage: Payment method integration, fallback/alternative to Stripe

**AI Services:**
- **Google Gemini** - LLM for chatbot and content generation
  - SDK: `@google/generative-ai@0.24.1`
  - Auth: `GEMINI_API_KEY`
  - Provider: `apps/functions/src/ai/providers/gemini.provider.ts`
  - Endpoints: `/ai/chat` route for streaming conversations
  - Tools: Function calling for predefined operations (see `apps/functions/src/ai/tools/`)

- **Groq** - Alternative LLM provider (development/testing)
  - SDK: `groq-sdk@1.1.2`
  - Auth: `GROQ_API_KEY`
  - Provider: `apps/functions/src/ai/providers/groq.provider.ts`
  - Model: `llama-3.3-70b-versatile`
  - Usage: If `GROQ_API_KEY` defined, overrides Gemini in provider selection

**Communication:**
- **WhatsApp (Meta Business API)** - Bot integration and messaging
  - SDK: Axios HTTP client for API calls
  - Auth: `WHATSAPP_APP_SECRET` (webhook signature), `WHATSAPP_VERIFY_TOKEN` (webhook challenge)
  - Webhook: `POST /webhooks/whatsapp` (HMAC-SHA256 signature verified)
  - Services: `apps/functions/src/api/services/whatsapp/` (sessions, flows, PDF sending, rate limiting)
  - Features: Chatbot conversations, session management, file attachment handling, overage billing
  - Overage Billing: Monthly cron (`reportWhatsappOverage`) on 1st at 03:00 BRT via `stripe.billing.meterEvents.create`

**Calendar & Workspace:**
- **Google Calendar API** - Schedule integration
  - SDK: `googleapis@171.4.0`
  - Auth: OAuth via user's Google account
  - Usage: Calendar sync, event creation from proposals
  - Scopes: Read/write calendar events

## Data Storage

**Databases:**
- **Firebase Cloud Firestore (NoSQL)**
  - Connection: Firebase Admin SDK (`firebase-admin@13.6.1`)
  - Type: Document store with real-time capabilities
  - Projects: `erp-softcode` (dev), `erp-softcode-prod` (production)
  - Region: us-central1 (default)
  - Key collections:
    - `users/{uid}` - User profiles, subscription status, permissions
    - `tenants/{tenantId}` - Tenant configuration, billing, integrations
    - `proposals/{proposalId}` - Sales proposals with PDF metadata
    - `transactions/{transactionId}` - Financial transactions
    - `wallets/{walletId}` - Financial wallets with denormalized balances
    - `notifications` - Activity notifications (tenant-scoped)
    - `whatsappSessions/{phone}` - WhatsApp conversation state
    - `whatsappUsage/{tenantId}/months/{YYYY-MM}` - Monthly message count and overage
    - `sharedProposals/{token}` - Public share links for proposals
    - `sharedTransactions/{token}` - Public share links for transactions
  - Security Rules: DENY-by-default, custom claims + Firestore user document for tenant isolation
  - Indexes: Composite indexes for `where + orderBy` combinations defined in `firebase/firestore.indexes.json`

**File Storage:**
- **Firebase Cloud Storage**
  - Connection: Firebase Admin SDK
  - Purpose: PDF storage, proposal attachments, tenant logos, user avatars
  - Buckets: One per Firebase project (e.g., `erp-softcode.appspot.com`)
  - Paths: `tenants/{tenantId}/proposals/{proposalId}/pdf/`, `tenants/{tenantId}/transactions/{transactionId}/pdf/`
  - Security Rules: `firebase/storage.rules` - Tenant isolation enforced
  - PDFs: Generated server-side via Playwright + Chromium, cached by content hash

**Caching:**
- In-memory caching (per Cloud Run instance)
  - `PLAN_CACHE` in `tenant-plan-policy.ts` - Plan limits cached 30s per instance
  - PDF rate limiter - In-memory counter, 5 PDFs/min per user/IP
- No persistent cache layer (Redis) - Instances are stateless

## Authentication & Identity

**Auth Provider:**
- **Firebase Authentication**
  - Implementation: Email/password + OAuth (Google, GitHub potential)
  - ID Tokens: Issued on login, contain custom claims (`tenantId`, `role`, `masterId`, `isSuperAdmin`)
  - Session Cookies: `__session` cookie set by Next.js middleware for SSR route protection
  - Token Validation: Backend validates on every request via `validateFirebaseIdToken` middleware
  - Custom Claims: Set on user document via Admin SDK, refreshed via `auth.setCustomUserClaims()`
  - Stale Claims Fallback: If claims incomplete, middleware fetches `users/{uid}` doc for fallback values
  - Multi-Tenant: `tenantId` in custom claims; DENY-by-default Firestore rules enforce isolation

**Frontend Auth Flow:**
1. User signs in with Firebase Auth (email/password)
2. Next.js middleware reads `__session` cookie for SSR protection
3. Client-side context (`AuthProvider` in `apps/web/src/providers/`) stores user + claims
4. All backend calls include Bearer token in `Authorization` header

**Backend Auth Flow:**
1. Request arrives at Cloud Function
2. `validateFirebaseIdToken` middleware extracts token
3. Admin SDK verifies token signature
4. Custom claims extracted, fallback to user document if needed
5. Tenant ID validated against Firestore user doc
6. Request proceeds with `req.user` context

## Monitoring & Observability

**Error Tracking:**
- **Sentry**
  - Frontend: `@sentry/nextjs` with `NEXT_PUBLIC_SENTRY_DSN`
  - Backend: `@sentry/node` with `SENTRY_DSN`
  - Purpose: Error aggregation, context capture (tenant/user), alerting
  - Initialization: Automatic on both frontend and backend if env var present

**Logs:**
- **Google Cloud Logging**
  - Source: Structured JSON logs from `apps/functions/src/lib/logger.ts`
  - Fields: `severity` (INFO/WARN/ERROR), `timestamp`, `tenantId`, `uid`, custom fields
  - Filtering: Via Cloud Console by `severity=ERROR`, `tenantId=XXX`
  - Retention: Default GCP policy (30 days)

**Analytics:**
- **Vercel Analytics**
  - Package: `@vercel/analytics@2.0.1`
  - Metrics: Page views, sessions, user interactions
  - Automatic in Vercel deployments

- **Vercel Speed Insights**
  - Package: `@vercel/speed-insights@2.0.0`
  - Metrics: Core Web Vitals (LCP, FID, CLS, TTFB)
  - Real User Monitoring (RUM) in production

- **Google Analytics 4**
  - Tracking ID: `NEXT_PUBLIC_GA_ID` environment variable
  - Configuration: Set in Vercel environment variables

## CI/CD & Deployment

**Hosting:**
- **Vercel** - Next.js frontend
  - Deployment: Automatic on git push/merge
  - Environments: Production (main), Preview (PRs)
  - Configuration: `vercel.json` (if exists) or Next.js config
  - Env Secrets: Firebase config, Search Console token, GA ID, Sentry DSN

- **Google Cloud Run** - Firebase Cloud Functions backend
  - Region: `southamerica-east1`
  - Runtime: Node.js 22
  - Max Instances: 10 (prod), 1 (dev)
  - Concurrency: 80 (prod), 3 (dev)
  - Memory: 1GiB (default)
  - Timeout: 90s (API routes), variable for crons

**CI Pipeline:**
- **GitHub Actions** (`.github/workflows/`)
  - `push-checks.yml` - On every push (not main)
    - type-check (frontend + functions)
    - lint (frontend + functions)
    - security-audit (npm audit)
    - e2e-push (59 Playwright tests + Firebase emulator + seed)
    - firestore-rules-push (41 Jest tests for security rules)
    - performance-push (Core Web Vitals baseline)
    - security-scan-push (OWASP ZAP baseline)
    - push-gate (consolidated fail-fast gate)
  - `test-suite.yml` - On PR to main/develop
    - Consolidated gate: `all-checks-passed`
    - Required before merge
  - `deploy-functions.yml` - Auto-deploy on develop/main push
    - Deploys only if `apps/functions/`, `firestore.rules`, or `firebase.json` changed
    - Environment: staging (develop), production (main)
  - `dependency-review.yml` - On package.json changes
    - Blocks high/critical vulnerabilities
  - `stale.yml` - Weekly cleanup of stale issues

**Deploy Process:**
1. Developer creates PR on `develop` branch
2. GitHub Actions runs `test-suite.yml`
3. `all-checks-passed` job must pass (type-check, lint, e2e, rules, performance, security)
4. Maintainer reviews and approves PR
5. Merge to `develop` triggers `deploy-functions.yml` → staging deploy
6. Merge to `main` triggers `deploy-functions.yml` → production deploy
7. Frontend auto-deploys to Vercel (Vercel detection of Next.js)

**Manual Deploy:**
```bash
# Build backend TypeScript
cd apps/functions && npm run build

# Deploy to staging (dev Firebase project)
npm run deploy:dev

# Deploy to production (prod Firebase project)
npm run deploy:prod
```

## Environment Configuration

**Required env vars for CI:**

| Secret | Platform | Value | Usage |
|--------|----------|-------|-------|
| `CRON_SECRET` | GitHub Actions | Any random string (e.g., `test-cron-secret`) | Authenticates internal cron endpoints in tests |
| `STRIPE_SECRET_KEY` | GitHub Actions | Stripe test key (e.g., `sk_test_...`) | Billing tests with emulators |
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | GitHub Environments (staging) | Service Account JSON | Deploy functions to dev project (`erp-softcode`) |
| `FIREBASE_SERVICE_ACCOUNT_PRODUCTION` | GitHub Environments (production) | Service Account JSON | Deploy functions to prod project (`erp-softcode-prod`) |

**Secrets location:**
- GitHub Secrets: Settings → Secrets → Actions
- GitHub Environments: Settings → Environments → staging/production
- Firebase Service Account: Firebase Console → Project Settings → Service Accounts → Generate new private key

## Webhooks & Callbacks

**Incoming Webhooks:**

| Endpoint | Service | Signature Verification | Purpose |
|----------|---------|----------------------|---------|
| `POST /stripeWebhook` | Stripe | `stripe.webhooks.constructEvent(rawBody, sig, secret)` | Subscription events, payment confirmations, plan changes |
| `POST /webhooks/mercado-pago` | Mercado Pago | HMAC-SHA256 signature (state-based) | Payment status updates, transaction events |
| `POST /webhooks/whatsapp` | Meta (WhatsApp) | HMAC-SHA256 on `x-hub-signature` header | Incoming messages, status updates, session events |

**Outgoing Webhooks:**
- None currently. WhatsApp overage billing uses `stripe.billing.meterEvents.create` API (not a webhook, but metered usage reporting).

**Health Checks:**
- `GET /api/health` - Basic health endpoint (emulated in staging)
- GCP Cloud Monitoring uptime check (configured via `setup-gcp-monitoring.sh`)

---

*Integration audit: 2026-05-04*
