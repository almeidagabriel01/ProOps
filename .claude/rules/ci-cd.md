# CI/CD Rules

## Design: Tiered CI

Two distinct layers prevent redundant work:

| Layer | Workflow | Trigger | Wall-clock | Purpose |
|---|---|---|---|---|
| **Fast gate** | `push-checks.yml` | Every push except `main` | ~5 min | Structural health (types, lint, audit, rules) |
| **Full gate** | `test-suite.yml` | PRs to `main`/`develop` + Merge Queue | ~15 min | Behavioral correctness (E2E, performance, ZAP) |

E2E, performance, and ZAP run **only in test-suite** — never on every push.

## Workflows

| Workflow | File | Triggers |
|---|---|---|
| **Push Checks** | `push-checks.yml` | Every push except `main` (skips `*.md`, `docs/**`) |
| **Test Suite** | `test-suite.yml` | PRs to `main`/`develop` + `merge_group` (skips `*.md`, `docs/**`) |
| **Deploy Staging** | `deploy-functions.yml` | Push to `develop` with changes in `apps/functions/`, `firestore.rules`, `firebase.json` |
| **Deploy Production** | `deploy-production.yml` | Every push to `main` |
| **Dependency Review** | `dependency-review.yml` | PR with changes to `package.json` |
| **Stale** | `stale.yml` | Mondays 9h UTC |

## Reusable Workflows

Jobs shared between `push-checks` and `test-suite` live in dedicated reusable workflow files (prefixed with `_`). Change once, applies to both:

| File | Used by |
|---|---|
| `_reusable-type-check.yml` | push-checks, test-suite |
| `_reusable-lint.yml` | push-checks, test-suite |
| `_reusable-unit-tests.yml` | test-suite |
| `_reusable-firestore-rules.yml` | push-checks, test-suite |

## Push Checks Pipeline (`push-checks.yml`)

Runs in parallel on every push to non-main branches:
- `type-check` — TypeScript on frontend and functions (reusable)
- `lint` — ESLint on frontend and functions (reusable)
- `security-audit` — `npm audit --audit-level=critical` on both
- `firestore-rules` — Jest security rules with Firestore emulator (reusable)
- `push-gate` — final job that fails if any job above failed

## Test Suite Pipeline (`test-suite.yml`)

Runs on PRs and Merge Queue events:
- `type-check` — TypeScript on the merge commit (reusable)
- `lint` — ESLint on the merge commit (reusable)
- `unit-tests` — Vitest frontend unit tests `npm run test:web` (reusable)
- `firestore-rules` — Jest security rules (reusable)
- `e2e` — Playwright E2E **sharded across 4 parallel runners** (`--shard=N/4`), ~7 min
- `performance` — Core Web Vitals + API baseline (runs after all E2E shards pass)
- `lighthouse` — throttled-mobile Lighthouse perf budget on a production build (`npm run test:lighthouse`, runs after all E2E shards pass)
- `security` — OWASP ZAP baseline (runs after all E2E shards pass)
- `all-checks-passed` — consolidated gate required by branch protection

## Lighthouse Perf Budget (`lighthouse` job + `lighthouserc.json`)

Distinct from the dev-mode `performance` job: this one builds Next.js for production,
starts `next start -p 3001`, and runs Lighthouse 3x per URL (`/` and `/agendar`) under
**mobile + 4x CPU throttling** — the load path real users get. The dev-mode perf check
ran unthrottled and missed an LCP of ~7s, which is why this gate exists.

- Config: `lighthouserc.json` at repo root (uses `@lhci/cli`, already a devDependency).
- Server lifecycle is managed by lhci via `startServerCommand` — no manual start/stop.
- Budget asserts (median of 3 runs): `largest-contentful-paint` ≤ 4000ms (**warn** —
  see note), `cumulative-layout-shift` ≤ 0.1 (error), `total-blocking-time` ≤ 800ms
  (error), `first-contentful-paint` ≤ 2500ms (warn).
- **LCP is a WARN at the real 4000ms target, not a blocking error — on purpose.**
  Measured LCP is currently ~7.7s (`/`) and ~9.2s (`/agendar`), render-delay-bound by
  the hero's JS/animation bootstrap (GSAP + Lenis + Montserrat font swap), not yet
  fixed. A blocking `error` here would either be born red (the ~9.2s `/agendar`) or be
  set so loose (>9s) it guards nothing. So LCP surfaces loudly as a warning every run
  until the hero LCP is fixed; CLS and TBT stay hard `error` gates. Once the hero LCP
  is brought under control, switch LCP to `error` at ≤ 2500–4000ms.
- Run locally: `npm run build && npm run test:lighthouse` (needs a built `.next/`).
- Report artifact: `lighthouse-report-<run>` (from `lhci-report/`).

## E2E Sharding

The E2E job uses a matrix strategy with 4 shards:
- Each shard runs on a separate GitHub Actions runner
- `fail-fast: false` so other shards continue if one fails
- Artifacts are named `playwright-report-shardN-<run>` per shard
- Playwright distributes test files automatically across shards

## Merge Queue (`merge_group` trigger)

When Merge Queue is enabled on a branch, GitHub creates a temporary branch with the real merge commit before merging. `test-suite.yml` runs on this commit via the `merge_group` trigger. This catches cases where develop + main integrate correctly in isolation but break when merged.

To enable: GitHub → Settings → Branches → edit rule → enable "Require merge queue".

## Branch Protection

Configure **only `all-checks-passed`** (test-suite.yml) as required status check on GitHub — it's the consolidated gate for PRs to `main`/`develop`.

Do NOT add `push-gate` (push-checks.yml) as a required status check for PRs — it runs on pushes, not on the PR merge commit.

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
| `e2e` (any shard) | Playwright test failed | Download `playwright-report-shardN-*` artifact for trace |
| `firestore-rules` | Security rule broken | `npm run test:rules` locally with emulator |
| `performance` | CWV below threshold | See `performance-report-*/` artifact |
| `security` | ZAP found FAIL | See `zap-report-*/` artifact |
| `dependency-review` | New dep with `high`/`critical` vuln | Replace or pin a different version |

## Running Locally Before Push

```bash
# Quick checks (mirrors push-checks)
cd apps/web && npx tsc --noEmit
cd apps/functions && npx tsc --noEmit
npm run lint
cd apps/functions && npm run lint
npm audit --omit=dev --audit-level=critical

# Full suite (mirrors test-suite — run before opening a PR)
npm run test:e2e && npm run test:performance && npm run test:rules
```
