# Coding Conventions

**Analysis Date:** 2026-05-04

## Naming Patterns

**Files:**
- Kebab-case for all files: `proposal-form.tsx`, `auth-context.ts`, `user-service.ts`, `error-boundary.tsx`
- Exception: Uppercase directories and barrel exports only: `ui/`, `components/`

**Functions:**
- camelCase for all functions: `resolveAuthContextFromRequest()`, `enforceTenantPlanLimit()`, `sanitizeText()`
- React component functions: PascalCase: `ActivityLeaderboard()`, `ProposalForm()`, `ErrorBoundary()`
- Hooks: `use[Name]` pattern: `useProposalForm()`, `useTenant()`, `useNotifications()`

**Variables:**
- camelCase for local variables and constants: `tenantId`, `userId`, `isValid`, `updatingIdsRef`
- Firebase references: suffixed with `Ref`: `userRef`, `proposalRef`, `walletRef`
- Query snapshots/data: suffixed with `Doc`: `userData`, `proposalData`, `masterDoc`

**Types:**
- PascalCase for types and interfaces: `AuthContext`, `UserDoc`, `ProposalBillingInfo`
- Props interfaces: `[ComponentName]Props`: `ActivityLeaderboardProps`, `ProposalFormProps`
- Event handler types: `[ComponentName]Props` with handler as property: `onClick: () => void`
- Request/Response types paired: `CreateUserRequest`, `CreateUserResponse`

**Constants:**
- UPPER_SNAKE_CASE: `MAX_ATTACHMENTS_PER_PROPOSAL`, `WALLETS_COLLECTION`, `PLAN_LIMITS_BY_TIER`
- Firestore collection names: snake_case plural: `proposals`, `transactions`, `wallets`, `wallet_transactions`, `users`, `tenants`

**Firestore Fields:**
- snake_case for all Firestore fields: `tenantId`, `userId`, `currentPeriodEnd`, `isDefault`, `stripeCustomerId`
- Timestamps: `createdAt`, `updatedAt`, `dueDate`, `expiresAt`
- Status enums: lowercase: `"active"`, `"past_due"`, `"canceled"`, `"pending"`, `"paid"`

## Code Style

**Formatting:**
- ESLint with Next.js config: `apps/web/eslint.config.mjs`
- Backend ESLint: `apps/functions/eslint.config.mjs` using TypeScript parser
- No explicit Prettier config — defaults apply. Code is formatted on save (IDE-dependent)
- 2-space indentation (Prettier default)

