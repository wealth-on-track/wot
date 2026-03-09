#!/usr/bin/env node
import { execSync } from 'child_process';

const run = (cmd) => {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {}
};

run('node scripts/autonomous-engine/discover.mjs');
run('node scripts/autonomous-engine/plan.mjs');
run('node scripts/autonomous-engine/dispatch.mjs');
run('node scripts/autonomous-engine/build.mjs');
run('node scripts/autonomous-engine/verify.mjs');
run('node scripts/autonomous-engine/guarantee.mjs');
