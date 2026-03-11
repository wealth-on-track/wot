#!/usr/bin/env node
import { ensureEngineFiles, files, readJson } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const proposals = await readJson(files.proposals);

const issues = [];
const add = (sev, code, msg) => issues.push({ sev, code, msg });

const jobIdCount = new Map();
for (const j of jobs) jobIdCount.set(j.id, (jobIdCount.get(j.id) || 0) + 1);
for (const [id, c] of jobIdCount.entries()) if (c > 1) add('critical', 'DUP_JOB_ID', `${id} appears ${c} times`);

const proposalIdCount = new Map();
for (const p of proposals) proposalIdCount.set(p.id, (proposalIdCount.get(p.id) || 0) + 1);
for (const [id, c] of proposalIdCount.entries()) if (c > 1) add('critical', 'DUP_PROPOSAL_ID', `${id} appears ${c} times`);

const proposalIds = new Set(proposals.map((p) => p.id));
for (const j of jobs) {
  if (['proposal', 'approved_for_build', 'build', 'test'].includes(j.state)) {
    const ok = [...proposalIds].some((id) => j.proposalId === id || String(j.proposalId || '').startsWith(String(id)));
    if (!ok) add('critical', 'ORPHAN_JOB', `${j.id} has missing proposal ${j.proposalId}`);
  }
}

const active = jobs.filter((j) => ['approved_for_build', 'build', 'test'].includes(j.state));
if (active.length > 1) add('high', 'MULTI_ACTIVE', `active queue has ${active.length} jobs`);

const badQuality = jobs.filter((j) => j.state === 'proposal' && !j.quality);
if (badQuality.length) add('high', 'MISSING_QUALITY', `${badQuality.length} proposal jobs missing quality object`);

const byState = jobs.reduce((a, j) => (a[j.state] = (a[j.state] || 0) + 1, a), {});
const out = {
  ok: !issues.some((i) => i.sev === 'critical'),
  counts: { jobs: jobs.length, proposals: proposals.length, byState },
  issues,
};

console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
