#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);

const hasActive = jobs.some((j) => ['approved_for_build', 'build', 'test'].includes(j.state));
if (!hasActive) {
  const next = jobs.find((j) => j.state === 'proposal');
  if (next) {
    next.state = 'approved_for_build';
    next.ownerAgent = 'planner';
    next.timestamps.updatedAt = nowIso();
    await writeArtifact(next.id, 'dispatch-decision.txt', 'Orchestrator dispatch: proposal moved to approved_for_build.');
    console.log(`[dispatch] promoted ${next.id} to approved_for_build`);
  } else {
    console.log('[dispatch] no proposal to activate');
  }
} else {
  console.log('[dispatch] active job already exists');
}

await writeJson(files.jobs, jobs);
