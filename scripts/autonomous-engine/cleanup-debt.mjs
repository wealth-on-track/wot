#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent, normalizeJobs } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));
const history = normalizeJobs(await readJson(files.history));

let cleaned = 0;
const keptHistory = [];
for (const h of history) {
  // Keep approved/reverted; prune old abandoned debt records from legacy runs
  if (h.state === 'abandoned_with_reason') {
    cleaned += 1;
    continue;
  }
  keptHistory.push(h);
}

if (cleaned > 0) {
  await appendEvent({ jobId: null, proposalId: null, stage: 'maintenance', message: `Debt cleanup pruned ${cleaned} abandoned history records` });
}

// Also normalize live abandoned jobs back to proposal rework queue
for (const j of jobs) {
  if (j.state !== 'abandoned_with_reason') continue;
  j.state = 'proposal';
  j.ownerAgent = 'scout';
  j.finalReason = undefined;
  j.quality = { status: 'needs_human_review', checkedAt: nowIso(), sessionCount: Number(j.quality?.sessionCount || 0), reason: 'legacy_abandoned_requeued' };
  j.retries = { scout: 0, sync: 0, executer: 0, qa: 0 };
  j.timestamps.updatedAt = nowIso();
  cleaned += 1;
}

await writeJson(files.jobs, jobs);
await writeJson(files.history, keptHistory.slice(-1500));
console.log(`[cleanup-debt] cleaned ${cleaned} record(s)`);
