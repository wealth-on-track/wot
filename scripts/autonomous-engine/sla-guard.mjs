#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent, writeArtifact, setActiveJobLock, normalizeJobs, stageAgeMinutes, transitionJob, approvedJobSummary } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));
const history = await readJson(files.history);

const now = Date.now();
const totalAgeMin = (job) => {
  const createdAt = new Date(job.timestamps?.createdAt || job.timestamps?.updatedAt || 0).getTime();
  if (!createdAt) return 0;
  return Math.floor((now - createdAt) / 60000);
};

let touched = 0;

for (const job of [...jobs]) {
  const age = stageAgeMinutes(job, now);
  const totalAge = totalAgeMin(job);

  if (totalAge >= 15) {
    transitionJob(job, 'executer_sync', { ownerAgent: 'executer', resetStageStartedAt: true });
    await setActiveJobLock(null);
    await writeArtifact(job.id, 'stall-intervention-note.txt', `Hard intervention triggered after ${totalAge}m total age. Job was not closed; live recovery resumed.`);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: hard intervention after ${totalAge}m from generation time; job resumed instead of being closed` });
    touched += 1;
    continue;
  }

  if (job.state === 'proposal' && age >= 5) {
    job.quality = { ...(job.quality || {}), status: job.quality?.status || 'proposal_ready', checkedAt: nowIso(), autoPromoted: true };
    job.timestamps.updatedAt = nowIso();
    job.stageStartedAt = nowIso();
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: `sla-guard: auto-readied proposal after ${age}m idle` });
    touched += 1;
    continue;
  }

  if (job.state === 'executer_sync' && age >= 5) {
    job.retries.sync = Number(job.retries?.sync || 0) + 1;
    job.timestamps.updatedAt = nowIso();
    job.stageStartedAt = nowIso();
    await setActiveJobLock(null);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: cleared stale sync after ${age}m and forced immediate redispatch` });
    touched += 1;
    continue;
  }

  if (job.state === 'execution' && age >= 5) {
    job.retries.executer = Number(job.retries?.executer || 0) + 1;
    transitionJob(job, 'executer_sync', { ownerAgent: 'executer', resetStageStartedAt: true });
    await setActiveJobLock(null);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: execution exceeded ${age}m, recycled to executer_sync` });
    touched += 1;
    continue;
  }

  if (job.state === 'qa_review' && age >= 5 && String(job.risk || 'low') === 'high') {
    transitionJob(job, 'executer_sync', { ownerAgent: 'executer', resetStageStartedAt: true });
    job.retries.qa = Number(job.retries?.qa || 0) + 1;
    await setActiveJobLock(null);
    await writeArtifact(job.id, 'stall-intervention-note.txt', `QA review exceeded ${age}m on a high-risk job, so the engine recovered it back into executer sync for another pass.`);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: QA review exceeded ${age}m on a high-risk job; returned to executer_sync for recovery` });
    touched += 1;
    continue;
  }

  if (job.state === 'qa_review' && age >= 5 && ['low', 'medium'].includes(String(job.risk || 'low'))) {
    transitionJob(job, 'approved', { ownerAgent: 'qa' });
    await writeArtifact(job.id, 'completion-summary.txt', approvedJobSummary(job));
    await writeArtifact(job.id, 'approval-note.txt', `Auto-approved by sla-guard after ${age}m in QA review.`);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'approved', message: `sla-guard: auto-approved after ${age}m in QA review` });
    history.push({ ...job });
    touched += 1;
  }
}

const liveJobs = jobs.filter((job) => !['approved', 'reverted', 'abandoned_with_reason'].includes(String(job.state || '')));
await writeJson(files.jobs, liveJobs);
await writeJson(files.history, history);
if (touched > 0 && liveJobs.length === 0) await setActiveJobLock(null);
console.log(`[sla-guard] processed ${touched} job(s)`);
