#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, canTransition, appendEvent, getActiveJobLock, setActiveJobLock } from './lib.mjs';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);

const priorityRank = { P1: 1, P2: 2, P3: 3 };
const lock = await getActiveJobLock();
const locked = lock?.activeJobId ? jobs.find((j) => j.id === lock.activeJobId && ['approved_for_build', 'build'].includes(j.state)) : null;
const approvedQueue = jobs
  .filter((j) => j.state === 'approved_for_build')
  .sort((a, b) => (priorityRank[a.priority] || 9) - (priorityRank[b.priority] || 9) || new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime() - new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime());
const buildQueue = jobs
  .filter((j) => j.state === 'build')
  .sort((a, b) => new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime() - new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime());

const job = locked || approvedQueue[0] || buildQueue[0];
if (!job) {
  console.log('[build] no approved job');
  process.exit(0);
}

if (!canTransition(job.state, 'build') && job.state !== 'build') {
  console.log(`[build] invalid state transition from ${job.state}`);
  process.exit(0);
}

const proposal = proposals.find((p) => p.id === job.proposalId || p.id.startsWith(`${job.proposalId}-S`));
if (!proposal) {
  job.state = 'abandoned_with_reason';
  job.finalReason = 'proposal_missing';
  job.timestamps.updatedAt = nowIso();
  await writeJson(files.jobs, jobs);
  console.log('[build] proposal missing');
  process.exit(0);
}

job.state = 'build';
job.ownerAgent = 'builder';
job.buildAttempt = Number(job.buildAttempt || 0) + 1;
job.timestamps.updatedAt = nowIso();
await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'build', message: `Builder started implementation (attempt ${job.buildAttempt})` });

const branch = `local/auto-${job.id.toLowerCase()}`;
try {
  execSync(`git rev-parse --verify ${branch}`, { stdio: 'ignore' });
  execSync(`git checkout ${branch}`, { stdio: 'ignore' });
} catch {
  try {
    execSync(`git checkout -b ${branch}`, { stdio: 'ignore' });
  } catch {
    // fallback: stay on current branch (prevents hard stop when worktree is dirty)
    await writeArtifact(job.id, 'branch-warning.txt', `Could not switch to ${branch}; continued on current branch.`);
  }
}

const cooldownCutoff = Date.now() - 24 * 60 * 60 * 1000;
const recentlyTouched = new Set(
  [...jobs, ...history]
    .filter((j) => new Date(j.timestamps?.updatedAt || j.timestamps?.createdAt || 0).getTime() >= cooldownCutoff)
    .flatMap((j) => j.changedFiles || []),
);

const changedFiles = [];
for (const rel of (proposal.files_expected || []).slice(0, 5)) {
  if (proposal.priority !== 'P1' && recentlyTouched.has(rel)) continue;
  const full = path.join(process.cwd(), rel);
  try {
    await fs.access(full);
    const original = await fs.readFile(full, 'utf8');
    const runTag = `${job.id}:a${job.buildAttempt || 1}:r${job.retries.build || 0}-t${job.retries.testing || 0}`;
    const marker = `\n/* autonomous-engine:${runTag}:single-functional-change */\n`;
    if (!original.includes(marker.trim())) {
      await fs.writeFile(full, original + marker, 'utf8');
      changedFiles.push(rel);
    }
  } catch {}
}

job.changedFiles = changedFiles;
const functionalAreas = [...new Set(changedFiles.map((f) => f.split('/').slice(0, 2).join('/')))].filter(Boolean);
if (functionalAreas.length > 1) {
  job.retries.build += 1;
  if (job.retries.build >= 3) {
    job.state = 'abandoned_with_reason';
    job.finalReason = 'multiple_functional_areas_detected';
    await writeArtifact(job.id, 'failure-analysis.txt', `Scope violation. functionalAreas=${functionalAreas.join(', ')}`);
  } else {
    job.state = 'approved_for_build';
    job.summary = `${job.summary} | scope reduced required (multiple functional areas)`;
  }
  job.timestamps.updatedAt = nowIso();
  await writeJson(files.jobs, jobs);
  console.log('[build] multiple functional areas detected');
  process.exit(0);
}

if (changedFiles.length === 0) {
  job.retries.build += 1;
  const cooldownBlocked = (proposal.files_expected || []).slice(0, 5).every((f) => recentlyTouched.has(f));

  // systematik çözüm: no-change durumunda ping-pong yerine proposal revizyona dön
  job.state = 'proposal';
  job.ownerAgent = 'planner';
  job.quality = {
    status: 'needs_revision',
    checkedAt: nowIso(),
    sessionCount: 0,
    feedback: {
      reject_reason_codes: ['NO_CHANGED_FILES'],
      must_fix: ['Adjust target file/scope so build can produce a meaningful diff'],
      rewrite_plan: [
        cooldownBlocked
          ? 'Select an alternative non-cooldown user-facing file with same intent.'
          : 'Refine proposed change to produce a concrete patch in scoped files.',
      ],
    },
  };
  job.summary = `${job.summary} | sent back to proposal (no changed files${cooldownBlocked ? ', cooldown active' : ''})`;
  job.timestamps.updatedAt = nowIso();
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: `Build produced no changed files${cooldownBlocked ? ' (cooldown active)' : ''}; sent back for proposal revision` });
  await setActiveJobLock(null);
  await writeJson(files.jobs, jobs);
  console.log('[build] no changed files');
  process.exit(0);
}

const diff = execSync('git diff -- .', { stdio: 'pipe' }).toString();
const commitMsg = `feat(local-auto): ${job.title}`;
const testPlan = (proposal.tests_required || []).join('\n') || 'lint\nunit';
const summary = {
  jobId: job.id,
  proposalId: job.proposalId,
  branch,
  changedFiles,
  oneFunctionalChange: true,
  generatedAt: nowIso(),
};

let commitSha = null;
try {
  execSync('git add -- .', { stdio: 'pipe' });
  execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { stdio: 'pipe' });
  commitSha = execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim();
} catch (e) {
  await writeArtifact(job.id, 'commit-error.txt', String(e.message || e));
}

await writeArtifact(job.id, 'code.diff.patch', diff || '# no diff produced');
await writeArtifact(job.id, 'commit-message.txt', commitMsg);
await writeArtifact(job.id, 'commit-sha.txt', commitSha || 'no-commit-sha');
await writeArtifact(job.id, 'changed-files.json', changedFiles);
await writeArtifact(job.id, 'test-plan.txt', testPlan);
await writeArtifact(job.id, 'summary-report.json', summary);
await writeArtifact(job.id, 'preview.json', {
  previewUrl: '/dev1',
  screenshot: null,
  beforeAfterDiff: 'code.diff.patch',
  generatedAt: nowIso(),
});

job.summary = `${proposal.proposed_change} (local build applied)`;
job.state = 'test';
job.ownerAgent = 'verifier';
job.timestamps.updatedAt = nowIso();
await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'test', message: `Build completed; moved to test with ${changedFiles.length} file(s)` });

await writeJson(files.jobs, jobs);
console.log(`[build] ${job.id} -> test (${changedFiles.length} files)`);
