import fs from 'fs';
import path from 'path';
import { runAuditCheck } from './checks/audit-check.js';
import { runHeaderCheck } from './checks/header-check.js';
import { runCorsCheck } from './checks/cors-check.js';
import type { CheckResult } from './checks/audit-check.js';

interface SecurityReport {
  timestamp: string;
  baseUrl: string;
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    warned: number;
    failed: number;
  };
}

function parseArgs(): { baseUrl: string } {
  const args = process.argv.slice(2);
  const urlIdx = args.indexOf('--url');
  const baseUrl = urlIdx !== -1 && args[urlIdx + 1] ? args[urlIdx + 1] : 'http://localhost:3000';
  return { baseUrl };
}

const STATUS_SYMBOLS: Record<string, string> = {
  pass: '[PASS]',
  warn: '[WARN]',
  fail: '[FAIL]',
};

function printResult(result: CheckResult): void {
  const symbol = STATUS_SYMBOLS[result.status] ?? '[????]';
  console.log(`  ${symbol} ${result.name}`);
  console.log(`         ${result.details}`);
}

async function checkServerReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { baseUrl } = parseArgs();

  console.log('ProOps Security Scan');
  console.log('====================');
  console.log(`Target: ${baseUrl}`);
  console.log(`Time:   ${new Date().toISOString()}\n`);

  const results: CheckResult[] = [];

  // npm audit always runs (no server required)
  console.log('Running npm audit...');
  const auditResult = await runAuditCheck();
  results.push(auditResult);
  printResult(auditResult);
  console.log();

  // Header and CORS checks require server
  const serverReachable = await checkServerReachable(baseUrl);
  if (!serverReachable) {
    console.log(`[WARN] Server not reachable at ${baseUrl}. Skipping header and CORS checks.`);
    console.log('       Start the dev server with: npm run dev\n');

    results.push({
      name: 'header-check',
      status: 'warn',
      details: `Skipped: server not running at ${baseUrl}`,
    });
    results.push({
      name: 'cors-check',
      status: 'warn',
      details: `Skipped: server not running at ${baseUrl}`,
    });
  } else {
    console.log('Running header check...');
    const headerResult = await runHeaderCheck(baseUrl);
    results.push(headerResult);
    printResult(headerResult);
    console.log();

    console.log('Running CORS check...');
    const corsResult = await runCorsCheck(baseUrl);
    results.push(corsResult);
    printResult(corsResult);
    console.log();
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    warned: results.filter((r) => r.status === 'warn').length,
    failed: results.filter((r) => r.status === 'fail').length,
  };

  console.log('Summary');
  console.log('-------');
  console.log(`  Total:  ${summary.total}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Warned: ${summary.warned}`);
  console.log(`  Failed: ${summary.failed}`);

  const report: SecurityReport = {
    timestamp: new Date().toISOString(),
    baseUrl,
    checks: results,
    summary,
  };

  const reportDir = path.resolve('security-report');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'security-scan.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${reportPath}`);

  if (summary.failed > 0) {
    console.log('\nSecurity scan FAILED. Fix the issues above and re-run.');
    process.exit(1);
  }

  console.log('\nSecurity scan completed.');
}

main();
