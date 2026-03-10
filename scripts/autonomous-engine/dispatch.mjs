#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, WIP_LIMITS, appendEvent, getActiveJobLock, setActiveJobLock } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);

const buildingCount = jobs.filter((j) => ['approved_for_build', 'build'].includes(j.state)).length;
const testingCount = jobs.filter((j) => j.state === 'test').length;
const reviewReadyCount = jobs.filter((j) => j.state === 'review_ready').length;

if (reviewReadyCount >= WIP_LIMITS.reviewReady) {
  console.log('[dispatch] review_ready WIP limit reached');
  process.exit(0);
}

if (buildingCount >= WIP_LIMITS.building || testingCount >= WIP_LIMITS.testing) {
  console.log('[dispatch] build/test WIP limits reached');
  process.exit(0);
}

const lock = await getActiveJobLock();
const hasLockedActive = lock?.activeJobId && jobs.some((j) => j.id === lock.activeJobId && ['approved_for_build', 'build', 'test'].includes(j.state));
if (hasLockedActive) {
  console.log(`[dispatch] active lock in place (${lock.activeJobId})`);
  process.exit(0);
}
if (lock?.activeJobId && !hasLockedActive) {
  await setActiveJobLock(null);
}

const priorityRank = { P1: 1, P2: 2, P3: 3 };
const next = jobs
  .filter((j) => j.state === 'proposal' && j.quality?.status === 'pass')
  .sort((a, b) =>
    (priorityRank[a.priority] || 9) - (priorityRank[b.priority] || 9)
    || (Number(a.retries?.testing || 0) - Number(b.retries?.testing || 0))
    || (new Date(b.timestamps.updatedAt || b.timestamps.createdAt).getTime() - new Date(a.timestamps.updatedAt || a.timestamps.createdAt).getTime())
  )[0];

if (next) {
  next.state = 'approved_for_build';
  next.ownerAgent = 'planner';
  next.timestamps.updatedAt = nowIso();
  await writeArtifact(next.id, 'dispatch-decision.txt', `Orchestrator dispatch: proposal moved to approved_for_build with priority=${next.priority || 'P2'}.`);
  await appendEvent({ jobId: next.id, proposalId: next.proposalId, stage: 'approved_for_build', message: `Dispatched to approved_for_build (priority=${next.priority || 'P2'})` });
  await setActiveJobLock(next.id);
  console.log(`[dispatch] promoted ${next.id} to approved_for_build`);
} else {
  console.log('[dispatch] no proposal to activate');
}

await writeJson(files.jobs, jobs);
