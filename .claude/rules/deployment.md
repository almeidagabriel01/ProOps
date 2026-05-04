# Deployment Rules

## Commit & PR Workflow

- **Commit after each task** — one logical commit per completed task, with a clear message.
- **Never run `git push`** — the user pushes manually after reviewing.
- **Never merge to `main`** — only the user performs merges to `main`.
- **PRs target `develop` only** — never create a PR targeting `main`. Only the user creates PRs to `main`.
- Commit messages: imperative, lowercase, no period. No `Co-Authored-By`.

## Pre-Deploy Checklist
Before deploying to any environment:
- [ ] `cd apps/functions && npm run build` succeeds (TypeScript compiles to CommonJS in `apps/functions/lib/`)
- [ ] `npm run lint` passes (no ESLint errors in frontend)
- [ ] `cd apps/functions && npm run lint` passes (no ESLint errors in functions)
- [ ] No secrets in committed files — check `.env.local`, `apps/functions/.env.*`
- [ ] New Firestore indexes exported to `firestore.indexes.json` if queries changed
- [ ] Firestore security rules tested with emulator if modified
- [ ] Cron logic tested locally if changed
- [ ] Billing changes reviewed manually (Stripe webhooks, plan limits, WhatsApp overage)
- [ ] Deploy to dev (`npm run deploy:dev`) first — validate before prod

## Environments
- Dev Firebase project: `erp-softcode`
- Prod Firebase project: `erp-softcode-prod`
- Configured in `.firebaserc`
- Deploy commands: `npm run deploy:dev` | `npm run deploy:prod`

## Functions Build
- Functions TypeScript compiles to `apps/functions/lib/` (CommonJS)
- Always run `npm run build` in `apps/functions/` before running emulators or deploying
- Target runtime: Node.js 22, Cloud Run region `southamerica-east1`

## Emulators
- Start all emulators: `firebase emulators:start`
- Ports: Functions:5001, Firestore:8080, Auth:9099, Storage:9199, UI:4000
- Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local` to point frontend at emulators
- Test cron functions locally: `POST /internal/cron/<name>` with `x-cron-secret` header

## Risk Tiers
- **Low risk** (deploy freely after checklist): UI changes, copy updates, new non-billing features
- **Medium risk** (deploy to dev first, validate): New API routes, Firestore rule changes, new indexes
- **High risk** (manual review + staged rollout): Stripe/billing changes, auth flow changes, plan limit changes, overage billing, financial module changes
