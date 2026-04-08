import { test, expect } from '../fixtures/auth.fixture';

const SAMPLE_SIZE = 20;
const P95_THRESHOLD_MS = 500;

function calculateP95(durations: number[]): number {
  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.95) - 1;
  return sorted[index];
}

test.describe('API Response Time Baselines', () => {
  test('GET /api/backend/v1/proposals p95 response time', async ({ authenticatedPage, request }) => {
    const cookies = await authenticatedPage.context().cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');
    expect(sessionCookie, '__session cookie must exist after auth').toBeTruthy();

    const cookieHeader = `__session=${sessionCookie!.value}`;

    // Warm-up call (discard timing)
    await request.get('http://localhost:3001/api/backend/v1/proposals', {
      headers: { Cookie: cookieHeader },
    });

    const durations: number[] = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = Date.now();
      const response = await request.get('http://localhost:3001/api/backend/v1/proposals', {
        headers: { Cookie: cookieHeader },
      });
      const duration = Date.now() - start;
      expect(response.status()).toBe(200);
      durations.push(duration);
    }

    const p95 = calculateP95(durations);
    console.log('Proposals API — durations:', durations, 'p95:', p95);

    expect(p95, `proposals p95 ${p95}ms exceeds ${P95_THRESHOLD_MS}ms`).toBeLessThanOrEqual(P95_THRESHOLD_MS);
  });

  test('GET /api/backend/v1/transactions p95 response time', async ({ authenticatedPage, request }) => {
    const cookies = await authenticatedPage.context().cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');
    expect(sessionCookie, '__session cookie must exist after auth').toBeTruthy();

    const cookieHeader = `__session=${sessionCookie!.value}`;

    // Warm-up call (discard timing)
    await request.get('http://localhost:3001/api/backend/v1/transactions', {
      headers: { Cookie: cookieHeader },
    });

    const durations: number[] = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = Date.now();
      const response = await request.get('http://localhost:3001/api/backend/v1/transactions', {
        headers: { Cookie: cookieHeader },
      });
      const duration = Date.now() - start;
      expect(response.status()).toBe(200);
      durations.push(duration);
    }

    const p95 = calculateP95(durations);
    console.log('Transactions API — durations:', durations, 'p95:', p95);

    expect(p95, `transactions p95 ${p95}ms exceeds ${P95_THRESHOLD_MS}ms`).toBeLessThanOrEqual(P95_THRESHOLD_MS);
  });
});
