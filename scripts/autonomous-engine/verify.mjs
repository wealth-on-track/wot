#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, canTransition } from './lib.mjs';
import { execSync } from 'child_process';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const job = jobs.find((j) => j.state === 'test');
if (!job) {
  console.log('[verify] no job');
  process.exit(0);
}

if (!canTransition('test', 'review_ready')) {
  console.log('[verify] invalid workflow graph');
  process.exit(1);
}

job.ownerAgent = 'verifier';
job.timestamps.updatedAt = nowIso();

const fileArgs = (job.changedFiles || []).filter(Boolean).join(' ');
const lintCmd = fileArgs ? `npx eslint ${fileArgs}` : 'npm run -s lint';

const commands = [
  { name: 'lint', cmd: lintCmd, required: true },
  { name: 'unit', cmd: 'npm run -s test -- --run --passWithNoTests', required: true },
  { name: 'security', cmd: 'npm audit --audit-level=high', required: true },
  { name: 'integration', cmd: 'node scripts/autonomous-engine/check-integration.mjs', required: ['product', 'operations', 'patch'].includes(job.category) },
  { name: 'e2e', cmd: 'node scripts/autonomous-engine/check-e2e.mjs', required: ['ux', 'product', 'branding'].includes(job.category) },
  { name: 'performance', cmd: 'node scripts/autonomous-engine/check-performance.mjs', required: ['performance', 'benchmark'].includes(job.category) },
];

const run = ({ name, cmd, required }) => {
  if (!required) return { check: name, cmd, status: 'skipped' };
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 180000 });
    return { check: name, cmd, status: 'pass' };
  } catch (e) {
    return { check: name, cmd, status: 'fail', error: String(e.message || e) };
  }
};

const results = commands.map(run);
const allPass = results.filter((r) => r.status !== 'skipped').every((r) => r.status === 'pass');
job.testResults = allPass ? 'pass' : 'fail';

await writeArtifact(job.id, 'verification-results.json', results);

if (allPass) {
  job.state = 'review_ready';
} else {
  job.retries.testing += 1;
  if (job.retries.testing >= 3) {
    job.state = 'abandoned_with_reason';
    job.finalReason = 'verification_failed_after_3_retries';
    await writeArtifact(job.id, 'failure-analysis.txt', 'verification failed repeatedly; scope should be reduced/split');
  } else {
    job.state = 'build';
    job.ownerAgent = 'builder';
  }
}

job.timestamps.updatedAt = nowIso();
await writeJson(files.jobs, jobs);
console.log(`[verify] ${job.id} => ${job.testResults}`);
