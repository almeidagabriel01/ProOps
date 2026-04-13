# Deployment Rules

## Pre-Deploy Checklist
Before deploying to any environment:
- [ ] `cd functions && npm run build` succeeds (TypeScript compiles to CommonJS in `functions/lib/`)
- [ ] `npm run lint` passes (no ESLint errors in frontend)
- [ ] `cd functions && npm run lint` passes (no ESLint errors in functions)
- [ ] No secrets in committed files — check `.env.local`, `functions/.env.*`
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
- Functions TypeScript compiles to `functions/lib/` (CommonJS)
- Always run `npm run build` in `functions/` before running emulators or deploying
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
