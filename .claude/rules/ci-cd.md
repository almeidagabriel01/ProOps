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
| **Deploy Staging** | `deploy-functions.yml` | Push to `develop` with changes in `apps/functions/`, `firestore.rules`, `firebase.json` — plus `workflow_dispatch` for a manual redeploy |
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
- `e2e-mobile` — Playwright no projeto `mobile-chrome` (Pixel 5, 393x851, `hasTouch`). Roda **em paralelo** com `e2e`, não depende dele. Cobre `tests/e2e/mobile/**` + `smoke.spec.ts`.
- `performance` — Core Web Vitals + API baseline (runs after all E2E shards pass)
- `lighthouse` — throttled-mobile Lighthouse perf budget on a production build (`npm run test:lighthouse`). Runs **in parallel with E2E**, not after: it builds its own production server and depends on nothing from the E2E jobs. It is the longest job (~14 min), so gating it behind E2E added ~8 min of wall clock to every run for no benefit — Actions minutes are free on this public repo. Still required by `all-checks-passed`.
- `security` — OWASP ZAP baseline (runs after all E2E shards pass)
- `all-checks-passed` — consolidated gate required by branch protection

## Lighthouse Perf Budget (`lighthouse` job + `lighthouserc.json`)

Builds Next.js for production, starts `next start -p 3001`, and runs Lighthouse 3x per
URL across the **5 animated public routes** (`/`, `/automacao-residencial`, `/decoracao`,
`/contato`, `/agendar`) under **mobile + 4x CPU + slow-3G, REAL `devtools` throttling**.

- Config: `lighthouserc.json` at repo root (uses `@lhci/cli`, already a devDependency).
- Server lifecycle is managed by lhci via `startServerCommand` — no manual start/stop.
- **`throttlingMethod: "devtools"` (real), not the default simulated/Lantern.** Lantern
  reported ~7–9s LCP for every route — a *simulation artifact*: it models LCP as blocked
  behind hydration TBT and ignores that the text paints early. Verified 2026-06-19 with
  PerformanceObserver + devtools throttling, real LCP is **~1.8–3.1s** across all five
  routes (CLS 0). The CI now measures that real number.
- Asserts use `assertMatrix` (median of 3): all routes — `largest-contentful-paint`
  ≤ 4000ms (warn), `cumulative-layout-shift` ≤ 0.1 (**error**), `first-contentful-paint`
  ≤ 2500ms (warn). `total-blocking-time` ≤ 800ms is a hard **error** on the 4 secondary
  routes but a **warn on `/` only** — the home hero is a scroll-pinned GSAP timeline that
  must hydrate synchronously (deferring it flashes first paint), and under real CPU
  throttling that costs ~3s TBT, an accepted animation-bound floor.
