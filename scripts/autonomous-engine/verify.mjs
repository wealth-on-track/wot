#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, canTransition, appendEvent, setActiveJobLock, withEngineRunLock, normalizeJobs, capturePublicPreview, transitionJob, finalizeJob, approvedJobSummary } from './lib.mjs';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  await ensureEngineFiles();
  const jobs = normalizeJobs(await readJson(files.jobs));
  const proposals = await readJson(files.proposals);
  const job = jobs.find((j) => j.state === 'qa_review');
  if (!job) {
    console.log('[verify] no job');
    return;
  }

  if (!canTransition('qa_review', 'approved')) {
    console.log('[verify] invalid workflow graph');
    process.exit(1);
  }

  const proposal = proposals.find((p) => p.id === job.proposalId || p.id.startsWith(`${job.proposalId}-S`));
  const requiredSet = new Set((proposal?.tests_required || ['lint']).map((x) => String(x).toLowerCase()));

  job.ownerAgent = 'qa';
  job.timestamps.updatedAt = nowIso();

  const fileArgs = (job.changedFiles || []).filter(Boolean).join(' ');
  const lintCmd = fileArgs ? `npx eslint ${fileArgs}` : 'npm run -s lint';

  const changedEnv = `CHANGED_FILES=${(job.changedFiles || []).join(',')}`;
  const commands = [
    { name: 'lint', cmd: lintCmd, required: requiredSet.has('lint') },
    { name: 'unit', cmd: `${changedEnv} node scripts/autonomous-engine/check-unit.mjs`, required: requiredSet.has('unit') },
    { name: 'security', cmd: 'npm audit --audit-level=high', required: requiredSet.has('security') || job.category === 'security' },
    { name: 'integration', cmd: `${changedEnv} node scripts/autonomous-engine/check-integration.mjs`, required: requiredSet.has('integration') },
    { name: 'e2e', cmd: 'node scripts/autonomous-engine/check-e2e.mjs', required: requiredSet.has('e2e') },
    { name: 'performance', cmd: 'node scripts/autonomous-engine/check-performance.mjs', required: requiredSet.has('performance') || job.category === 'performance' || job.category === 'benchmark' },
  ];

  const run = ({ name, cmd, required }) => {
    if (!required) return { check: name, cmd, status: 'skipped' };
    try {
      execSync(cmd, { stdio: 'pipe', timeout: 180000 });
      return { check: name, cmd, status: 'pass' };
    } catch (e) {
      return { check: name, cmd, status: 'fail', error: String(e.message || e) };
    }
  };

  const results = commands.map(run);
  const allPass = results.filter((r) => r.status !== 'skipped').every((r) => r.status === 'pass');
  job.testResults = allPass ? 'pass' : 'fail';

  await writeArtifact(job.id, 'verification-results.json', results);

  if (allPass) {
    transitionJob(job, 'approved', { ownerAgent: 'qa' });
    try {
      await fs.unlink(path.join(process.cwd(), 'Agent Team', 'autonomous-engine', 'artifacts', job.id, 'failure-analysis.txt'));
    } catch {}
    const outputPath = path.join(process.cwd(), 'Agent Team', 'autonomous-engine', 'artifacts', job.id, 'after-page.png');
    const captureResult = await capturePublicPreview(outputPath);
    if (!captureResult.ok) {
      await writeArtifact(job.id, 'after-screenshot-error.txt', captureResult.error);
    }
    await writeArtifact(job.id, 'completion-summary.txt', approvedJobSummary(job, proposal));
    await writeArtifact(job.id, 'approval-note.txt', 'Auto-completed after passing all required checks.');
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'approved', message: 'Auto-completed after passing required checks' });
  } else {
    job.retries.qa += 1;
    const failedChecks = results.filter((r) => r.status === 'fail').map((r) => r.check);
    const feedback = {
      reject_reason_codes: ['VERIFY_FAIL'],
      must_fix: failedChecks,
      rewrite_plan: [
        'Address failing checks only (keep scope small).',
        'Update proposal evidence and tests_required to match failure cause.',
        'Return to Scout, refresh the handoff, and resubmit through QA.',
      ],
    };

    transitionJob(job, 'proposal', { ownerAgent: 'scout' });
    job.quality = {
      status: 'needs_revision',
      checkedAt: nowIso(),
      sessionCount: Number(job.quality?.sessionCount || 0),
      feedback,
    };
    await writeArtifact(job.id, 'failure-analysis.txt', `Verification failed checks: ${failedChecks.join(', ')}`);
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: `QA failed (${failedChecks.join(', ')}); returned to Scout for revision` });
  }

  job.timestamps.updatedAt = nowIso();

  if (job.state === 'approved') {
    const history = await readJson(files.history);
    await finalizeJob(jobs, history, job);
  } else {
    await setActiveJobLock(null);
    await writeJson(files.jobs, jobs);
  }

  console.log(`[verify] ${job.id} => ${job.testResults}`);
}

const lockResult = await withEngineRunLock('verify-run', main, { staleMs: 15 * 60 * 1000 });
if (lockResult?.skipped) {
  console.log(`[verify] skipped (${lockResult.reason})`);
}
