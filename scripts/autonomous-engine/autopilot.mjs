#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const maxCycles = Number(process.argv[2] || 10);

const states = () => {
  const jobs = JSON.parse(readFileSync('Agent Team/autonomous-engine/jobs.json', 'utf8'));
  return jobs.reduce((a, j) => (a[j.state] = (a[j.state] || 0) + 1, a), {});
};

for (let i = 1; i <= maxCycles; i++) {
  execSync('node scripts/autonomous-engine/tick.mjs', { stdio: 'inherit' });
  const s = states();
  const active = (s.executer_sync || 0) + (s.execution || 0) + (s.qa_review || 0) + (s.proposal || 0);
  if (active === 0) {
    console.log(`[autopilot] settled after ${i} cycle(s)`);
    process.exit(0);
  }
}

console.log(`[autopilot] reached maxCycles=${maxCycles}`);
