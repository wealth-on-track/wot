#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact } from './lib.mjs';
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
  // Human approval gate: only now perform local deploy command
  let deployStatus = 'fail';
  try {
    execSync('npm run -s build', { stdio: 'pipe', timeout: 900000 });
    deployStatus = 'pass';
  } catch (e) {
    await writeArtifact(job.id, 'deploy-error.txt', String(e.message || e));
  }

  const deployPack = {
    jobId: job.id,
    title: job.title,
    changedFiles: job.changedFiles,
    testResults: job.testResults,
    deployStatus,
    instructions: 'Human-approved local deploy executed after approval gate.',
    generatedAt: nowIso(),
  };
  await writeArtifact(job.id, 'deploy-ready.json', deployPack);
  await writeArtifact(job.id, 'deploy-instructions.txt', 'Human-approved local deploy executed after approval gate.');

  // Keep final state set strict
  job.state = deployStatus === 'pass' ? 'review_ready' : 'abandoned_with_reason';
  if (deployStatus !== 'pass') job.finalReason = 'deploy_failed_after_human_approval';
  console.log(`[review] approved ${jobId}; deploy=${deployStatus}`);
} else {
  try { execSync('git reset --hard', { stdio: 'ignore' }); } catch {}
  job.state = 'reverted';
  job.finalReason = 'rejected_by_human';
  await writeArtifact(job.id, 'revert-note.txt', 'Human rejected. Local revert executed via git reset --hard.');
  console.log(`[review] rejected ${jobId}; local revert applied`);
}

history.push({ ...job });
await writeJson(files.jobs, jobs.filter((j) => j.id !== jobId));
await writeJson(files.history, history);
