#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, makeId, appendEvent } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const proposals = await readJson(files.proposals);

let triaged = 0;
const backlogCount = jobs.filter((j) => j.state === 'proposal' && j.quality?.status === 'needs_human_review').length;
const MAX_TRIAGE_PER_RUN = backlogCount >= 8 ? 5 : backlogCount >= 4 ? 3 : 2;

for (const job of jobs) {
  if (triaged >= MAX_TRIAGE_PER_RUN) break;
  if (job.state !== 'proposal') continue;
  if (job.quality?.status !== 'needs_human_review') continue;
  if (job.quality?.triagedAt) continue;

  const p = proposals.find((x) => x.id === job.proposalId || String(job.proposalId || '').startsWith(String(x.id || '')));
  if (!p) continue;

  const feedback = job.quality?.feedback || {};
  const candidates = ['src/components/PublicPortfolioView.tsx','src/components/mobile/MobileDashboard.tsx','src/components/mobile/MobileHeader.tsx'];
  const current = (p.files_expected || [])[0];
  const rotated = candidates.find((c) => c !== current) || current;

  const narrowed = {
    ...p,
    id: makeId('PRP'),
    title: `${p.title} (triaged)` ,
    problem: `${p.problem} Root-cause triage: ${(feedback.reject_reason_codes || []).join(', ') || 'quality ambiguity'}.`,
    proposed_change: `${p.proposed_change} Triage action: narrow scope to highest-leverage single file and strict acceptance checks.`,
    files_expected: [rotated].filter(Boolean),
    tests_required: ['lint', 'unit'],
    confidenceScore: Math.max(3, Number(p.confidenceScore || 0)),
    impactScore: Math.max(3, Number(p.impactScore || 0)),
    effortScore: Math.min(3, Number(p.effortScore || 3)),
    triagedFrom: p.id,
    triageReasonCodes: feedback.reject_reason_codes || [],
  };

  proposals.push(narrowed);
  job.proposalId = narrowed.id;
  job.quality = { status: 'pending', checkedAt: nowIso(), sessionCount: 0, triagedAt: nowIso(), triageFromQuality: 'needs_human_review' };
  job.retries = { planning: 0, build: 0, testing: 0, verification: 0 };
  job.summary = `${job.summary || ''} | triaged to narrower proposal scope`.trim();
  job.timestamps.updatedAt = nowIso();

  await appendEvent({ jobId: job.id, proposalId: narrowed.id, stage: 'proposal', message: `Triage created narrowed proposal ${narrowed.id} from ${p.id}` });
  triaged += 1;
}

await writeJson(files.jobs, jobs);
await writeJson(files.proposals, proposals);
console.log(`[proposal-triage] triaged ${triaged} job(s)`);
