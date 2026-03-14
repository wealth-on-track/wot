#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent, writeArtifact, setActiveJobLock, normalizeJobs } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));
const history = await readJson(files.history);

const now = Date.now();
const ageMin = (job) => {
  const updatedAt = new Date(job.timestamps?.updatedAt || job.timestamps?.createdAt || 0).getTime();
  if (!updatedAt) return 0;
  return Math.floor((now - updatedAt) / 60000);
};
const totalAgeMin = (job) => {
  const createdAt = new Date(job.timestamps?.createdAt || job.timestamps?.updatedAt || 0).getTime();
  if (!createdAt) return 0;
  return Math.floor((now - createdAt) / 60000);
};

let touched = 0;

for (const job of [...jobs]) {
  const age = ageMin(job);
  const totalAge = totalAgeMin(job);

  if (totalAge >= 15) {
    job.state = 'executer_sync';
    job.ownerAgent = 'executer';
    job.timestamps.updatedAt = nowIso();
    await setActiveJobLock(null);
    await writeArtifact(job.id, 'stall-intervention-note.txt', `Hard intervention triggered after ${totalAge}m total age. Job was not closed; live recovery resumed.`);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: hard intervention after ${totalAge}m from generation time; job resumed instead of being closed` });
    touched += 1;
    continue;
  }

  if (job.state === 'proposal' && age >= 5) {
    job.quality = { ...(job.quality || {}), status: job.quality?.status || 'proposal_ready', checkedAt: nowIso(), autoPromoted: true };
    job.timestamps.updatedAt = nowIso();
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: `sla-guard: auto-readied proposal after ${age}m idle` });
    touched += 1;
    continue;
  }

  if (job.state === 'executer_sync' && age >= 5) {
    job.retries.sync = Number(job.retries?.sync || 0) + 1;
    job.timestamps.updatedAt = nowIso();
    await setActiveJobLock(null);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: cleared stale sync after ${age}m and forced immediate redispatch` });
    touched += 1;
    continue;
  }

  if (job.state === 'execution' && age >= 5) {
    job.retries.executer = Number(job.retries?.executer || 0) + 1;
    job.state = 'executer_sync';
    job.ownerAgent = 'executer';
    job.timestamps.updatedAt = nowIso();
    await setActiveJobLock(null);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: execution exceeded ${age}m, recycled to executer_sync` });
    touched += 1;
    continue;
  }

  if (job.state === 'qa_review' && age >= 5 && ['low', 'medium'].includes(String(job.risk || 'low'))) {
    job.state = 'approved';
    job.timestamps.updatedAt = nowIso();
    await writeArtifact(job.id, 'approval-note.txt', `Auto-approved by sla-guard after ${age}m in QA review.`);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'approved', message: `sla-guard: auto-approved after ${age}m in QA review` });
    history.push({ ...job });
    touched += 1;
  }
}

await writeJson(files.jobs, jobs);
await writeJson(files.history, history);
if (touched > 0 && jobs.length === 0) await setActiveJobLock(null);
console.log(`[sla-guard] processed ${touched} job(s)`);
