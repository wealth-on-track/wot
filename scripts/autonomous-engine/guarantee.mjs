#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, makeId, FINAL_STATES, writeArtifact } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);

const limitsMin = { planning: 10, build: 20, testing: 15, verification: 10 };
const now = Date.now();
const ageMin = (iso) => Math.floor((now - new Date(iso).getTime()) / 60000);

let touched = 0;
for (const j of jobs) {
  const updatedAt = j.timestamps?.updatedAt || j.timestamps?.createdAt || new Date().toISOString();
  const age = ageMin(updatedAt);

  if (j.state === 'proposal' && age > limitsMin.planning) {
    j.retries.planning += 1;
    // keep simple: do not abandon proposal; mark for human attention after retries
    if (j.retries.planning >= 3) {
      j.quality = { ...(j.quality || {}), status: 'needs_human_review', checkedAt: nowIso(), reason: 'planning_timeout' };
    }
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }

  if (j.state === 'build' && age > limitsMin.build) {
    j.retries.build += 1;
    if (j.retries.build >= 3) {
      j.state = 'proposal';
      j.ownerAgent = 'planner';
      j.quality = { ...(j.quality || {}), status: 'pending', checkedAt: nowIso(), reason: 'build_timeout_rework' };
      j.summary = `${j.summary} | build timed out, sent back to proposal rework`;
    } else {
      j.state = 'approved_for_build';
      j.ownerAgent = 'planner';
      j.summary = `${j.summary} | retry build with reduced scope`;
    }
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }

  if (j.state === 'test' && age > limitsMin.testing) {
    j.retries.testing += 1;
    if (j.retries.testing >= 3) {
      j.state = 'proposal';
      j.ownerAgent = 'planner';
      j.quality = { ...(j.quality || {}), status: 'pending', checkedAt: nowIso(), reason: 'testing_timeout_rework' };
      await writeArtifact(j.id, 'failure-analysis.txt', 'testing timeout repeated; sent back to proposal rework');
    } else {
      j.state = 'build';
      j.ownerAgent = 'builder';
    }
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }

  if (j.state === 'review_ready' && age > limitsMin.verification) {
    // keep review items visible; no auto-abandon or timestamp churn
    // nudge at most once per hour to avoid retry inflation / ping-pong metrics
    const lastNudgeAt = new Date(j.reviewNudgeAt || 0).getTime();
    const oneHourMs = 60 * 60 * 1000;
    if (!Number.isFinite(lastNudgeAt) || (Date.now() - lastNudgeAt) >= oneHourMs) {
      j.retries.verification += 1;
      j.reviewNudgeAt = nowIso();
      touched += 1;
    }
  }

  if (!FINAL_STATES.includes(j.state) && j.retries.build >= 3 && j.retries.testing >= 3) {
    j.state = 'proposal';
    j.ownerAgent = 'planner';
    j.quality = { ...(j.quality || {}), status: 'needs_human_review', checkedAt: nowIso(), reason: 'exhausted_retries_rework' };
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }
}

await writeJson(files.proposals, proposals);
await writeJson(files.jobs, jobs);
console.log(`[guarantee] updated ${touched} job(s)`);
