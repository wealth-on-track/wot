#!/usr/bin/env node
import { ensureEngineFiles, files, readJson, writeJson, appendEvent } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);

const isLow = (p) => {
  const t = `${p.problem || ''} ${p.proposed_change || ''} ${p.expected_benefit || ''}`.toLowerCase();
  const hasPlan = Array.isArray(p.change_spec) && p.change_spec.some((x) => x?.file && x?.change && String(x.change).length > 20);
  const hasKpi = p.kpi_target && String(p.kpi_target).trim().length > 8;
  const hasDelta = p.benchmark_delta && String(p.benchmark_delta).trim().length > 8;
  const generic = t.includes('scope: deliver one focused functional improvement') || t.includes('implementation approach: touch only the highest-leverage files');
  return !hasPlan || !hasKpi || !hasDelta || generic;
};

const kept = [];
const removedIds = new Set();
for (const p of proposals) {
  if (isLow(p)) removedIds.add(p.id);
  else kept.push(p);
}

let moved = 0;
for (const j of jobs) {
  if (!removedIds.has(j.proposalId || '')) continue;
  j.state = 'proposal';
  j.quality = { status: 'needs_human_review', checkedAt: new Date().toISOString(), reason: 'proposal_purged_low_quality' };
  moved += 1;
}

await writeJson(files.proposals, kept);
await writeJson(files.jobs, jobs);
if (removedIds.size) {
  await appendEvent({ jobId: null, proposalId: null, stage: 'maintenance', message: `Purged ${removedIds.size} low-quality proposal(s)` });
}
console.log(`[purge-low-quality] removed=${removedIds.size} jobs_moved=${moved}`);
