#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, makeId, FINAL_STATES, writeArtifact } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);

const limitsMin = { planning: 10, build: 20, testing: 15, verification: 10 };
const now = Date.now();
const ageMin = (iso) => Math.floor((now - new Date(iso).getTime()) / 60000);

let touched = 0;
for (const j of jobs) {
  const updatedAt = j.timestamps?.updatedAt || j.timestamps?.createdAt || new Date().toISOString();
  const age = ageMin(updatedAt);

  if (j.state === 'proposal' && age > limitsMin.planning) {
    j.retries.planning += 1;
    if (j.retries.planning >= 3) {
      j.state = 'abandoned_with_reason';
      j.finalReason = 'planning_timeout_after_3_retries';
    }
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }

  if (j.state === 'build' && age > limitsMin.build) {
    j.retries.build += 1;
    if (j.retries.build >= 3) {
      const src = proposals.find((p) => p.id === j.proposalId);
      if (src && (src.files_expected || []).length > 1) {
        const split = {
          ...src,
          id: makeId('PRP'),
          title: `${src.title} (scope split)`,
          files_expected: [src.files_expected[0]],
          proposed_change: `${src.proposed_change} [scope-reduced]`,
        };
        proposals.push(split);
        j.state = 'abandoned_with_reason';
        j.finalReason = 'build_timeout_split_created';
      } else {
        j.state = 'abandoned_with_reason';
        j.finalReason = 'build_timeout_after_3_retries';
      }
    } else {
      j.state = 'approved_for_build';
      j.ownerAgent = 'planner';
      j.summary = `${j.summary} | retry build with reduced scope`;
    }
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }

  if (j.state === 'test' && age > limitsMin.testing) {
    j.retries.testing += 1;
    if (j.retries.testing >= 3) {
      j.state = 'abandoned_with_reason';
      j.finalReason = 'testing_timeout_after_3_retries';
      await writeArtifact(j.id, 'failure-analysis.txt', 'testing timeout repeated; abandoned with reason');
    } else {
      j.state = 'build';
      j.ownerAgent = 'builder';
    }
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }

  if (j.state === 'review_ready' && age > limitsMin.verification) {
    j.retries.verification += 1;
    if (j.retries.verification >= 3) {
      j.state = 'abandoned_with_reason';
      j.finalReason = 'human_review_timeout_after_3_retries';
    }
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }

  if (!FINAL_STATES.includes(j.state) && j.retries.build >= 3 && j.retries.testing >= 3) {
    j.state = 'abandoned_with_reason';
    j.finalReason = 'exhausted_retries';
    j.timestamps.updatedAt = nowIso();
    touched += 1;
  }
}

await writeJson(files.proposals, proposals);
await writeJson(files.jobs, jobs);
console.log(`[guarantee] updated ${touched} job(s)`);
