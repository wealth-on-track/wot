#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, canTransition, appendEvent, getActiveJobLock, setActiveJobLock, withEngineRunLock, normalizeJobs, capturePublicPreview, transitionJob } from './lib.mjs';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const makePreviewSvg = ({ label, file, content }) => {
  const lines = String(content || '').split('\n').slice(0, 18).map((line) => line.slice(0, 92));
  const text = lines.map((line, i) => `<tspan x="24" dy="${i === 0 ? 0 : 18}">${escapeXml(line || ' ')}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <rect width="1200" height="720" rx="24" fill="#0f172a"/>
    <rect x="20" y="20" width="1160" height="680" rx="18" fill="#111827" stroke="#334155"/>
    <text x="24" y="48" fill="#93c5fd" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="700">${escapeXml(label)}</text>
    <text x="24" y="78" fill="#cbd5e1" font-size="18" font-family="Inter, Arial, sans-serif">${escapeXml(file || '-')}</text>
    <text x="24" y="130" fill="#e2e8f0" font-size="16" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${text}</text>
  </svg>`;
};

async function main() {
  await ensureEngineFiles();
  const proposals = await readJson(files.proposals);
  const jobs = normalizeJobs(await readJson(files.jobs));
  const history = await readJson(files.history);

  const priorityRank = { P1: 1, P2: 2, P3: 3 };
  const lock = await getActiveJobLock();
  const locked = lock?.activeJobId ? jobs.find((j) => j.id === lock.activeJobId && ['executer_sync', 'execution'].includes(j.state)) : null;
  const syncQueue = jobs
    .filter((j) => j.state === 'executer_sync')
    .sort((a, b) => (priorityRank[a.priority] || 9) - (priorityRank[b.priority] || 9) || new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime() - new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime());
  const executionQueue = jobs
    .filter((j) => j.state === 'execution')
    .sort((a, b) => new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime() - new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime());

  const job = locked || syncQueue[0] || executionQueue[0];
  if (!job) {
    console.log('[build] no executer job');
    return;
  }

  if (!canTransition(job.state, 'execution') && job.state !== 'execution') {
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

  const enteringExecution = job.state === 'executer_sync';
  transitionJob(job, 'execution', { ownerAgent: 'executer' });
  job.buildAttempt = enteringExecution ? (Number(job.buildAttempt || 0) + 1) : Number(job.buildAttempt || 1);
  if (enteringExecution) {
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'execution', message: `Executer started implementation (attempt ${job.buildAttempt})` });
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

  let beforePreviewPayload = { file: targetFiles[0] || '-', content: '' };
  let afterPreviewPayload = { file: targetFiles[0] || '-', content: '' };

  const applyDeterministicPilotPatch = async () => {
    const primaryFile = targetFiles[0];
    const instructionText = `${proposal.title || ''} ${proposal.problem || ''} ${proposal.proposed_change || ''}`.toLowerCase();
    const source = await fs.readFile(primaryFile, 'utf8');
    let next = source;
    beforePreviewPayload = { file: primaryFile, content: source };

    if (primaryFile === 'src/components/PublicPortfolioView.tsx') {
      if (/(zero|neutral|mis-color|miscolor|return tone|first-read context|kicker)/.test(instructionText)) {
        next = next.replace(
          `  if (typeof value !== "number") return "public-allocation-pill is-neutral";\n  return value >= 0 ? "public-allocation-pill is-positive" : "public-allocation-pill is-negative";\n`,
          `  if (typeof value !== "number" || value === 0) return "public-allocation-pill is-neutral";\n  return value > 0 ? "public-allocation-pill is-positive" : "public-allocation-pill is-negative";\n`,
        );
        next = next.replace(
          `        <div className="public-allocation-summary-head">\n          <div className="public-allocation-title">Portfolio Allocation</div>\n`,
          `        <div className="public-allocation-summary-head">\n          <div>\n            <div className="public-allocation-title">Portfolio Allocation</div>\n            <div className="public-allocation-summary-kicker">First-read breakdown with quick return context</div>\n          </div>\n`,
        );
      } else if (/(default|auto-expand|auto expand|strongest|largest category|first render)/.test(instructionText)) {
        next = next.replace(
          `  const [expanded, setExpanded] = useState<Set<string>>(new Set());\n`,
          `  const [expanded, setExpanded] = useState<Set<string>>(() => {\n    const strongest = [...initialCategories].sort((a, b) => b.pct - a.pct)[0]?.name;\n    return strongest ? new Set([strongest]) : new Set();\n  });\n`,
        );
      } else if (/(summary|meta|badge|scan|glance|quick stats|quick scan)/.test(instructionText)) {
        next = next.replace(
          `        <div className="public-allocation-summary-meta">\n          <span>{categories.length} categories · {totalItems} holdings</span>\n`,
          `        <div className="public-allocation-summary-meta">\n          <span>{categories.length} categories · {totalItems} holdings</span>\n          <span>{allExpanded ? "All categories expanded" : "Top category open by default"}</span>\n`,
        );
      } else if (/(read-only|readonly|visitor|public view)/.test(instructionText)) {
        next = next.replace(
          `{canEdit ? <span>Drag holdings between categories to reorganize</span> : <span>Public read-only view</span>}\n`,
          `{canEdit ? <span>Drag holdings between categories to reorganize</span> : <span>Public read-only snapshot · owner controls stay private</span>}\n`,
        );
      } else if (/(collapse|expand all|toggle clarity|toggle label)/.test(instructionText)) {
        next = next.replace(
          `{allExpanded ? "Collapse all" : "Expand all"}\n`,
          `{allExpanded ? "Collapse categories" : "Expand categories"}\n`,
        );
      } else if (/(trust|brand|premium|confidence|assurance)/.test(instructionText)) {
        next = next.replace(
          `            <div className="public-allocation-summary-kicker">First-read breakdown with quick return context</div>\n`,
          `            <div className="public-allocation-summary-kicker">First-read breakdown with quick return context</div>\n            <div className="public-allocation-summary-kicker">Secure read-only snapshot with live allocation ordering</div>\n`,
        );
      }
    } else if (primaryFile === 'src/app/[username]/portfolio_public/page.tsx') {
      if (/(password|wrong password|unlock|access clarity)/.test(instructionText)) {
        next = next.replace(
          `{sp.e ? <div className="public-access-gate-error">Wrong password. Please try again.</div> : null}\n`,
          `{sp.e ? <div className="public-access-gate-error">Wrong password. Please try again or confirm the latest share code with the owner.</div> : null}\n`,
        );
      } else if (/(private link|protected portfolio|secure share|trust framing)/.test(instructionText)) {
        next = next.replace(
          `<div className="public-access-gate-kicker">Private link</div>\n          <div className="public-access-gate-title">Protected portfolio</div>\n          <div className="public-access-gate-copy">Enter the access password to view this public snapshot.</div>\n`,
          `<div className="public-access-gate-kicker">Secure share link</div>\n          <div className="public-access-gate-title">Protected portfolio snapshot</div>\n          <div className="public-access-gate-copy">Enter the access password to view this read-only portfolio snapshot.</div>\n`,
        );
      } else if (/(reshare|re-share|share readiness|before sharing)/.test(instructionText)) {
        next = next.replace(
          `              <li>Re-share only after at least one allocation category and percentage is visible.</li>\n`,
          `              <li>Re-share only after at least one allocation category and percentage is visible.</li>\n              <li>Before sharing again, confirm the snapshot reads clearly on mobile and desktop.</li>\n`,
        );
      } else if (/(not found|missing portfolio|clarify missing)/.test(instructionText)) {
        next = next.replace(
          `  if (!user?.Portfolio) return <div className="public-access-empty">Portfolio not found.</div>;\n`,
          `  if (!user?.Portfolio) return <div className="public-access-empty">Portfolio not found. Ask the owner to enable a shareable portfolio first.</div>;\n`,
        );
      } else if (/(empty|onboarding|first holdings|first holding|owner|visitor|empty state|microcopy|first-read clarity|trust signal|public portfolio page)/.test(instructionText)) {
        next = next.replace(
          `          You are in the right place. This secure link is live and read-only. After the first active holding is added,\n          this page refreshes into a full allocation and performance view for the latest snapshot.\n`,
          `          You are in the right place. This secure link is live and read-only. After the first active holding is added,\n          this page refreshes into a full allocation and performance view for the latest snapshot. Nothing is broken — the portfolio is simply waiting for its first visible position.\n`,
        );
        next = next.replace(
          `          <div className="public-access-gate-copy">Enter the access password to view this read-only portfolio snapshot.</div>\n`,
          `          <div className="public-access-gate-copy">Enter the access password to view this read-only portfolio snapshot with the latest visible allocation layout.</div>\n`,
        );
      }
    }

    afterPreviewPayload = { file: primaryFile, content: next };

    if (next !== source) {
      await fs.writeFile(primaryFile, next, 'utf8');
    }
  };

  try {
    await applyDeterministicPilotPatch();
  } catch (error) {
    await writeArtifact(job.id, 'executor-codex-error.txt', String(error?.stderr || error?.stdout || error?.message || error));
  }

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
    const cooldownApplies = proposal.priority !== 'P1' && recentlyTouched.has(rel) && Number(job.retries?.executer || 0) < 1;
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
    job.retries.executer += 1;
    if (job.retries.executer >= 3) {
      job.state = 'abandoned_with_reason';
      job.finalReason = 'multiple_functional_areas_detected';
      await writeArtifact(job.id, 'failure-analysis.txt', `Scope violation. functionalAreas=${functionalAreas.join(', ')}`);
    } else {
      job.state = 'executer_sync';
      job.summary = `${job.summary} | scope reduced required (multiple functional areas)`;
    }
    job.timestamps.updatedAt = nowIso();
    await writeJson(files.jobs, jobs);
    console.log('[build] multiple functional areas detected');
    return;
  }

  if (changedFiles.length === 0) {
    const primaryFile = targetFiles[0];
    const recentApprovedSameFile = [...history]
      .filter((entry) => entry?.state === 'approved')
      .find((entry) => Array.isArray(entry?.changedFiles) && entry.changedFiles.includes(primaryFile));

    if (recentApprovedSameFile) {
      job.state = 'abandoned_with_reason';
      job.finalReason = 'already_satisfied_duplicate';
      job.ownerAgent = 'scout';
      job.timestamps.updatedAt = nowIso();
      await writeArtifact(job.id, 'duplicate-resolution.txt', `No implementation diff was needed because ${primaryFile} was already changed by approved job ${recentApprovedSameFile.id}.`);
      await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'abandoned_with_reason', message: `Executer found no remaining diff; duplicate path already satisfied by ${recentApprovedSameFile.id}` });
      history.push({ ...job });
      await setActiveJobLock(null);
      await writeJson(files.history, history);
      await writeJson(files.jobs, jobs.filter((j) => j.id !== job.id));
      console.log('[build] duplicate path already satisfied');
      return;
    }

    job.retries.executer += 1;
    const cooldownBlocked = Number(job.retries?.executer || 0) <= 1 && (proposal.files_expected || []).slice(0, 5).every((f) => recentlyTouched.has(f));

    job.state = 'scout_update';
    job.ownerAgent = 'scout';
    job.quality = {
      status: 'needs_human_review',
      checkedAt: nowIso(),
      sessionCount: Number(job.quality?.sessionCount || 0),
      reason: 'missing_implementation_diff',
      feedback: {
        reject_reason_codes: ['NO_CHANGED_FILES'],
        must_fix: ['Apply a real scoped code change before Scout/Executer handoff'],
        rewrite_plan: [
          cooldownBlocked
            ? 'Wait for cooldown or make an explicit implementation change in a different scoped file before retrying.'
            : 'Add the intended implementation diff in the scoped file, then rerun Scout sync and execution.',
        ],
      },
    };
    job.summary = `${job.summary} | halted: no implementation diff${cooldownBlocked ? ' (cooldown active)' : ''}`;
    job.timestamps.updatedAt = nowIso();
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'scout_update', message: `Executer produced no changed files${cooldownBlocked ? ' (cooldown active)' : ''}; handed off to Scout Update` });
    await setActiveJobLock(null);
    await writeJson(files.jobs, jobs);
    console.log('[build] no changed files');
    return;
  }

  const previewPath = '/dev1/portfolio_public';
  const beforeScreenshotPath = `Agent Team/autonomous-engine/artifacts/${job.id}/before-page.png`;
  const afterScreenshotPath = `Agent Team/autonomous-engine/artifacts/${job.id}/after-page.png`;

  const beforeCapture = await capturePublicPreview(beforeScreenshotPath, { timeoutMs: 180000 });
  if (!beforeCapture.ok) {
    await writeArtifact(job.id, 'before-screenshot-error.txt', beforeCapture.error);
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

  const afterCapture = await capturePublicPreview(afterScreenshotPath, { timeoutMs: 180000 });
  if (!afterCapture.ok) {
    await writeArtifact(job.id, 'after-screenshot-error.txt', afterCapture.error);
  }

  await writeArtifact(job.id, 'code.diff.patch', diff || '# no diff produced');
  await writeArtifact(job.id, 'commit-message.txt', commitMsg);
  await writeArtifact(job.id, 'commit-sha.txt', commitSha || 'no-commit-sha');
  await writeArtifact(job.id, 'changed-files.json', changedFiles);
  await writeArtifact(job.id, 'test-plan.txt', testPlan);
  await writeArtifact(job.id, 'summary-report.json', summary);
  await writeArtifact(job.id, 'before-preview.svg', makePreviewSvg({ label: 'Before', file: beforePreviewPayload.file, content: beforePreviewPayload.content }));
  await writeArtifact(job.id, 'after-preview.svg', makePreviewSvg({ label: 'After', file: afterPreviewPayload.file, content: afterPreviewPayload.content }));
  await writeArtifact(job.id, 'preview.json', {
    previewUrl: previewPath,
    screenshot: 'after-page.png',
    beforeScreenshot: 'before-page.png',
    afterScreenshot: 'after-page.png',
    beforeAfterDiff: 'code.diff.patch',
    beforePreview: 'before-preview.svg',
    afterPreview: 'after-preview.svg',
    generatedAt: nowIso(),
  });

  job.summary = `${proposal.proposed_change} (local execution applied)`;
  transitionJob(job, 'qa_review', { ownerAgent: 'qa' });
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'qa_review', message: `Executer completed scoped changes; handed off to QA with ${changedFiles.length} file(s)` });

  await writeJson(files.jobs, jobs);
  console.log(`[build] ${job.id} -> qa_review (${changedFiles.length} files)`);
}

const lockResult = await withEngineRunLock('build-run', main, { staleMs: 15 * 60 * 1000 });
if (lockResult?.skipped) {
  console.log(`[build] skipped (${lockResult.reason})`);
}
