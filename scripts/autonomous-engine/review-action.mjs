#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeArtifact, appendEvent, normalizeJobs, transitionJob, finalizeJob, approvedJobSummary } from './lib.mjs';

const action = process.argv[2];
const jobId = process.argv[3];
if (!['approve', 'reject'].includes(action) || !jobId) {
  console.error('usage: node scripts/autonomous-engine/review-action.mjs <approve|reject> <JOB-ID>');
  process.exit(1);
}

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));
const history = await readJson(files.history);
const job = jobs.find((j) => j.id === jobId);
if (!job) {
  console.error('job not found');
  process.exit(1);
}

job.timestamps.updatedAt = nowIso();

if (action === 'approve') {
  // Approve now only marks completed (no auto deploy)
  transitionJob(job, 'approved', { ownerAgent: 'qa' });
  await writeArtifact(job.id, 'completion-summary.txt', approvedJobSummary(job));
  await writeArtifact(job.id, 'approval-note.txt', 'Approved and moved to completed. Deployment is manual via Deploy button.');
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'approved', message: 'Approved: moved to completed (no auto deploy)' });
  console.log(`[review] approved ${jobId}; no deploy`);
} else {
  transitionJob(job, 'reverted', { ownerAgent: 'qa' });
  job.finalReason = 'rejected_by_human';
  await writeArtifact(job.id, 'revert-note.txt', 'QA rejected the job and moved it to completed without mutating unrelated workspace changes.');
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'reverted', message: 'Rejected during QA decision; job moved to completed without destructive workspace reset' });
  console.log(`[review] rejected ${jobId}`);
}

await finalizeJob(jobs, history, job);
