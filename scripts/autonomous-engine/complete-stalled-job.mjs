#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent, writeArtifact, setActiveJobLock, normalizeJobs } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));
const history = await readJson(files.history);

const now = Date.now();
const ageMin = (job) => Math.floor((now - new Date(job.timestamps?.updatedAt || job.timestamps?.createdAt || 0).getTime()) / 60000);

let recovered = 0;
for (const job of [...jobs]) {
  const age = ageMin(job);
  if (age < 15) continue;
  if (!['proposal', 'scout_update', 'executer_sync', 'execution', 'qa_review'].includes(String(job.state || ''))) continue;

  const unrecoverableNoDiff = String(job?.quality?.reason || '') === 'repeated_no_changed_files'
    || (Array.isArray(job?.quality?.feedback?.reject_reason_codes) && job.quality.feedback.reject_reason_codes.includes('NO_CHANGED_FILES'));

  if (unrecoverableNoDiff) {
    job.state = 'scout_update';
    job.ownerAgent = 'scout';
    job.retries.scout = Number(job.retries?.scout || 0) + 1;
  } else {
    job.state = 'executer_sync';
    job.ownerAgent = 'executer';
    job.retries.sync = Number(job.retries?.sync || 0) + 1;
  }

  job.timestamps.updatedAt = nowIso();
  await writeArtifact(job.id, 'stall-recovery-note.txt', `Forced live intervention after ${age}m.${unrecoverableNoDiff ? ' Returned to Scout Update for a real implementation path.' : ' Returned to Executer Sync for immediate continuation.'}`);
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: unrecoverableNoDiff ? 'scout_update' : 'executer_sync', message: `stall-guard: intervened after ${age}m and resumed live work${unrecoverableNoDiff ? ' via Scout Update' : ' via Executer Sync'}` });
  recovered += 1;
}

await writeJson(files.jobs, jobs);
await setActiveJobLock(null);
console.log(`[complete-stalled-job] recovered ${recovered} job(s)`);
