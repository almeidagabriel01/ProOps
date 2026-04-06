import { execSync } from 'child_process';
import path from 'path';

const TARGET_URL = 'http://localhost:3000';
const REPORT_DIR = './lighthouse-report';

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
  console.log(`Checking if dev server is running at ${TARGET_URL}...`);

  const reachable = await checkServerReachable(TARGET_URL);
  if (!reachable) {
    console.error(
      `\nError: Dev server not reachable at ${TARGET_URL}.\n` +
        'Please start the dev server first:\n\n' +
        '  npm run dev\n\n' +
        'Then re-run: npm run test:performance'
    );
    process.exit(1);
  }

  console.log('Dev server is running. Starting Lighthouse audit...\n');

  const configPath = path.resolve('e2e/lighthouse/lighthouse.config.ts');

  try {
    execSync(`npx lhci autorun --config=${configPath}`, {
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log(`\nLighthouse report generated in: ${REPORT_DIR}`);
  } catch (err: unknown) {
    const exitCode = (err as NodeJS.ErrnoException & { status?: number }).status ?? 1;
    console.error('\nLighthouse audit completed with threshold violations.');
    console.log(`Report available in: ${REPORT_DIR}`);
    process.exit(exitCode);
  }
}

main();
