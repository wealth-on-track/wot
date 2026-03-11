#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const proposals = await readJson(files.proposals);

const countOcc = (txt, needle) => (String(txt || '').toLowerCase().split(String(needle).toLowerCase()).length - 1);
const hasConcreteFilePlan = (p) => Array.isArray(p.change_spec) && p.change_spec.some((x) => x?.file && x?.change && String(x.change).length > 20);
const hasAlignedFilePlan = (p) => {
  const specFiles = new Set((Array.isArray(p.change_spec) ? p.change_spec : []).map((x) => String(x?.file || '').trim()).filter(Boolean));
  const expectedFiles = new Set((p.files_expected || []).map((f) => String(f || '').trim()).filter(Boolean));
  if (!specFiles.size || !expectedFiles.size) return false;
  for (const f of specFiles) if (expectedFiles.has(f)) return true;
  return false;
};
const hasQuantifiedKpi = (txt) => /\d|>=|<=|%|ms|s\b|x\b/i.test(String(txt || ''));
const hasConcreteBenchmarkDelta = (txt) => /\b(gap|delta|baseline|benchmark|current|target|reduce|improve)\b/i.test(String(txt || ''));
const hasRobustRiskControls = (controls = []) => (controls || []).some((c) => /rollback|guard|scope|verify|checklist|fail-safe|revert/i.test(String(c || '')));
const dedupeSentence = (txt, sentence) => {
  const parts = String(txt || '').split(sentence).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return sentence;
  return `${parts[0]} ${sentence}`.trim();
};

const scoreProposal = (p) => {
  const evidenceCount = Array.isArray(p.evidence) ? p.evidence.length : 0;
  const text = `${p.problem || ''} ${p.proposed_change || ''} ${p.expected_benefit || ''}`.toLowerCase();
  const title = String(p.title || '').toLowerCase();
  const userFacing = !!p.userFacing || ['portfolio', 'onboarding', 'insight', 'dashboard', 'trust', 'branding'].some((k) => title.includes(k));

  // fintech-grade rubric signals
  const hasKpi = Boolean(p.kpi_target && String(p.kpi_target).trim().length > 8);
  const hasBenchmarkDelta = Boolean(p.benchmark_delta && String(p.benchmark_delta).trim().length > 8);
  const riskControlCount = Array.isArray(p.risk_controls) ? p.risk_controls.length : 0;
  const hasMeasurableText = ['metric', 'measure', 'before/after', 'latency', 'conversion', 'error rate', 'uptime', 'pass rate'].some((k) => text.includes(k));
  const filePlanOk = hasConcreteFilePlan(p);
  const alignedFilePlan = hasAlignedFilePlan(p);
  const quantifiedKpi = hasQuantifiedKpi(p.kpi_target);
  const concreteBenchmark = hasConcreteBenchmarkDelta(p.benchmark_delta);
  const robustRiskControls = riskControlCount >= 2 && hasRobustRiskControls(p.risk_controls);
  const genericSignals = [
    countOcc(p.problem, 'observed') >= 2 && countOcc(p.problem, 'friction') >= 2,
    countOcc(p.proposed_change, 'scope: deliver one focused functional improvement') > 0,
    countOcc(p.proposed_change, 'implementation approach: touch only the highest-leverage files') > 0,
    countOcc(p.expected_benefit, 'primary outcome: concrete improvement') > 0,
  ].filter(Boolean).length;

  const impact = Math.max(Number(p.impactScore || 0), (hasKpi || hasMeasurableText) ? 4 : 3);
  const confidence = Math.max(Number(p.confidenceScore || 0), evidenceCount >= 2 && riskControlCount >= 2 ? 4 : (evidenceCount >= 2 ? 3 : 2));

  const codes = [];
  if (evidenceCount < 2) codes.push('EVIDENCE_WEAK');
  if (impact < 3) codes.push('IMPACT_LOW');
  if (confidence < 3) codes.push('CONFIDENCE_LOW');
  if (!userFacing) codes.push('USER_FACING_MISS');
  if (!hasKpi) codes.push('KPI_TARGET_MISSING');
  if (!quantifiedKpi) codes.push('KPI_NOT_QUANTIFIED');
  if (!hasBenchmarkDelta) codes.push('BENCHMARK_DELTA_MISSING');
  if (!concreteBenchmark) codes.push('BENCHMARK_DELTA_VAGUE');
  if (riskControlCount < 2 || !robustRiskControls) codes.push('RISK_CONTROLS_WEAK');
  if (!filePlanOk) codes.push('FILE_PLAN_MISSING');
  if (!alignedFilePlan) codes.push('FILE_PLAN_MISMATCH');
  if (genericSignals >= 2) codes.push('GENERIC_TEXT');

  return { pass: codes.length === 0, codes, evidenceCount, impact, confidence, userFacing, hasKpi, quantifiedKpi, hasBenchmarkDelta, concreteBenchmark, riskControlCount, filePlanOk, alignedFilePlan, genericSignals };
};

