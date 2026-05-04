import type { CheckResult } from './audit-check.js';

interface HeaderCheckDetail {
  header: string;
  present: boolean;
  level: 'error' | 'warn';
}

export async function runHeaderCheck(baseUrl: string): Promise<CheckResult> {
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    response = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timeout);
  } catch {
    return {
      name: 'header-check',
      status: 'warn',
      details: `Skipped: could not reach ${baseUrl}`,
    };
  }

  const headers = response.headers;
  const checks: HeaderCheckDetail[] = [
    {
      header: 'x-content-type-options',
      present: headers.get('x-content-type-options')?.toLowerCase() === 'nosniff',
      level: 'error',
    },
    {
      header: 'x-frame-options / csp frame-ancestors',
      present:
        headers.has('x-frame-options') ||
        (headers.get('content-security-policy') ?? '').includes('frame-ancestors'),
      level: 'error',
    },
    {
      header: 'strict-transport-security',
      present: headers.has('strict-transport-security'),
      level: 'warn',
    },
  ];

  const missing = checks.filter((c) => !c.present);
  const errors = missing.filter((c) => c.level === 'error');
  const warnings = missing.filter((c) => c.level === 'warn');

  const presentHeaders = checks
    .filter((c) => c.present)
    .map((c) => c.header)
    .join(', ');
  const missingHeaders = missing.map((c) => c.header).join(', ');

  const details =
    `Present: [${presentHeaders || 'none'}]. ` +
    `Missing: [${missingHeaders || 'none'}]. ` +
    `X-Content-Type-Options: ${headers.get('x-content-type-options') ?? '(absent)'}`;

  let status: 'pass' | 'warn' | 'fail';
  if (errors.length > 0) {
    status = 'fail';
  } else if (warnings.length > 0) {
    status = 'warn';
  } else {
    status = 'pass';
  }

  return { name: 'header-check', status, details };
}
