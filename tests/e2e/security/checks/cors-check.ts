import type { CheckResult } from './audit-check.js';

const EVIL_ORIGIN = 'http://evil-site.com';

export async function runCorsCheck(baseUrl: string): Promise<CheckResult> {
  const healthUrl = `${baseUrl}/api/backend/health`;

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    response = await fetch(healthUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: EVIL_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    return {
      name: 'cors-check',
      status: 'warn',
      details: `Skipped: could not reach ${healthUrl}`,
    };
  }

  const allowOrigin = response.headers.get('access-control-allow-origin') ?? '';
  const echoesEvil =
    allowOrigin === EVIL_ORIGIN || allowOrigin === '*';

  if (echoesEvil) {
    return {
      name: 'cors-check',
      status: 'fail',
      details: `CORS misconfiguration: Access-Control-Allow-Origin echoed evil origin "${allowOrigin}" for request from ${EVIL_ORIGIN}`,
    };
  }

  return {
    name: 'cors-check',
    status: 'pass',
    details: `CORS correctly rejected evil origin. Access-Control-Allow-Origin: "${allowOrigin || '(absent)'}"`,
  };
}
