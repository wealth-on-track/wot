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
  job.state = 'approved';
  const deployPack = {
    jobId: job.id,
    title: job.title,
    changedFiles: job.changedFiles,
    testResults: job.testResults,
    instructions: 'Human-approved. Deploy manually if desired. Agents never deploy automatically.',
    generatedAt: nowIso(),
  };
  await writeArtifact(job.id, 'deploy-ready.json', deployPack);
  await writeArtifact(job.id, 'deploy-instructions.txt', 'Human-approved. Deploy manually if desired. Agents never deploy automatically.');
  console.log(`[review] approved ${jobId} (local only)`);
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
