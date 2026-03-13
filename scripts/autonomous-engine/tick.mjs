#!/usr/bin/env node
import { execSync } from 'child_process';

const run = (cmd) => {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {}
};

run('node scripts/autonomous-engine/system-audit.mjs');
run('node scripts/autonomous-engine/critical-flow-guard.mjs');
run('node scripts/autonomous-engine/self-heal.mjs');
run('node scripts/autonomous-engine/discover.mjs');
run('node scripts/autonomous-engine/proposal-quality-backfill.mjs');
run('node scripts/autonomous-engine/proposal-sanitize.mjs');
run('node scripts/autonomous-engine/dedupe-proposals.mjs');
run('node scripts/autonomous-engine/plan.mjs');
run('node scripts/autonomous-engine/repair-orphans.mjs');
run('node scripts/autonomous-engine/proposal-triage.mjs');
run('node scripts/autonomous-engine/quality-gate.mjs');
run('node scripts/autonomous-engine/dispatch.mjs');
run('node scripts/autonomous-engine/build.mjs');
run('node scripts/autonomous-engine/verify.mjs');
run('node scripts/autonomous-engine/guarantee.mjs');
run('node scripts/autonomous-engine/review-reminder.mjs');
run('node scripts/autonomous-engine/maintenance.mjs');
run('node scripts/autonomous-engine/critical-flow-guard.mjs');
run('node scripts/autonomous-engine/dispatch.mjs'); // tail dispatch: clear stale lock + pre-stage next build candidate
