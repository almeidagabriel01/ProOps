# Backend Rules

## Controller Structure
- One controller file per domain/resource in `functions/src/api/controllers/`
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
- Errors are auto-reported to Sentry by the global error handler in `functions/src/api/index.ts`

## Scheduled Functions (Crons)
- All cron exports live in `functions/src/index.ts`
- Test cron logic locally with Firebase Emulator before deploying
- Cron jobs must be idempotent — use a unique identifier/key to prevent duplicate effects
- Manual debug endpoint for crons requires `x-cron-secret` header

## Build & Deploy
- Always run `npm run build` in `functions/` before deploying — TypeScript compiles to CommonJS in `functions/lib/`
- Functions run on Node.js 22 in Cloud Run (`southamerica-east1`)
- Secrets stay in `functions/.env.erp-softcode` or `functions/.env.erp-softcode-prod` — never in source code
