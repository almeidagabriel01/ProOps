import { test, expect } from '../fixtures/auth.fixture';
import { signInWithEmailPassword } from '../helpers/firebase-auth-api';
import { USER_ADMIN_ALPHA } from '../seed/data/users';

const SAMPLE_SIZE = 20;
const P95_THRESHOLD_MS = 500;

function calculateP95(durations: number[]): number {
  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.95) - 1;
  return sorted[index];
}

test.describe('API Response Time Baselines', () => {
  test('GET /api/backend/v1/notifications p95 response time', async ({ request }) => {
    const { idToken } = await signInWithEmailPassword(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    const authHeader = `Bearer ${idToken}`;

    // Warm-up call (discard timing)
    await request.get('http://localhost:3001/api/backend/v1/notifications', {
      headers: { Authorization: authHeader },
    });

    const durations: number[] = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = Date.now();
      const response = await request.get('http://localhost:3001/api/backend/v1/notifications', {
        headers: { Authorization: authHeader },
      });
      const duration = Date.now() - start;
      expect(response.status()).toBe(200);
      durations.push(duration);
    }

    const p95 = calculateP95(durations);
    console.log('Notifications API — durations:', durations, 'p95:', p95);

    expect(p95, `notifications p95 ${p95}ms exceeds ${P95_THRESHOLD_MS}ms`).toBeLessThanOrEqual(P95_THRESHOLD_MS);
  });

});

// NOTE: /contacts and /products pages load data directly via the Firestore
// client SDK (getDocs + collection queries in ClientService and ProductService).
// There is no GET /v1/clients or GET /v1/products backend endpoint.
// PERF-06 (API baseline for contacts and products) is therefore satisfied by
// the Core Web Vitals tests in core-web-vitals.spec.ts, not by this file.
