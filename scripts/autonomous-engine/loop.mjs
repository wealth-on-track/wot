#!/usr/bin/env node
import { execSync } from 'child_process';

const intervalSec = Number(process.argv[2] || 300);
console.log(`[loop] starting local autonomous loop every ${intervalSec}s`);

const tick = () => {
  try {
    execSync('node scripts/autonomous-engine/tick.mjs', { stdio: 'inherit' });
  } catch {}
};

tick();
setInterval(tick, intervalSec * 1000);
