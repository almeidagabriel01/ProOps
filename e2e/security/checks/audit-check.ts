import { execSync } from 'child_process';

export interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  details: string;
}

export interface AuditCheckResult extends CheckResult {
  highCount: number;
  criticalCount: number;
}

interface NpmAuditVulnerability {
  severity: string;
}

interface NpmAuditReport {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
}

function runNpmAudit(prefix?: string): { highCount: number; criticalCount: number; error?: string } {
  const prefixFlag = prefix ? `--prefix ${prefix} ` : '';
  const cmd = `npm ${prefixFlag}audit --json --omit=dev --audit-level=high`;

  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const report: NpmAuditReport = JSON.parse(output);
    let highCount = 0;
    let criticalCount = 0;

    for (const vuln of Object.values(report.vulnerabilities ?? {})) {
      if (vuln.severity === 'critical') criticalCount++;
      else if (vuln.severity === 'high') highCount++;
    }

    return { highCount, criticalCount };
  } catch (err: unknown) {
    // npm audit exits non-zero when vulnerabilities are found; stdout still has the JSON
    const execError = err as { stdout?: string; stderr?: string };
    const output = execError.stdout ?? '';
    if (!output) {
      return { highCount: 0, criticalCount: 0, error: String(err) };
    }
    try {
      const report: NpmAuditReport = JSON.parse(output);
      let highCount = 0;
      let criticalCount = 0;
      for (const vuln of Object.values(report.vulnerabilities ?? {})) {
        if (vuln.severity === 'critical') criticalCount++;
        else if (vuln.severity === 'high') highCount++;
      }
      return { highCount, criticalCount };
    } catch {
      return { highCount: 0, criticalCount: 0, error: String(err) };
    }
  }
}

export async function runAuditCheck(): Promise<AuditCheckResult> {
  const frontend = runNpmAudit();
  const functions = runNpmAudit('functions');

  const totalHigh = frontend.highCount + functions.highCount;
  const totalCritical = frontend.criticalCount + functions.criticalCount;

  let status: 'pass' | 'warn' | 'fail';
  if (totalCritical > 0) {
    status = 'fail';
  } else if (totalHigh > 0) {
    status = 'warn';
  } else {
    status = 'pass';
  }

  const details =
    `Frontend: ${frontend.criticalCount} critical, ${frontend.highCount} high. ` +
    `Functions: ${functions.criticalCount} critical, ${functions.highCount} high.`;

  return {
    name: 'npm-audit',
    status,
    details,
    highCount: totalHigh,
    criticalCount: totalCritical,
  };
}
