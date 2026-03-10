#!/usr/bin/env node
import { execSync } from 'child_process';

const safe = (cmd, fallback = '') => {
  try { return execSync(cmd, { stdio: 'pipe', timeout: 60000 }).toString().trim(); } catch { return fallback; }
};

const out = {
  lintFail: false,
  testFail: false,
  auditHighCritical: 0,
  portfolioTouches: 0,
  onboardingTouches: 0,
  insightTouches: 0,
  benchmarkSignal: null,
};

try { execSync('npm run -s lint', { stdio: 'pipe', timeout: 90000 }); } catch { out.lintFail = true; }
try { execSync('npm run -s test -- --run', { stdio: 'pipe', timeout: 120000 }); } catch { out.testFail = true; }

const audit = safe('npm audit --json', '{}');
try {
  const parsed = JSON.parse(audit || '{}');
  out.auditHighCritical = Number(parsed?.metadata?.vulnerabilities?.high || 0) + Number(parsed?.metadata?.vulnerabilities?.critical || 0);
} catch {}

out.portfolioTouches = Number(safe("rg -n 'portfolio|pnl|allocation' src | wc -l", '0')) || 0;
out.onboardingTouches = Number(safe("rg -n 'onboard|empty state|first asset|getting started' src | wc -l", '0')) || 0;
out.insightTouches = Number(safe("rg -n 'insight|signal|trend|explain|confidence' src | wc -l", '0')) || 0;
out.benchmarkSignal = safe('node scripts/autonomous-engine/check-performance.mjs', 'fail');

console.log(JSON.stringify(out));
