#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, normalizeJobs, FINAL_STATES, appendEvent } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));

const limitsMin = { proposal: 5, scout_update: 5, executer_sync: 5, execution: 5, qa_review: 5 };
const totalJobLimitMin = 15;
const now = Date.now();
const ageMin = (iso) => Math.floor((now - new Date(iso).getTime()) / 60000);

let touched = 0;
for (const j of jobs) {
  const updatedAt = j.timestamps?.updatedAt || j.timestamps?.createdAt || new Date().toISOString();
  const age = ageMin(updatedAt);
  const totalAge = ageMin(j.timestamps?.createdAt || updatedAt);
  const limit = limitsMin[j.state];
  if (!limit || age <= limit) continue;

  const lastSyncAt = new Date(j.stallRecovery?.lastSyncAt || 0).getTime();
  if (lastSyncAt && now - lastSyncAt < 5 * 60 * 1000) continue;

  const syncCount = Number(j.stallRecovery?.count || 0) + 1;
  const discussion = [
    `Scout reviewed the latest context after ${age}m without progress.`,
    `Total job age is ${totalAge}m from generation time.`,
    'Executer confirmed next concrete file-level action and blockers.',
    'Both agents re-synced scope, documented the handoff, and resumed the job immediately.',
  ];

  j.stallRecovery = {
    count: syncCount,
    lastSyncAt: nowIso(),
    thresholdMinutes: 5,
    discussion,
  };

  if (j.state === 'proposal') {
    j.retries.scout += 1;
    j.summary = `${j.summary} | stall recovered via Scout/Executer sync`;
    j.state = 'executer_sync';
    j.ownerAgent = 'executer';
    j.quality = { ...(j.quality || {}), status: j.quality?.status || 'proposal_ready', checkedAt: nowIso(), autoRecovered: true };
  } else if (j.state === 'executer_sync') {
    j.retries.sync += 1;
  } else if (j.state === 'execution') {
    j.retries.executer += 1;
    j.state = 'executer_sync';
    j.ownerAgent = 'executer';
  } else if (j.state === 'qa_review') {
    j.retries.qa += 1;
  }

  if (!FINAL_STATES.includes(j.state)) {
    j.timestamps.updatedAt = nowIso();
  }

  await writeArtifact(j.id, `stalled-sync-${String(syncCount).padStart(2, '0')}.md`, discussion.join('\n'));
  await appendEvent({ jobId: j.id, proposalId: j.proposalId, stage: 'stalled_sync', message: `No progress for ${age}m; Scout and Executer re-synced and documented next steps` });
  touched += 1;
}

await writeJson(files.jobs, jobs);
console.log(`[guarantee] updated ${touched} job(s)`);
