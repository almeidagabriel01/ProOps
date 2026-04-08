---
phase: 06-performance-tests
plan: 01
status: complete
---

# Plan 06-01 Summary

## What was done

Created a Playwright-based performance test suite using a dedicated config (`playwright.perf.config.ts`) that mirrors the main config but targets `e2e/performance/`, sets retries to 0 (threshold breaches are real failures), and outputs JSON + HTML reports to `performance-report/`. Two spec files implement the full suite: one measuring Core Web Vitals (LCP <= 4000ms, CLS <= 0.1, TTFB <= 1000ms) on four pages, and one measuring p95 API response times (<= 500ms) for the proposals and transactions endpoints via 20-sample loops with a warm-up call. The `performance-report/` output directory was also added to `.gitignore`.

## Files created

- `playwright.perf.config.ts`
- `e2e/performance/core-web-vitals.spec.ts`
- `e2e/performance/api-baselines.spec.ts`

## Verification

```
Listing tests:
  [chromium] › api-baselines.spec.ts:13:7 › API Response Time Baselines › GET /api/backend/v1/proposals p95 response time
  [chromium] › api-baselines.spec.ts:42:7 › API Response Time Baselines › GET /api/backend/v1/transactions p95 response time
  [chromium] › core-web-vitals.spec.ts:46:7 › Core Web Vitals › /login page performance
  [chromium] › core-web-vitals.spec.ts:58:7 › Core Web Vitals › /dashboard page performance
  [chromium] › core-web-vitals.spec.ts:70:7 › Core Web Vitals › /proposals page performance
  [chromium] › core-web-vitals.spec.ts:82:7 › Core Web Vitals › /transactions page performance
Total: 6 tests in 2 files
```
