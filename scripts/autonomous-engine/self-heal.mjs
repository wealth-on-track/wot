#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const proposals = await readJson(files.proposals);

const proposalIds = new Set(proposals.map((p) => p.id));
let fixed = 0;

for (const j of jobs) {
  if (j.state !== 'proposal' && !['approved_for_build','build','test'].includes(j.state)) continue;

  const hasRef = [...proposalIds].some((id) => j.proposalId === id || String(j.proposalId || '').startsWith(String(id)));
  if (!hasRef) {
    j.state = 'proposal';
    j.quality = { status: 'needs_human_review', checkedAt: nowIso(), reason: 'self_heal_missing_proposal_ref' };
    j.timestamps.updatedAt = nowIso();
    fixed += 1;
    await appendEvent({ jobId: j.id, proposalId: j.proposalId, stage: 'proposal', message: 'Self-heal moved job to proposal due to missing proposal reference' });
  }

  if (j.state === 'proposal' && !j.quality) {
    j.quality = { status: 'pending', checkedAt: nowIso(), sessionCount: 0 };
    j.timestamps.updatedAt = nowIso();
    fixed += 1;
  }
}

await writeJson(files.jobs, jobs);
console.log(`[self-heal] fixed ${fixed} issue(s)`);