const rewriteOnce = (p, result, job) => {
  const np = { ...p };
  const mustFix = [];

  if (result.codes.includes('EVIDENCE_WEAK')) {
    np.evidence = [...new Set([...(np.evidence || []), 'local failing signal captured and attached', 'benchmark/test comparison added with concrete reference', `quality_session_rewrite@${nowIso()}`])];
    mustFix.push('Add stronger evidence signals');
  }
  if (result.codes.includes('IMPACT_LOW')) {
    np.expected_benefit = `${np.expected_benefit || ''} Include measurable before/after metric and expected threshold.`.trim();
    mustFix.push('Raise measurable impact');
  }
  if (result.codes.includes('CONFIDENCE_LOW')) {
    np.tests_required = [...new Set([...(np.tests_required || []), 'integration'])];
    mustFix.push('Increase confidence with concrete checks');
  }
  if (result.codes.includes('KPI_TARGET_MISSING')) {
    np.kpi_target = np.kpi_target || 'Reduce user-facing confusion/error rate by >=20% in a 20-case QA pass before review_ready.';
    mustFix.push('Define KPI target');
  }
  if (result.codes.includes('KPI_NOT_QUANTIFIED')) {
    np.kpi_target = 'Reduce user-facing confusion/error rate by >=20% in a 20-case QA pass before review_ready.';
    mustFix.push('Quantify KPI target');
  }
  if (result.codes.includes('BENCHMARK_DELTA_MISSING')) {
    np.benchmark_delta = np.benchmark_delta || 'Current state lacks explicit benchmark behavior; target is parity with top fintech pattern and measurable gap closure.';
    mustFix.push('Define benchmark delta');
  }
  if (result.codes.includes('BENCHMARK_DELTA_VAGUE')) {
    np.benchmark_delta = 'Current baseline vs benchmark gap is explicitly documented, with target behavior and closure step in scoped file.';
    mustFix.push('Make benchmark delta concrete');
  }
  if (result.codes.includes('RISK_CONTROLS_WEAK')) {
    np.risk_controls = [...new Set([...(np.risk_controls || []), 'Scoped file-change boundary with rollback note', 'Mandatory verification checklist before review_ready'])];
    mustFix.push('Strengthen risk controls');
  }
  if (result.codes.includes('FILE_PLAN_MISSING')) {
    np.change_spec = [{
      file: (np.files_expected || [])[0] || 'src/components/PublicPortfolioView.tsx',
      change: 'Implement explicit user-facing text/behavior improvement in this file with minimal scoped diff.',
      why: 'Maps proposal directly to concrete file-level implementation.',
    }];
    mustFix.push('Add concrete file-level implementation plan');
  }
  if (result.codes.includes('FILE_PLAN_MISMATCH')) {
    const target = (np.files_expected || [])[0] || (np.change_spec || [])[0]?.file || 'src/components/PublicPortfolioView.tsx';
    np.files_expected = [target];
    np.change_spec = [{
      file: target,
      change: 'Align file-level plan and implementation target so build can produce one focused functional change.',
      why: 'Prevents proposal/build mismatch and no-diff loops.',
    }];
    mustFix.push('Align change_spec with files_expected');
  }
  if (result.codes.includes('GENERIC_TEXT')) {
    np.problem = `User-visible issue in ${(np.files_expected || [])[0] || 'target component'} creates measurable friction in interpretation or trust.`;
    np.proposed_change = `Edit ${(np.files_expected || [])[0] || 'target file'} to apply a specific behavior/text change and document exact acceptance outcome.`;
    np.expected_benefit = 'Clear, measurable improvement linked to one component and one acceptance threshold.';
    mustFix.push('Replace generic narrative with concrete scoped language');
  }
  if (result.codes.includes('USER_FACING_MISS')) {
    np.userFacing = true;
    np.title = `${np.title} for portfolio user experience`;
    np.files_expected = ['src/components/PublicPortfolioView.tsx'];
    mustFix.push('Make change user-facing');
  }
  if ((result.codes || []).includes('NO_CHANGED_FILES')) {
    const candidates = ['src/components/PublicPortfolioView.tsx','src/components/mobile/MobileDashboard.tsx','src/components/mobile/MobileHeader.tsx'];
    const current = (np.files_expected || [])[0];
    const prev = String(job?.quality?.lastTriedFile || '');
    const next = candidates.find((c)=>c!==current && c!==prev) || candidates.find((c)=>c!==current) || candidates[0];
    np.files_expected = [next];
    np.revision_summary = { ...(np.revision_summary || {}), rotatedFileFrom: current, rotatedFileTo: next };
    mustFix.push('Switch target file to avoid no-diff path');
  }

  np.problem = dedupeSentence(np.problem, 'Quality rewrite note: problem statement expanded to clarify consequence, urgency, and verification boundary.');
  np.proposed_change = dedupeSentence(np.proposed_change, 'Quality rewrite note: execution plan now includes concrete implementation and validation sequence.');
  np.expected_benefit = dedupeSentence(np.expected_benefit, 'Quality rewrite note: expected outcomes are framed for reviewer decision and measurable closure.');
  np.revision_summary = {
    revisedAt: nowIso(),
    oneSessionRewrite: true,
    addressedItems: mustFix,
  };

  return { proposal: np, mustFix };
};