- **History (how the LCP was actually fixed — don't re-chase dead ends):** the heroes used
  framer `initial={opacity:0}`+`whileInView`, so the above-the-fold LCP text stayed
  invisible until hydration (~6.6s throttled) → real LCP ~9s. Fixed by moving those
  above-the-fold entrances to CSS keyframes (`hero-enter`/`hero-rise-line` in globals.css)
  that auto-play at first paint — visually identical, real LCP → ~1.8s. The consent banner
  then became the late LCP element (client-gated, painted ~6s after hydration); fixed by
  rendering it at first paint via `public/cookie-consent-init.js` (commit `cbaf2dea`).
  Dead ends proven by measurement (do not retry): `montserrat` `block→swap` (0ms), and
  LazyMotion async `features` (flat — framer is not the hot chunk). Lenis is already
  deferred (`requestIdleCallback`, commit `550a9bbd`).
- Run locally: `npm run build && npm run test:lighthouse` (needs a built `.next/`).
- Report artifact: `lighthouse-report-<run>` (from `lhci-report/`).
- **Timing / `timeout-minutes`:** the lhci step alone is ~10 min (15 Lighthouse runs =
  5 URLs × `numberOfRuns: 3`, each under real slow-3G + 4× CPU throttling); with
  `npm ci` and the production build the job lands at 13–15 min. Measured across five
  consecutive runs: 13m26, 13m43, 13m53, 14m00, 14m46. The timeout was 15 min — 14 s of
  headroom in the worst case — so the job was starting to fail intermittently on nothing
  but runner variance. Raised to 25 min (2026-08-11). **Do not "speed it up" by lowering
  `numberOfRuns`**: the assertions aggregate by median, and a median of 2 is just a mean
  of 2, which makes an `error`-level gate (CLS, TBT) swing on a single outlier.

## E2E Sharding

The E2E job uses a matrix strategy with 4 shards:
- Each shard runs on a separate GitHub Actions runner
- `fail-fast: false` so other shards continue if one fails
- Artifacts are named `playwright-report-shardN-<run>` per shard
- Playwright distributes test files automatically across shards

## Projetos Playwright (`tests/playwright.config.ts`)

| Projeto | Device | O que roda |
|---|---|---|
| `chromium` | Desktop Chrome (1280x720) | tudo em `tests/e2e/**`, **exceto** `mobile/**` (`testIgnore`) |
| `mobile-chrome` | Pixel 5 (393x851, `hasTouch`, `isMobile`) | `smoke.spec.ts` + `tests/e2e/mobile/**` |

Antes disso nenhuma tela autenticada era exercitada abaixo de 1280px — uma quebra
de layout mobile passava pelo CI em silêncio. `mobile/no-overflow.spec.ts` afirma
que o `<main>` de cada rota autenticada cabe na largura do viewport; a asserção é
sobre o `<main>` e não sobre o documento porque o shell tem `overflow-hidden` no
container externo, então conteúdo largo demais é **cortado** em vez de gerar
scroll — foi assim que o grid de lançamentos (~662px) ficou quebrado sem alarme.

Não há screenshot baseline nem checagem de acessibilidade (axe) em nenhum projeto.

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
| `FUNCTIONS_ENV_STAGING` | Full contents of `apps/functions/.env.erp-softcode` |

**Environment: production** (Settings → Environments → production):

| Secret | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_PRODUCTION` | Full JSON of Service Account for `erp-softcode-prod` |
| `FUNCTIONS_ENV_PRODUCTION` | Full contents of `apps/functions/.env.erp-softcode-prod` |

To generate the service account: Firebase Console → Project Settings → Service Accounts → Generate new private key.

### Why the `FUNCTIONS_ENV_*` secrets exist

`.env.erp-softcode*` is gitignored, so a CI checkout has no env file. Deploying an
**existing** function without it is harmless — Cloud Functions preserves the env vars
already on the service. Deploying a **new** function without it creates the service
with zero env vars, permanently (every later deploy preserves the emptiness).

That is how `onUserSignupNotify`, `pdf` and `onTransactionTotals` ended up in prod
without `RESEND_API_KEY` — the internal signup email failed silently for every prod
signup until 2026-08-11. Both deploy workflows now materialize the env file from the
secret before `firebase deploy` and delete it afterwards.

**Ao adicionar/rotacionar uma variável em `apps/functions/.env.erp-softcode*`, atualize
o secret correspondente no GitHub** — senão o próximo cron/trigger novo nasce sem ela:

```bash
gh secret set FUNCTIONS_ENV_PRODUCTION --env production --repo almeidagabriel01/ProOps \
  < apps/functions/.env.erp-softcode-prod
gh secret set FUNCTIONS_ENV_STAGING --env staging --repo almeidagabriel01/ProOps \
  < apps/functions/.env.erp-softcode
```

O step falha o deploy se o secret estiver ausente ou incompleto (checa `RESEND_API_KEY=`).
Falhar é intencional: melhor abortar do que criar uma função sem env vars, que fica
quebrada em silêncio para sempre.

**Rotacionar um secret no provedor NÃO chega sozinho nas functions já publicadas.**
"Cloud Functions preserva as env vars já existentes no service" corta para os dois
lados: preserva também o valor *velho/vazado*. Trocar o valor em
`apps/functions/.env.erp-softcode*` só tem efeito depois de um `npm run deploy:prod`
(ou de um deploy do CI com o secret já atualizado) — sem isso as 18 services continuam
rodando a chave antiga.

Foi assim que a chave Stripe de produção rotacionada em 2026-08-11 ficou fora do ar até
2026-08-24: as functions seguiram com a `sk_live` comprometida, que a Stripe expirou.
Todo `prices.retrieve` passou a falhar, `/v1/stripe/plans` devolvia 200 com todos os
preços zerados e a landing exibia "Sob consulta" nos três planos (o CTA de trial some
junto, porque `displayPrice <= 0` cai no caminho de Enterprise). Checkout, portal,
webhooks e os crons de assinatura estavam quebrados pelo mesmo motivo.

Sintoma para diagnosticar rápido — o próprio runtime já avisa nos logs de cada service:
`[SECURITY][<source>] Compromised secrets detected: ...` (ver `secret-rotation-guard.ts`).
Conferir o que está publicado de verdade:

```bash
gcloud run services describe api --project=erp-softcode-prod \
  --region=southamerica-east1 --format="value(spec.template.spec.containers[0].env)"
```

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
