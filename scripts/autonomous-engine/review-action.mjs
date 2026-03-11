#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, appendEvent, setActiveJobLock } from './lib.mjs';
import { execSync } from 'child_process';

const action = process.argv[2];
const jobId = process.argv[3];
if (!['approve', 'reject'].includes(action) || !jobId) {
  console.error('usage: node scripts/autonomous-engine/review-action.mjs <approve|reject> <JOB-ID>');
  process.exit(1);
}

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);
const job = jobs.find((j) => j.id === jobId);
if (!job) {
  console.error('job not found');
  process.exit(1);
}

job.timestamps.updatedAt = nowIso();

if (action === 'approve') {
  // Approve now only marks completed (no auto deploy)
  job.state = 'approved';
  await writeArtifact(job.id, 'approval-note.txt', 'Approved and moved to completed. Deployment is manual via Deploy button.');
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'approved', message: 'Approved: moved to completed (no auto deploy)' });
  console.log(`[review] approved ${jobId}; no deploy`);
} else {
  try { execSync('git reset --hard', { stdio: 'ignore' }); } catch {}
  try { execSync('git clean -fd', { stdio: 'ignore' }); } catch {}
  job.state = 'reverted';
  job.finalReason = 'rejected_by_human';
  await writeArtifact(job.id, 'revert-note.txt', 'Human rejected. Local workspace reverted via git reset --hard + git clean -fd.');
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'reverted', message: 'Reject clicked: local revert applied (hard reset + clean)' });
  console.log(`[review] rejected ${jobId}; local revert applied`);
}

history.push({ ...job });
const remaining = jobs.filter((j) => j.id !== jobId);
await writeJson(files.jobs, remaining);
await writeJson(files.history, history);
await setActiveJobLock(null);
