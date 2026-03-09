#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, canTransition, appendEvent } from './lib.mjs';
import { execSync } from 'child_process';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const proposals = await readJson(files.proposals);
const job = jobs.find((j) => j.state === 'test');
if (!job) {
  console.log('[verify] no job');
  process.exit(0);
}

if (!canTransition('test', 'review_ready')) {
  console.log('[verify] invalid workflow graph');
  process.exit(1);
}

const proposal = proposals.find((p) => p.id === job.proposalId || p.id.startsWith(`${job.proposalId}-S`));
const requiredSet = new Set((proposal?.tests_required || ['lint']).map((x) => String(x).toLowerCase()));

job.ownerAgent = 'verifier';
job.timestamps.updatedAt = nowIso();

const fileArgs = (job.changedFiles || []).filter(Boolean).join(' ');
const lintCmd = fileArgs ? `npx eslint ${fileArgs}` : 'npm run -s lint';

const commands = [
  { name: 'lint', cmd: lintCmd, required: requiredSet.has('lint') },
  { name: 'unit', cmd: 'npm run -s test -- --run --passWithNoTests', required: requiredSet.has('unit') },
  { name: 'security', cmd: 'npm audit --audit-level=high', required: requiredSet.has('security') || job.category === 'security' },
  { name: 'integration', cmd: 'node scripts/autonomous-engine/check-integration.mjs', required: requiredSet.has('integration') },
  { name: 'e2e', cmd: 'node scripts/autonomous-engine/check-e2e.mjs', required: requiredSet.has('e2e') },
  { name: 'performance', cmd: 'node scripts/autonomous-engine/check-performance.mjs', required: requiredSet.has('performance') || job.category === 'performance' || job.category === 'benchmark' },
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
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'review_ready', message: 'Verifier passed all required checks; ready for review' });
} else {
  job.retries.testing += 1;
  if (job.retries.testing >= 3) {
    job.state = 'abandoned_with_reason';
    job.finalReason = 'verification_failed_after_3_retries';
    await writeArtifact(job.id, 'failure-analysis.txt', 'verification failed repeatedly; scope should be reduced/split');
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'abandoned_with_reason', message: 'Verification failed after retries; job abandoned with reason' });
  } else {
    job.state = 'build';
    job.ownerAgent = 'builder';
  }
}

job.timestamps.updatedAt = nowIso();
await writeJson(files.jobs, jobs);
console.log(`[verify] ${job.id} => ${job.testResults}`);
