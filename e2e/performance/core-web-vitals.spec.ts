import { test, expect } from '../fixtures/auth.fixture';

async function collectWebVitals(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as any).__perfMetrics = { lcpValue: 0, clsValue: 0 };

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      (window as any).__perfMetrics.lcpValue = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as any;
        if (!shift.hadRecentInput) {
          (window as any).__perfMetrics.clsValue += shift.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function getMetrics(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const ttfb = nav ? nav.responseStart - nav.requestStart : -1;
    return {
      lcp: (window as any).__perfMetrics?.lcpValue ?? -1,
      cls: (window as any).__perfMetrics?.clsValue ?? 0,
      ttfb,
    };
  });
}

const THRESHOLDS = {
  LCP_MS: 4000,
  CLS: 0.1,
  TTFB_MS: 1000,
} as const;

test.describe('Core Web Vitals', () => {
  test('/login page performance', async ({ page }) => {
    await collectWebVitals(page);
    await page.goto('/login');
    const metrics = await getMetrics(page);

    console.log('Login page metrics:', metrics);

    expect(metrics.lcp, `LCP ${metrics.lcp}ms exceeds ${THRESHOLDS.LCP_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.LCP_MS);
    expect(metrics.cls, `CLS ${metrics.cls} exceeds ${THRESHOLDS.CLS}`).toBeLessThanOrEqual(THRESHOLDS.CLS);
    expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds ${THRESHOLDS.TTFB_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.TTFB_MS);
  });

  test('/dashboard page performance', async ({ authenticatedPage }) => {
    await collectWebVitals(authenticatedPage);
    await authenticatedPage.goto('/dashboard');
    const metrics = await getMetrics(authenticatedPage);

    console.log('Dashboard page metrics:', metrics);

    expect(metrics.lcp, `LCP ${metrics.lcp}ms exceeds ${THRESHOLDS.LCP_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.LCP_MS);
    expect(metrics.cls, `CLS ${metrics.cls} exceeds ${THRESHOLDS.CLS}`).toBeLessThanOrEqual(THRESHOLDS.CLS);
    expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds ${THRESHOLDS.TTFB_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.TTFB_MS);
  });

  test('/proposals page performance', async ({ authenticatedPage }) => {
    await collectWebVitals(authenticatedPage);
    await authenticatedPage.goto('/proposals');
    const metrics = await getMetrics(authenticatedPage);

    console.log('Proposals page metrics:', metrics);

    expect(metrics.lcp, `LCP ${metrics.lcp}ms exceeds ${THRESHOLDS.LCP_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.LCP_MS);
    expect(metrics.cls, `CLS ${metrics.cls} exceeds ${THRESHOLDS.CLS}`).toBeLessThanOrEqual(THRESHOLDS.CLS);
    expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds ${THRESHOLDS.TTFB_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.TTFB_MS);
  });

  test('/transactions page performance', async ({ authenticatedPage }) => {
    await collectWebVitals(authenticatedPage);
    await authenticatedPage.goto('/transactions');
    const metrics = await getMetrics(authenticatedPage);

    console.log('Transactions page metrics:', metrics);

    expect(metrics.lcp, `LCP ${metrics.lcp}ms exceeds ${THRESHOLDS.LCP_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.LCP_MS);
    expect(metrics.cls, `CLS ${metrics.cls} exceeds ${THRESHOLDS.CLS}`).toBeLessThanOrEqual(THRESHOLDS.CLS);
    expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds ${THRESHOLDS.TTFB_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.TTFB_MS);
  });
});
