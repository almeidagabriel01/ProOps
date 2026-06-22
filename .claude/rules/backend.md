# Backend Rules

## Controller Structure
- One controller file per domain/resource in `apps/functions/src/api/controllers/`
- Always validate input first, then call business logic — never skip validation
- Map error keywords to consistent HTTP status codes:
  - `FORBIDDEN_*` / `AUTH_CLAIMS_MISSING_*` → 403
  - `não encontrada` / `not found` → 404
  - `inválido` / `invalid` → 400
  - Unexpected errors → 500
- Use dedicated `mapXxxErrorStatus()` helpers (e.g., `mapTransactionErrorStatus()`) — don't scatter HTTP logic

## Authentication & Middleware
- Route order matters: public routes → `validateFirebaseIdToken` → rate limiters → protected routes
- `req.user` is typed as `AuthContext` with: `uid`, `tenantId`, `role`, `masterId`, `isSuperAdmin`, `hasRequiredClaims`
- Never trust `tenantId` from the request body — always use `req.user.tenantId`
- Custom claims: `tenantId`, `role`, `masterId`, `isSuperAdmin`
- Stale-claims fallback: middleware fetches `users/{uid}` doc when claims are incomplete — don't bypass this

## Firestore Queries
- Every query MUST filter by `tenantId` from auth context — no exceptions
- Always include `.limit()` on collection queries to prevent runaway reads
- Use `db.runTransaction()` for any operation touching multiple documents atomically
- Create composite indexes for `where + orderBy` combinations and export to `firestore.indexes.json`
- New Firestore collections require explicit security rules — DENY-by-default policy means missing rules = blocked

## Logging
- New code: use `logger` from `../lib/logger` (emits JSON with `severity` for GCP Cloud Logging)
- Existing code using `console.log` is acceptable — don't migrate unless touching the code anyway
- Never log: tokens, passwords, private keys, CPF, full emails, phone numbers
- Errors are auto-captured by the global error handler in `apps/functions/src/api/index.ts` — logged structurally and fed into the error observability pipeline (grouped issues in Firestore)

## Scheduled Functions (Crons)
- All cron exports live in `apps/functions/src/index.ts`
- Test cron logic locally with Firebase Emulator before deploying
- Cron jobs must be idempotent — use a unique identifier/key to prevent duplicate effects
- Manual debug endpoint for crons requires `x-cron-secret` header

## AI Module (`apps/functions/src/ai/`)
- Providers: Google Gemini (`@google/genai`) and Groq
- Rate limiting: `rate-limiter.ts` (per-user) and `field-gen-rate-limiter.ts` (for field generation)
- Entry points: `chat.route.ts` (Lia chat), `field-gen.route.ts` (AI-assisted form filling)
- Never skip rate limiting on AI endpoints — costs are per-token
- AI module has its own route registration separate from main `api/routes/`

## Payment Webhooks
- **Stripe**: `/stripe/stripeWebhook` — signature verified, manages subscriptions and plan enforcement
- **Asaas**: `/webhooks/asaas/:tenantId` — `asaas-webhook.controller.ts`; public payment API in `asaas.controller.ts` mounted at `/v1`. (Replaced the former MercadoPago webhook, which was removed.)
- **WhatsApp**: `/webhooks/whatsapp` — verify token from `WHATSAPP_VERIFY_TOKEN`
- All webhooks: validate signature/token before processing, reject with 400 on failure

## Build & Deploy
- Always run `npm run build` in `apps/functions/` before deploying — TypeScript compiles to CommonJS in `apps/functions/lib/`
- Functions run on Node.js 22 in Cloud Run (`southamerica-east1`)
- Secrets stay in `apps/functions/.env.erp-softcode` or `apps/functions/.env.erp-softcode-prod` — never in source code
