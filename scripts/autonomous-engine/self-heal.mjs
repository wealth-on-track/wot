#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent, buildProposalIndex, proposalLineageRoot } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const proposals = await readJson(files.proposals);
const proposalIndex = buildProposalIndex(proposals);

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

const reviewReadyByRoot = new Map();
for (const job of jobs.filter((entry) => entry.state === 'review_ready')) {
  const rootId = proposalLineageRoot(job.proposalId, proposalIndex);
  if (!rootId) continue;
  const bucket = reviewReadyByRoot.get(rootId) || [];
  bucket.push(job);
  reviewReadyByRoot.set(rootId, bucket);
}

for (const [rootId, duplicates] of reviewReadyByRoot.entries()) {
  if (duplicates.length < 2) continue;
  duplicates.sort((a, b) => new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime() - new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime());
  const [, ...superseded] = duplicates;
  for (const job of superseded) {
    job.state = 'abandoned_with_reason';
    job.finalReason = `superseded_review_ready_lineage:${rootId}`;
    job.timestamps.updatedAt = nowIso();
    fixed += 1;
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'abandoned_with_reason', message: `Self-heal retired duplicate review_ready job for lineage ${rootId}` });
  }
}

await writeJson(files.jobs, jobs);
console.log(`[self-heal] fixed ${fixed} issue(s)`);
