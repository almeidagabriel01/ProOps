---
phase: 06-performance-tests
plan: 02
status: complete
---

# Plan 06-02 Summary

## What was done

Wired the Playwright performance suite into CI by replacing the old Lighthouse job with a new `performance:` job in `.github/workflows/test-suite.yml`. Updated the `test:performance` npm script to invoke `playwright.perf.config.ts` instead of the legacy `run-lighthouse.ts` runner. Removed the `e2e/lighthouse/` directory entirely.

## Files modified/removed

- `package.json` — updated `test:performance` script from `npx tsx e2e/lighthouse/run-lighthouse.ts` to `npx playwright test --config=playwright.perf.config.ts`
- `.github/workflows/test-suite.yml` — replaced `lighthouse:` job with `performance:` job (parallel to `e2e:` and `security:`, no `needs:`, timeout 15 min, uploads `performance-report/` artifact)
- `e2e/lighthouse/lighthouse.config.js` — deleted
- `e2e/lighthouse/run-lighthouse.ts` — deleted
- `e2e/lighthouse/` — directory removed

## Verification

```
# package.json script:
npx playwright test --config=playwright.perf.config.ts   ✓

# lighthouse directory:
PASS: dir removed   ✓

# Remaining e2e/lighthouse references in tracked files:
(none)   ✓
```

## Commit

`36fc428` — chore(06-02): replace Lighthouse CI job with Playwright performance suite
