#!/usr/bin/env node
import { ensureEngineFiles, files, readJson, writeJson, normalize, appendEvent } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);

const keyOf = (p) => `${normalize(p.title)}::${(p.files_expected || []).slice(0,2).join('|')}`;
const keepMap = new Map();
const removedIds = new Set();
const removedToKept = new Map();
let merged = 0;

for (const p of proposals) {
  const key = keyOf(p);
  if (!keepMap.has(key)) {
    keepMap.set(key, p);
    continue;
  }
  const kept = keepMap.get(key);
  kept.evidence = [...new Set([...(kept.evidence || []), ...(p.evidence || [])])];
  kept.success_metrics = [...new Set([...(kept.success_metrics || []), ...(p.success_metrics || [])])];
  removedIds.add(p.id);
  removedToKept.set(p.id, kept.id);
  merged += 1;
}

if (merged > 0) {
  for (const proposal of keepMap.values()) {
    if (proposal.triagedFrom && removedToKept.has(proposal.triagedFrom)) {
      proposal.triagedFrom = removedToKept.get(proposal.triagedFrom);
    }
  }
  for (const j of jobs) {
    if (!j.proposalId) continue;
    if (!removedIds.has(j.proposalId)) continue;
    const keptId = removedToKept.get(j.proposalId);
    if (keptId) j.proposalId = keptId;
  }
  await appendEvent({ jobId: null, proposalId: null, stage: 'maintenance', message: `Proposal dedupe merged ${merged} duplicate proposal(s)` });
}

await writeJson(files.proposals, [...keepMap.values()]);
await writeJson(files.jobs, jobs);
console.log(`[dedupe-proposals] merged ${merged}`);
