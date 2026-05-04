# Security Rules

## Multi-Tenant Isolation
- Every Firestore document must have a `tenantId` field
- Every query must filter by `tenantId` from `req.user.tenantId` (auth context) — never from request body
- Firestore rules are DENY-by-default — every new collection requires explicit allow rules
- Validate that custom claims `tenantId` matches the document's `tenantId` before any write

## Authentication
- Firebase Auth ID tokens are the only valid auth mechanism — no API key bypass
- Backend validates tokens in `validateFirebaseIdToken` middleware on every request
- Next.js middleware reads `__session` cookie for SSR route protection
- Stale-claims fallback reads `users/{uid}` doc — errors if tenantId mismatches between claims and doc

## Secrets Management
- `STRIPE_SECRET_KEY`, `WHATSAPP_APP_SECRET`, Firebase private key → only in `apps/functions/.env.*`
- `NEXT_PUBLIC_*` vars are public — never put sensitive values in them
- Never commit `.env.local`, `apps/functions/.env.erp-softcode`, or `apps/functions/.env.erp-softcode-prod`
- Use `.env.local.example` and `apps/functions/.env.example` with placeholders for documentation

## CORS
- Origins are resolved from env vars in order: `CORS_ALLOWED_ORIGINS` → `NEXT_PUBLIC_APP_URL` → `VERCEL_URL`
- Dev mode auto-adds localhost — don't hardcode localhost in production code
- Preview deployments (`*.vercel.app`, `*.web.app`) are allowed in dev-only mode
- `ALLOW_CORS_FALLBACK=true` is for local development only — never set in production

## SSRF Protection
- Outbound URLs must be validated through `validateOutboundUrl()` before making HTTP requests
- Blocked ranges: all private IPs (10.x, 127.x, 169.254.x, 172.16-31.x, 192.168.x) and cloud metadata endpoints
- Applies to any feature that fetches external URLs (e.g., proxy-image endpoint)

## Security Observability
- Auth failures, CORS denials, plan violations → emit events to `security_metrics` and `security_audit_events` collections
- Don't remove or skip security event emission when modifying auth/CORS/plan-limit flows
- Sentry receives error context with tenant/user info — never include raw tokens or passwords in error metadata

## General
- Financial and billing operations must run server-side in Cloud Functions — never in Next.js frontend or client
- Never bypass Firestore security rules using Admin SDK from client-side code
- Rate limiting is in-memory per Cloud Run instance — don't remove the PDF rate limiter (5 req/60s per user)
