#!/usr/bin/env node
import { execSync } from 'child_process';
import { ensureEngineFiles, files, nowIso, readJson, makeId, appendEvent, normalizeJobs, isActiveState, proposalSimilarity, writeJson } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = normalizeJobs(await readJson(files.jobs));
const history = await readJson(files.history);

if (jobs.some((j) => isActiveState(j?.state))) {
  console.log('[hourly-guarantee] skipped (active job in progress)');
  process.exit(0);
}

const openQueue = proposals.filter((p) => !p?._planned);
if (openQueue.length > 0) {
  console.log(`[hourly-guarantee] skipped (${openQueue.length} open proposal(s) already queued)`);
  process.exit(0);
}

const now = Date.now();
const WINDOW_MS = 20 * 60 * 1000;
const recentTs = [];
for (const item of [...proposals, ...jobs, ...history]) {
  const ts = new Date(item?.timestamps?.createdAt || item?.timestamps?.updatedAt || item?.createdAt || item?._plannedAt || 0).getTime();
  if (Number.isFinite(ts) && ts > 0) recentTs.push(ts);
}
const latest = recentTs.length ? Math.max(...recentTs) : 0;
if (latest && (now - latest) < WINDOW_MS) {
  console.log('[hourly-guarantee] skipped (recent job/proposal exists)');
  process.exit(0);
}

try {
  execSync('node scripts/autonomous-engine/discover.mjs', { stdio: 'inherit', timeout: 120000 });
} catch {}

const refreshedProposals = await readJson(files.proposals);
const refreshedOpenQueue = refreshedProposals.filter((p) => !p?._planned);
if (refreshedOpenQueue.length > 0) {
  console.log(`[hourly-guarantee] satisfied by discover (${refreshedOpenQueue.length} open proposal(s))`);
  process.exit(0);
}

const proposal = {
  id: makeId('PRP'),
  title: `Hourly guarantee premium fallback (${nowIso().slice(0, 16)})`,
  category: 'ux',
  problem: 'No new autonomous work was produced within the last 20 minutes and discovery returned no open proposal.',
  evidence: ['hourly_guarantee: no_new_job_within_20m', 'single-job policy preserved', 'discover_returned_zero_open_proposals'],
  proposed_change: 'Create one safe, scoped user-facing improvement so the autonomous engine never goes silent for more than 20 minutes.',
  expected_benefit: 'Keeps the system productive and continuously improving without emitting duplicate backlog spam.',
  risk: 'low',
  impact: 'medium',
  priority: 'P1',
  impactScore: 4,
  confidenceScore: 4,
  effortScore: 1,
  userFacing: true,
  success_metrics: ['One new scoped proposal created', 'Single active job policy preserved'],
  non_goals: ['No backend redesign', 'No deploy'],
  files_expected: ['src/components/PublicPortfolioView.tsx'],
  tests_required: ['build'],
  change_spec: [{
    file: 'src/components/PublicPortfolioView.tsx',
    change: 'Apply one small premium UX refinement.',
    why: 'Reliable low-risk continuity path when primary discovery yields nothing.'
  }],
  kpi_target: 'At least one fresh scoped pilot per 20 minutes when the queue is empty.',
  benchmark_delta: 'Prevent idle 20-minute gaps in the autonomous iteration loop.',
  risk_controls: ['Single file only', 'Single active job only', 'Rollback via git'],
  createdAt: nowIso(),
};

const duplicate = [...refreshedProposals, ...history].find((item) => {
  const sim = proposalSimilarity(item, proposal);
  return sim.titleSimilar || (sim.problemSimilar && sim.fileOverlap > 0);
});

if (duplicate) {
  console.log(`[hourly-guarantee] skipped (duplicate of ${duplicate.id || duplicate.title})`);
  process.exit(0);
}

refreshedProposals.push(proposal);
await writeJson(files.proposals, refreshedProposals);
await appendEvent({ jobId: null, proposalId: proposal.id, stage: 'proposal', message: 'hourly-guarantee: seeded fallback proposal after idle window' });
console.log(`[hourly-guarantee] created ${proposal.id}`);
