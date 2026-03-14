#!/usr/bin/env node
import { ensureEngineFiles, files, readJson, writeJson, appendEvent, writeArtifact, setActiveJobLock, normalizeJobs, stageAgeMinutes, transitionJob } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));

const now = Date.now();
let recovered = 0;
for (const job of [...jobs]) {
  const age = stageAgeMinutes(job, now);
  if (age < 5) continue;
  if (!['proposal', 'scout_update', 'executer_sync', 'execution', 'qa_review'].includes(String(job.state || ''))) continue;

  const unrecoverableNoDiff = String(job?.quality?.reason || '') === 'repeated_no_changed_files'
    || (Array.isArray(job?.quality?.feedback?.reject_reason_codes) && job.quality.feedback.reject_reason_codes.includes('NO_CHANGED_FILES'));

  if (unrecoverableNoDiff) {
    transitionJob(job, 'scout_update', { ownerAgent: 'scout', resetStageStartedAt: true });
    job.retries.scout = Number(job.retries?.scout || 0) + 1;
  } else {
    transitionJob(job, 'executer_sync', { ownerAgent: 'executer', resetStageStartedAt: true });
    job.retries.sync = Number(job.retries?.sync || 0) + 1;
  }

  await writeArtifact(job.id, 'stall-recovery-note.txt', `Forced live intervention after ${age}m.${unrecoverableNoDiff ? ' Returned to Scout Update for a real implementation path.' : ' Returned to Executer Sync for immediate continuation.'}`);
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: unrecoverableNoDiff ? 'scout_update' : 'executer_sync', message: `stall-guard: intervened after ${age}m and resumed live work${unrecoverableNoDiff ? ' via Scout Update' : ' via Executer Sync'}` });
  recovered += 1;
}

await writeJson(files.jobs, jobs);
await setActiveJobLock(null);
console.log(`[complete-stalled-job] recovered ${recovered} job(s)`);
