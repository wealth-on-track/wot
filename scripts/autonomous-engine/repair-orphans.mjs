#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, makeId, appendEvent, normalizeJobs } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));
const proposals = await readJson(files.proposals);

const hasProposal = (job) => proposals.some((p) => p.id === job.proposalId || String(job.proposalId || '').startsWith(String(p.id || '')));
let repaired = 0;

for (const j of jobs) {
  if (!['proposal', 'executer_sync', 'execution', 'qa_review'].includes(j.state)) continue;
  if (hasProposal(j)) continue;

  const syntheticId = makeId('PRP');
  const synthetic = {
    id: syntheticId,
    title: j.title || `Recovered proposal for ${j.id}`,
    category: j.category || 'operations',
    problem: j.summary || 'Recovered from orphan job with missing proposal reference.',
    evidence: ['orphan repair: missing proposal reference detected'],
    proposed_change: j.summary || 'Recover proposal context and continue controlled workflow.',
    expected_benefit: 'Restores workflow continuity without silent job loss.',
    risk: j.risk || 'medium',
    impact: j.impact || 'medium',
    priority: j.priority || 'P2',
    impactScore: j.impactScore || 3,
    confidenceScore: j.confidenceScore || 3,
    effortScore: j.effortScore || 2,
    userFacing: !!j.userFacing,
    files_expected: (j.changedFiles && j.changedFiles.length ? j.changedFiles.slice(0,1) : ['src/components/PublicPortfolioView.tsx']),
    tests_required: ['lint','unit'],
    rollback_plan: 'Revert recovered proposal patch safely.',
    _planned: true,
    _plannedAt: nowIso(),
    repairedFromJobId: j.id,
  };

  proposals.push(synthetic);
  j.proposalId = syntheticId;
  j.state = 'proposal';
  j.ownerAgent = 'scout';
  j.quality = { status: 'pending', checkedAt: nowIso(), sessionCount: 0, repaired: true };
  j.timestamps.updatedAt = nowIso();
  await appendEvent({ jobId: j.id, proposalId: syntheticId, stage: 'proposal', message: `Orphan repair generated synthetic proposal ${syntheticId}` });
  repaired += 1;
}

await writeJson(files.jobs, jobs);
await writeJson(files.proposals, proposals);
console.log(`[repair-orphans] repaired ${repaired} job(s)`);