**Linting:**
- Frontend: ESLint via `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Backend: ESLint with TypeScript plugin, ignoring `lib/**` (compiled output) and `node_modules/**`
- Run: `npm run lint` (frontend only from root), `cd apps/functions && npm run lint` (backend)
- No custom rules beyond defaults — project follows Next.js/TypeScript community standards

**Strictness:**
- TypeScript strict mode enabled in both frontend and backend
- No implicit `any` — must have justification comment if necessary
- All function parameters and return types must be explicitly typed
- Avoid `Function` type — use proper function signatures

## Import Organization

**Order:**
1. React and Next.js imports: `import { useState } from "react"`, `import { useRouter } from "next/navigation"`
2. Third-party libraries: `import { motion } from "motion/react"`, `import { doc, getDoc } from "firebase/firestore"`
3. Internal imports: `import { useAuth } from "@/providers/auth-provider"`
4. Type imports: `import type { User } from "@/types/user"` (separate with `import type`)

**Path Aliases:**
- Frontend: `@/` maps to `src/` (configured in `tsconfig.json`)
- All relative imports should use `@/` alias, never `../../../`
- Backend has no path aliases — use relative paths only

**Barrel Files:**
- Use barrel exports (`index.ts`) in hooks, components, and services for clean import statements
- Example: `export { useProposalForm } from "./useProposalForm"`
- Example in components: `export * from "./index"` (for shadcn/ui component exports)

## Error Handling

**Patterns in Backend:**
- Errors thrown by business logic contain a simple string message that maps to HTTP status codes
- Use `mapXxxErrorStatus()` helpers (e.g., `mapWalletErrorStatus()`, `mapTransactionErrorStatus()`) to convert error messages to HTTP status
- Mapping keywords:
  - `FORBIDDEN_*` or `AUTH_CLAIMS_MISSING_*` or "Sem permiss" / "Acesso negado" → 403
  - "não encontrada" / "not found" → 404
  - "inválido" / "invalid" / "Dados inválidos" → 400
  - Unexpected errors → 500
- Example from `wallets.controller.ts`:
  ```typescript
  function mapWalletErrorStatus(message: string): number {
    if (message.startsWith("FORBIDDEN_")) return 403;
    if (message.includes("não encontrada")) return 404;
    if (message.includes("Dados inválidos")) return 400;
    return 500;
  }
  ```

**Patterns in Frontend:**
- Services propagate errors up to consuming hooks — no silent `catch` blocks
- Hooks manage `{ data, loading, error }` state and propagate errors to components
- Components render error UI conditionally or delegate to ErrorBoundary for unexpected errors
- ErrorBoundary at `apps/web/src/components/shared/error-boundary.tsx` — class component that catches React render errors and displays fallback UI

**Error Info Validation:**
- Always validate input first, then call business logic — never skip validation
- Use Zod schemas in backend controllers before processing: 
  ```typescript
  const parseResult = CreateWalletSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message;
    return res.status(400).json({ message: firstError });
  }
  ```

## Logging

**Framework:**
- Backend: Custom logger in `apps/functions/src/lib/logger.ts` 
- Emits JSON with `severity` field recognized by GCP Cloud Logging
- Methods: `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()`
- Context passed as second parameter: `logger.info("message", { tenantId, userId })`

**When to Log:**
- Use logger for new code in backend
- Existing code using `console.log` is acceptable — GCP still captures those logs
- Log business events: "Wallet created", "Proposal sent", "WhatsApp message queued"
- Log security events: auth failures, permission denials, plan violations
- Never log: tokens, passwords, `FIREBASE_PRIVATE_KEY`, CPF, full email, phone numbers
- Errors are auto-reported to Sentry by global error handler in `apps/functions/src/api/index.ts`

**Frontend Logging:**
- Use Sentry for error tracking (requires `NEXT_PUBLIC_SENTRY_DSN` in env)
- Use `console.log` for debugging (development only, not persisted)
- Errors in components: caught by ErrorBoundary and logged with component stack
- Network errors: propagated from services to hooks to UI

## Comments and Documentation

**Self-Documenting Code:**
- Write clear variable names and function names that explain intent
- Avoid comments that restate what the code does
- Only comment non-obvious logic, complex calculations, or security-critical sections

**JSDoc/TSDoc:**
- Document public functions in services and helpers with brief JSDoc blocks
- Document props interfaces inline with comments when non-obvious
- Example: not required for simple CRUD functions, but use for complex business logic

**CLAUDE.md Files:**
- Each major folder has a `CLAUDE.md` that documents:
  - Architecture decisions and constraints
  - Critical module contracts (what functions do, not how)
  - Billing/security-sensitive rules
  - Integration points with other modules
- Keep CLAUDE.md updated when changing module behavior — it's the contract

**Inline Comments:**
- Use for: security-critical sections, workarounds, non-obvious optimizations
- Not for: every line of code or simple assignments

## Function Design

**Size:**
- Keep functions under 40 lines when possible
- Large functions (>100 lines): break into smaller helpers
- Controllers: each HTTP handler is one function (~30-50 lines before delegating to service)

**Parameters:**
- Use explicit parameters for simple functions (< 3 params)
- Use object destructuring for complex functions: `async function createWallet({ name, type, color, description })`
- Avoid boolean parameters — use descriptive option names instead of `isActive: boolean`

**Return Values:**
- Hooks return named objects: `{ data, loading, error }`
- Services return typed responses or throw errors — don't return `null`
- React components return JSX element or null
- API handlers return via `res.json()`, never throw (Express catches and handles)

**Firestore Transactions:**
- Multi-document operations always use `db.runTransaction()` for atomicity
- Example pattern from transaction service:
  ```typescript
  await db.runTransaction(async (transaction) => {
    const walletDoc = await transaction.get(walletRef);
    const newBalance = (walletDoc.data()?.balance || 0) + delta;
    transaction.update(walletRef, { balance: newBalance });
    transaction.set(txRef, { ... });
  });
  ```

## Module Design

**Exports:**
- Use named exports (not default exports) for tree-shaking and clarity
- Example: `export function useProposalForm() { ... }`
- Barrel files aggregate: `export { useProposalForm } from "./useProposalForm"`

**Folder Structure Patterns:**
- `controllers/`: one controller file per domain, Express handlers only
- `services/`: business logic and API calls (no HTTP routing)
- `helpers/`: pure utility functions with no side effects
- `middleware/`: Express middleware only
- `lib/`: shared utilities and context resolvers
- `types/`: domain-specific TypeScript interfaces

**Separation of Concerns:**
- Components: UI rendering only, receive data via props
- Hooks (data): fetch/mutate data, manage loading/error state
- Hooks (UI): manage visual state, form state, modals
- Services: HTTP calls to backend, Firestore queries
- Controllers: validate input, call services, return response

**Multi-Tenant Isolation:**
- Every Firestore document must have `tenantId` field
- Every query must filter by `tenantId` from `req.user.tenantId` — never from request body
- Backend: resolve `tenantId` from auth context: `const { tenantId } = await resolveAuthContextFromRequest(req)`
- Frontend: get `tenantId` from `useTenant()` context provider

**Firestore Queries:**
- Always include `.limit()` on collection queries to prevent runaway reads
- Always filter by `tenantId` first, then other conditions
- Use composite indexes for `where + orderBy` combinations and export to `firestore.indexes.json`

## Validation & Sanitization

**Input Validation:**
- Backend: use Zod schemas in controllers before processing
- Example pattern from wallets controller:
  ```typescript
  const CreateWalletSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório.").max(100).trim(),
    type: z.string().min(1).max(50).trim(),
  });
  const parseResult = CreateWalletSchema.safeParse(req.body);
  ```

**Text Sanitization:**
- Backend: use `sanitizeText()` for plain text, `sanitizeRichText()` for rich text
- Location: `apps/functions/src/utils/sanitize.ts`
- Apply after Zod validation, before storing in Firestore

**Custom Claims Validation:**
- Backend: middleware calls `resolveAuthContextFromRequest()` which validates:
  - Token structure and expiration
  - Custom claims: `tenantId`, `role`, `masterId`
  - Mismatch detection: claim `tenantId` vs doc `tenantId` must align
- Frontend: middleware reads `__session` cookie for SSR protection

## Testing Considerations

**Unit Testing:**
- Test pure functions (helpers, utilities) in isolation
- Firestore rules tested with `@firebase/rules-unit-testing` in Jest
- Controllers tested with mocked Firebase/Stripe (not in CI unit test suite — only E2E)

**Integration Testing:**
- E2E tests with Playwright against running Firebase emulators
- Seed data for test tenants with known IDs: `tenant-alpha`, `tenant-beta`
- Tests validate multi-tenant isolation, plan limits, auth flows

**Mocking:**
- Backend: Firebase Admin SDK is never mocked — tests use real emulator
- Frontend: `fetch` is mocked in component tests (if any unit tests exist)
- Stripe webhook events: mocked in cron tests with fake customer IDs

---

*Convention analysis: 2026-05-04*
