#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, makeId, normalize, validateProposal, writeArtifact, proposalSimilarity, WIP_LIMITS, appendEvent } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);
let created = 0;

function splitProposal(p) {
  if (p.files_expected.length <= 5) return [p];
  const chunks = [];
  for (let i = 0; i < p.files_expected.length; i += 5) {
    const part = Math.floor(i / 5) + 1;
    chunks.push({
      ...p,
      id: `${p.id}-S${part}`,
      title: `${p.title} (split ${part})`,
      files_expected: p.files_expected.slice(i, i + 5),
      proposed_change: `${p.proposed_change} [split ${part}]`,
    });
  }
  return chunks;
}

for (const raw of proposals) {
  const v = validateProposal(raw);
  if (!v.ok) continue;
  if (Number(raw.impactScore || 0) < 3) continue;
  if (Number(raw.confidenceScore || 0) < 3) continue;

  const parts = splitProposal(raw);
  for (const p of parts) {
    const planningCount = jobs.filter((j) => j.state === 'proposal').length;
    if (planningCount >= WIP_LIMITS.planning) continue;

    const similarJob = jobs.find((j) => {
      const sim = proposalSimilarity(
        { title: j.title, problem: j.summary, files_expected: j.changedFiles || [] },
        { title: p.title, problem: p.problem, files_expected: p.files_expected || [] },
      );
      return sim.titleSimilar || sim.problemSimilar;
    });
    if (similarJob) {
      await writeArtifact(similarJob.id, 'proposal-merge-note.txt', `Merged duplicate proposal ${p.id}`);
      continue;
    }

    const exists = jobs.some((j) => j.proposalId === p.id || normalize(j.title) === normalize(p.title));
    if (exists) continue;

    const now = nowIso();
    const job = {
      id: makeId('JOB'),
      title: p.title,
      category: p.category,
      state: 'proposal',
      risk: p.risk,
      impact: p.impact,
      priority: p.priority,
      impactScore: p.impactScore,
      confidenceScore: p.confidenceScore,
      effortScore: p.effortScore,
      userFacing: !!p.userFacing,
      summary: p.proposed_change,
      proposalId: p.id,
      changedFiles: [],
      testResults: 'pending',
      previewInstructions: 'Run locally, verify changed files, and capture screenshots/logs for review.',
      retries: { planning: 0, build: 0, testing: 0, verification: 0 },
      constraints: { maxFiles: 5, maxFunctionalChanges: 1, noUnrelatedRefactor: true, functionalScope: String((p.files_expected?.[0] || '')).split('/').slice(0, 2).join('/') },
      ownerAgent: 'planner',
      timestamps: { createdAt: now, updatedAt: now },
    };

    jobs.push(job);
    await writeArtifact(job.id, 'proposal.json', p);
    await writeArtifact(job.id, 'dispatch-decision.txt', 'Planner created job from validated proposal and queued for approved_for_build dispatch.');
    await appendEvent({ jobId: job.id, proposalId: p.id, stage: 'proposal', message: `Planner created ${job.id} from ${p.id}` });
    created += 1;
  }
}

await writeJson(files.jobs, jobs);
console.log(`[plan] created ${created} job(s)`);
