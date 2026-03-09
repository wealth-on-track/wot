#!/usr/bin/env node
import { execSync } from 'child_process';
try {
  execSync('node scripts/check_test1_portfolio.ts', { stdio: 'pipe', timeout: 120000 });
  console.log('e2e:pass');
  process.exit(0);
} catch {
  process.exit(1);
}
