#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, canTransition, appendEvent, getActiveJobLock, setActiveJobLock, withEngineRunLock } from './lib.mjs';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';

async function main() {
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
    return;
  }

  if (!canTransition(job.state, 'build') && job.state !== 'build') {
    console.log(`[build] invalid state transition from ${job.state}`);
    return;
  }

  const proposal = proposals.find((p) => p.id === job.proposalId || p.id.startsWith(`${job.proposalId}-S`));
  if (!proposal) {
    job.state = 'abandoned_with_reason';
    job.finalReason = 'proposal_missing';
    job.timestamps.updatedAt = nowIso();
    await setActiveJobLock(null);
    await writeJson(files.jobs, jobs);
    console.log('[build] proposal missing');
    return;
  }

  const enteringBuild = job.state === 'approved_for_build';
  job.state = 'build';
  job.ownerAgent = 'builder';
  job.buildAttempt = enteringBuild ? (Number(job.buildAttempt || 0) + 1) : Number(job.buildAttempt || 1);
  job.timestamps.updatedAt = nowIso();
  if (enteringBuild) {
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'build', message: `Builder started implementation (attempt ${job.buildAttempt})` });
  }

  const branch = `local/auto-${job.id.toLowerCase()}`;
  try {
    execSync(`git rev-parse --verify ${branch}`, { stdio: 'ignore' });
    execSync(`git checkout ${branch}`, { stdio: 'ignore' });
  } catch {
    try {
      execSync(`git checkout -b ${branch}`, { stdio: 'ignore' });
    } catch {
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
  const changeSpecFiles = Array.isArray(proposal.change_spec)
    ? proposal.change_spec.map((x) => x?.file).filter(Boolean)
    : [];
  const targetFiles = [...new Set([...changeSpecFiles, ...(proposal.files_expected || [])])].slice(0, 5);
  job.quality = { ...(job.quality || {}), lastTriedFile: targetFiles[0] || null };

  const hasTrackedDiff = (rel) => {
    try {
      const output = execSync(`git diff --name-only -- ${JSON.stringify(rel)}`, { stdio: 'pipe' }).toString().trim();
      if (output) return true;
    } catch {}
    try {
      const output = execSync(`git diff --cached --name-only -- ${JSON.stringify(rel)}`, { stdio: 'pipe' }).toString().trim();
      if (output) return true;
    } catch {}
    try {
      const output = execSync(`git ls-files --others --exclude-standard -- ${JSON.stringify(rel)}`, { stdio: 'pipe' }).toString().trim();
      if (output) return true;
    } catch {}
    return false;
  };

  for (const rel of targetFiles) {
    const cooldownApplies = proposal.priority !== 'P1' && recentlyTouched.has(rel) && Number(job.retries?.build || 0) < 1;
    if (cooldownApplies) continue;
    try {
      await fs.access(rel);
      if (hasTrackedDiff(rel)) {
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
    return;
  }

  if (changedFiles.length === 0) {
    job.retries.build += 1;
    const cooldownBlocked = Number(job.retries?.build || 0) <= 1 && (proposal.files_expected || []).slice(0, 5).every((f) => recentlyTouched.has(f));

    job.state = 'proposal';
    job.ownerAgent = 'planner';
    job.quality = {
      status: 'needs_human_review',
      checkedAt: nowIso(),
      sessionCount: Number(job.quality?.sessionCount || 0),
      reason: 'missing_implementation_diff',
      feedback: {
        reject_reason_codes: ['NO_CHANGED_FILES'],
        must_fix: ['Apply a real scoped code change before redispatch'],
        rewrite_plan: [
          cooldownBlocked
            ? 'Wait for cooldown or make an explicit implementation change in a different scoped file before retrying.'
            : 'Add the intended implementation diff in the scoped file, then rerun dispatch/build.',
        ],
      },
    };
    job.summary = `${job.summary} | halted: no implementation diff${cooldownBlocked ? ' (cooldown active)' : ''}`;
    job.timestamps.updatedAt = nowIso();
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: `Build produced no changed files${cooldownBlocked ? ' (cooldown active)' : ''}; escalated for human implementation review` });
    await setActiveJobLock(null);
    await writeJson(files.jobs, jobs);
    console.log('[build] no changed files');
    return;
  }

  let diff = '# no diff produced';
  try {
    const targets = (changedFiles || []).map((f) => `"${f}"`).join(' ');
    const cmd = targets ? `git diff -- ${targets}` : 'git diff -- .';
    diff = execSync(cmd, { stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 }).toString() || '# no diff produced';
  } catch {
    diff = '# diff capture failed (fallback)';
  }
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
    const gitTargets = changedFiles.map((file) => JSON.stringify(file)).join(' ');
    execSync(`git add -- ${gitTargets}`, { stdio: 'pipe' });
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
}

const lockResult = await withEngineRunLock('build-run', main, { staleMs: 15 * 60 * 1000 });
if (lockResult?.skipped) {
  console.log(`[build] skipped (${lockResult.reason})`);
}
