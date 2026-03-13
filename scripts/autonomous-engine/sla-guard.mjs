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

let touched = 0;

for (const job of [...jobs]) {
  const age = ageMin(job);

  if (job.state === 'proposal' && age >= 15) {
    job.quality = { ...(job.quality || {}), status: job.quality?.status || 'proposal_ready', checkedAt: nowIso(), autoPromoted: true };
    job.timestamps.updatedAt = nowIso();
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: `sla-guard: auto-readied proposal after ${age}m idle` });
    touched += 1;
    continue;
  }

  if (job.state === 'executer_sync' && age >= 15) {
    job.retries.sync = Number(job.retries?.sync || 0) + 1;
    job.timestamps.updatedAt = nowIso();
    await setActiveJobLock(null);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: cleared stale sync after ${age}m and forced immediate redispatch` });
    touched += 1;
    continue;
  }

  if (job.state === 'execution' && age >= 15) {
    job.retries.executer = Number(job.retries?.executer || 0) + 1;
    job.state = 'executer_sync';
    job.ownerAgent = 'executer';
    job.timestamps.updatedAt = nowIso();
    await setActiveJobLock(null);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'executer_sync', message: `sla-guard: execution exceeded ${age}m, recycled to executer_sync` });
    touched += 1;
    continue;
  }

  if (job.state === 'qa_review' && age >= 15 && ['low', 'medium'].includes(String(job.risk || 'low'))) {
    job.state = 'approved';
    job.timestamps.updatedAt = nowIso();
    await writeArtifact(job.id, 'approval-note.txt', `Auto-approved by sla-guard after ${age}m in QA review.`);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'approved', message: `sla-guard: auto-approved after ${age}m in QA review` });
    history.push({ ...job });
    touched += 1;
  }
}

const remaining = jobs.filter((j) => !['approved', 'reverted', 'abandoned_with_reason'].includes(String(j.state || '')));
await writeJson(files.jobs, remaining);
await writeJson(files.history, history);
if (touched > 0 && remaining.length === 0) await setActiveJobLock(null);
console.log(`[sla-guard] processed ${touched} job(s)`);
