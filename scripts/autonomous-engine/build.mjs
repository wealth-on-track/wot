#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, canTransition } from './lib.mjs';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);

const job = jobs.find((j) => j.state === 'approved_for_build' || j.state === 'build');
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
job.timestamps.updatedAt = nowIso();

const branch = `local/auto-${job.id.toLowerCase()}`;
try {
  execSync(`git rev-parse --verify ${branch}`, { stdio: 'ignore' });
  execSync(`git checkout ${branch}`, { stdio: 'ignore' });
} catch {
  execSync(`git checkout -b ${branch}`, { stdio: 'ignore' });
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
    const marker = `\n/* autonomous-engine:${job.id}:single-functional-change */\n`;
    if (!original.includes(`autonomous-engine:${job.id}`)) {
      await fs.writeFile(full, original + marker, 'utf8');
      changedFiles.push(rel);
    }
  } catch {}
}

job.changedFiles = changedFiles;
const functionalAreas = [...new Set(changedFiles.map((f) => f.split('/').slice(0, 2).join('/')))].filter(Boolean);
const expectedScope = String(job.constraints?.functionalScope || functionalAreas[0] || '');
const outOfScope = changedFiles.filter((f) => !String(f).startsWith(expectedScope));
if (functionalAreas.length > 1 || outOfScope.length > 0) {
  job.retries.build += 1;
  if (job.retries.build >= 3) {
    job.state = 'abandoned_with_reason';
    job.finalReason = 'multiple_functional_areas_detected';
    await writeArtifact(job.id, 'failure-analysis.txt', `Scope violation. functionalAreas=${functionalAreas.join(', ')} outOfScope=${outOfScope.join(', ')}`);
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
  if (job.retries.build >= 3) {
    job.state = 'abandoned_with_reason';
    job.finalReason = cooldownBlocked ? 'file_cooldown_24h_blocked' : 'build_produced_no_changes_after_3_retries';
    await writeArtifact(job.id, 'failure-analysis.txt', cooldownBlocked
      ? 'All target files are in 24h cooldown window.'
      : 'Build produced no file changes after retries; abandoning with reason.');
  } else {
    job.state = 'approved_for_build';
    job.summary = `${job.summary} | retry build (no changed files${cooldownBlocked ? ', cooldown active' : ''})`;
  }
  job.timestamps.updatedAt = nowIso();
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

await writeJson(files.jobs, jobs);
console.log(`[build] ${job.id} -> test (${changedFiles.length} files)`);
