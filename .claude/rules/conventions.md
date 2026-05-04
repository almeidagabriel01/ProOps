# Code Conventions

## Naming
- Files: kebab-case (`proposal-form.tsx`, `auth-context.ts`)
- React components: PascalCase (`ProposalForm`, `TransactionCard`)
- Variables and functions: camelCase (`transactionId`, `resolveWalletRef`)
- Constants: UPPER_SNAKE_CASE (`MAX_ATTACHMENTS_PER_PROPOSAL`)
- Firestore collections: snake_case plural (`proposals`, `transactions`, `wallets`)

## TypeScript
- Strict mode is enabled — no implicit `any`
- Use `interface` for props and data shapes; use `type` for unions and literals
- Never use `any` without a justification comment
- Use enums or string unions for status values (e.g., `'paid' | 'pending' | 'overdue'`)
- Import types separately with `import type {}` when possible

## Imports
- Order: React/Next → third-party → local → types
- Use `@/` alias for all `src/` imports (configured in `tsconfig.json`)
- Avoid circular imports: Service → Hook → Component (never reverse direction)

## File Organization
- `controllers/` — one file per domain, Express handlers only
- `services/` — business logic and API calls (client-side in `src/services/`, server-side in `apps/functions/src/api/services/`)
- `helpers/` — pure utility functions with no side effects
- `middleware/` — Express middleware only (auth, rate limiting)
- `types/` — domain-specific TypeScript interfaces

## Comments and Documentation
- Write self-documenting code — avoid comments that restate what the code does
- Add inline comments only for: non-obvious logic, complex calculations, security-critical sections
- JSDoc for public functions in services and helpers
- CLAUDE.md files document architecture decisions and module contracts — keep them updated when changing module behavior

## General Coding
- Don't add features, error handling, or validation beyond what is asked
- Don't add docstrings/comments to code you didn't change
- Prefer composition and context over deep prop drilling
- Three similar lines of code is better than a premature abstraction
- Only validate at system boundaries (user input, external APIs) — trust internal code and framework guarantees
