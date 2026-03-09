#!/usr/bin/env node
import { execSync } from 'child_process';
try {
  execSync('node scripts/check-benchmark-data.ts', { stdio: 'pipe', timeout: 120000 });
  console.log('performance:pass');
  process.exit(0);
} catch {
  process.exit(1);
}
