# CI/CD Rules

## Workflows

| Workflow | File | Triggers |
|---|---|---|
| **Push Checks** | `push-checks.yml` | Every push except `main` |
| **Test Suite** | `test-suite.yml` | PRs to `main` or `develop` |
| **Deploy Staging** | `deploy-functions.yml` | Push to `develop` with changes in `apps/functions/`, `firestore.rules`, `firebase.json` |
| **Deploy Production** | `deploy-production.yml` | Every push to `main` |
| **Dependency Review** | `dependency-review.yml` | PR with changes to `package.json` |
| **Stale** | `stale.yml` | Mondays 9h UTC |

## Push Checks Pipeline (`push-checks.yml`)

Runs in parallel on every push:
- `type-check` — TypeScript on frontend and functions
- `lint` — ESLint on frontend and functions
- `security-audit` — `npm audit --audit-level=critical` on both
- `e2e-push` — Playwright E2E with Firebase emulators + seed
- `firestore-rules-push` — Jest security rules tests (parallel with E2E)
- `performance-push` — Core Web Vitals + API baseline (after E2E passes)
- `security-scan-push` — OWASP ZAP baseline (after E2E passes)
- `push-gate` — final job that fails if any job above failed

## Branch Protection

Configure **only `all-checks-passed`** (test-suite.yml) as required status check on GitHub — it's the consolidated gate for PRs to `main`/`develop`.

## Auto-Deploy

`deploy-functions.yml` triggers when push has changes in `apps/functions/`, `firestore.rules`, or `firebase.json`:
- Push to `develop` → deploy to `erp-softcode` (environment: **staging**)
- Push to `main` → deploy to `erp-softcode-prod` (environment: **production**)

Frontend (Next.js) is deployed automatically by Vercel — no workflow needed.

## GitHub Secrets

**Repository secrets** (Settings → Secrets → Actions):

| Secret | Value for CI |
|---|---|
| `CRON_SECRET` | any string (e.g., `test-cron-secret`) |
| `STRIPE_SECRET_KEY` | Stripe test key (e.g., `sk_test_fake`) |

**Environment: staging** (Settings → Environments → staging):

| Secret | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | Full JSON of Service Account for `erp-softcode` |

**Environment: production** (Settings → Environments → production):

| Secret | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_PRODUCTION` | Full JSON of Service Account for `erp-softcode-prod` |

To generate: Firebase Console → Project Settings → Service Accounts → Generate new private key.

## Troubleshooting Job Failures

| Job | Failed? | What to do |
|---|---|---|
| `type-check` | TypeScript error | Fix `tsc --noEmit` locally |
| `lint` | ESLint errors | `npm run lint` and `cd apps/functions && npm run lint` |
| `security-audit` | Critical vulnerability | `npm audit fix` or update package |
| `e2e-push` / `e2e` | Playwright test failed | Download `playwright-report-*` artifact for trace |
| `firestore-rules-push` | Security rule broken | `npm run test:rules` locally with emulator |
| `performance-push` | CWV below threshold | See `performance-report/` artifact |
| `security-scan-push` | ZAP found FAIL | See `security-scan-report/` artifact |
| `dependency-review` | New dep with `high`/`critical` vuln | Replace or pin a different version |

## Running Locally Before Push

```bash
# Full suite (CI equivalent)
npm run test:e2e && npm run test:performance && npm run test:rules

# Quick checks
cd apps/web && npx tsc --noEmit
cd apps/functions && npx tsc --noEmit
npm run lint
cd apps/functions && npm run lint
npm audit --omit=dev --audit-level=critical
```
