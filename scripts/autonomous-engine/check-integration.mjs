#!/usr/bin/env node
import { execSync } from 'child_process';
try {
  execSync('npm run -s test -- --run', { stdio: 'pipe', timeout: 180000 });
  console.log('integration:pass');
  process.exit(0);
} catch {
  console.error('integration:fail');
  process.exit(1);
}