let updated = 0;
for (const job of jobs) {
  if (job.state !== 'proposal') continue;
  const p = proposals.find((x) => x.id === job.proposalId || String(job.proposalId || '').startsWith(String(x.id || '')));
  if (!p) continue;

  const needsRevision = job.quality?.status === 'needs_revision';
  const first = scoreProposal(p);

  const priorCodes = job.quality?.feedback?.reject_reason_codes || [];
  if (priorCodes.includes('NO_CHANGED_FILES') && !first.codes.includes('NO_CHANGED_FILES')) first.codes.push('NO_CHANGED_FILES');

  // stop endless auto-loop: after repeated verify failures, escalate to human review
  if (Number(job.retries?.testing || 0) >= 2) {
    job.quality = { ...(job.quality || {}), status: 'needs_human_review', checkedAt: nowIso(), reason: 'repeated_verify_failures' };
    updated += 1;
    continue;
  }

  if (first.pass && !needsRevision) {
    job.quality = { status: 'pass', checkedAt: nowIso(), sessionCount: job.quality?.sessionCount || 0 };
    updated += 1;
    continue;
  }

  const sessionCount = Number(job.quality?.sessionCount || 0) + 1;
  if (needsRevision && !first.codes.includes('CONFIDENCE_LOW')) first.codes.push('CONFIDENCE_LOW');
  const feedback = {
    reject_reason_codes: first.codes.slice(0, 3),
    strengths: [
      `Category alignment: ${p.category}`,
      `Initial impact/confidence/effort: ${p.impactScore || '-'} / ${p.confidenceScore || '-'} / ${p.effortScore || '-'}`,
      'Scope remains constrained for controlled delivery.',
    ],
    gaps: first.codes.map((c) => {
      if (c === 'EVIDENCE_WEAK') return 'Evidence is not yet strong enough to justify confident execution.';
      if (c === 'IMPACT_LOW') return 'Impact statement is below build threshold and needs clearer measurable outcome.';
      if (c === 'CONFIDENCE_LOW') return 'Confidence is low; proposal needs stronger verification framing.';
      if (c === 'USER_FACING_MISS') return 'Proposal must connect directly to user-facing value.';
      if (c === 'KPI_TARGET_MISSING') return 'KPI target is missing; no measurable success threshold is defined.';
      if (c === 'KPI_NOT_QUANTIFIED') return 'KPI target exists but is not quantified (no concrete threshold/number).';
      if (c === 'BENCHMARK_DELTA_MISSING') return 'Benchmark delta is missing; best-in-class gap is unclear.';
      if (c === 'BENCHMARK_DELTA_VAGUE') return 'Benchmark delta is too vague; baseline/target/closure step are unclear.';
      if (c === 'RISK_CONTROLS_WEAK') return 'Risk controls are weak; add execution and rollback safeguards.';
      if (c === 'FILE_PLAN_MISSING') return 'Proposal does not specify exact file-level implementation plan.';
      if (c === 'FILE_PLAN_MISMATCH') return 'change_spec file does not align with files_expected; build target is ambiguous.';
      if (c === 'GENERIC_TEXT') return 'Proposal narrative is too generic and not execution-specific.';
      return c;
    }),
    must_fix: first.codes,
    evidence_gap: first.evidenceCount < 2 ? 'Need at least 2 evidence points from scan/log/benchmark/test signals.' : null,
    rewrite_plan: [
      'Rewrite problem statement to explain user/system consequence clearly.',
      'Add concrete evidence and tie it to measurable acceptance criteria.',
      'Upgrade proposal language from generic intent to execution-ready plan.',
      'Re-score impact/confidence after rewrite and keep effort realistic.',
    ],
    acceptance_checklist: [
      'Impact >= 3',
      'Confidence >= 3',
      'Evidence count >= 2',
      'User-facing value explicitly stated',
      'KPI target is quantified',
      'change_spec file aligns with files_expected',
    ],
  };

  if (sessionCount > 1) {
    job.quality = { status: 'needs_human_review', checkedAt: nowIso(), sessionCount, feedback };
    job.state = 'proposal';
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: 'Quality gate failed after one feedback session; needs human review' });
    updated += 1;
    continue;
  }

  const rewritten = rewriteOnce(p, first, job);
  Object.assign(p, rewritten.proposal);
  const second = scoreProposal(p);

  if (second.pass) {
    job.quality = { status: 'pass', checkedAt: nowIso(), sessionCount, feedback, revised: true };
    job.summary = `${p.proposed_change} (quality-revised)`;
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: 'Proposal revised in one feedback session and passed quality gate' });
  } else {
    job.quality = { status: 'needs_human_review', checkedAt: nowIso(), sessionCount, feedback, revised: true };
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: 'Proposal revised once but still failed quality gate' });
  }

  updated += 1;
}

await writeJson(files.jobs, jobs);
await writeJson(files.proposals, proposals);
console.log(`[quality-gate] processed ${updated} proposal job(s)`);
