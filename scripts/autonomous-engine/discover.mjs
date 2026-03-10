#!/usr/bin/env node
import { execSync } from 'child_process';
import { ensureEngineFiles, files, makeId, readJson, writeJson, normalize, CATEGORIES, nowIso, parseLessons, proposalSimilarity } from './lib.mjs';

await ensureEngineFiles();
const lessons = await readJson(files.lessons);
const proposals = await readJson(files.proposals);
const deepState = await readJson(files.deepScanState);

const { liked, disliked, byCategory } = parseLessons(lessons);
const neverDoAgain = String((lessons || []).map((l) => `${l?.disliked || ''} ${l?.notes || ''}`).join(' ')).toLowerCase();
const scanHints = [];
const USER_FACING_KEYS = ['portfolio', 'dashboard', 'onboarding', 'insight', 'clarity', 'trust', 'branding', 'mobile', 'performance'];
const LOW_VALUE_PATTERNS = [/tiny/i, /small hint/i, /badge/i, /minor/i, /cosmetic/i, /text tweak/i, /helper sentence/i, /admin ui/i];

try {
  const out = execSync('npm audit --json', { stdio: 'pipe', timeout: 20000 }).toString();
  const parsed = JSON.parse(out);
  const vulns = Number(parsed?.metadata?.vulnerabilities?.high || 0) + Number(parsed?.metadata?.vulnerabilities?.critical || 0);
  if (vulns > 0) scanHints.push({ category: 'security', title: `Address ${vulns} high/critical dependency vulnerabilities`, evidence: [`npm audit high+critical=${vulns}`] });
} catch {}

try {
  execSync('npm run -s lint', { stdio: 'pipe', timeout: 30000 });
} catch {
  scanHints.push({ category: 'operations', title: 'Resolve lint failures blocking autonomous verification', evidence: ['lint command failed in local scan'] });
}

try {
  execSync('npm run -s test -- --run', { stdio: 'pipe', timeout: 120000 });
} catch {
  scanHints.push({ category: 'patch', title: 'Fix failing unit/integration test path discovered in local test run', evidence: ['unit test command failed in local scan'] });
}

scanHints.push({ category: 'ux', title: 'Improve empty portfolio onboarding with clearer next actions', evidence: ['observed UX friction: users with zero assets lack guided next step'] });
try {
  const bench = execSync('node scripts/autonomous-engine/check-performance.mjs', { stdio: 'pipe', timeout: 120000 }).toString();
  scanHints.push({ category: 'benchmark', title: 'Compare critical portfolio flows against benchmark scripts and align best practices', evidence: [`benchmark_result: ${bench.trim()}`] });
} catch {
  scanHints.push({ category: 'benchmark', title: 'Compare critical portfolio flows against benchmark scripts and align best practices', evidence: ['benchmark_result: fail'] });
}
scanHints.push({ category: 'performance', title: 'Reduce portfolio dashboard load latency via route-level lazy chunking', evidence: ['performance measurement needed: dashboard load path is a frequent user-facing surface'] });

// weekly deep scan
const lastDeep = deepState?.lastDeepScanAt ? new Date(deepState.lastDeepScanAt).getTime() : 0;
if (!lastDeep || Date.now() - lastDeep > 7 * 24 * 60 * 60 * 1000) {
  scanHints.push({
    category: 'benchmark',
    title: 'Weekly deep benchmark scan for competitor UX patterns and missing features',
    evidence: ['weekly deep scan trigger'],
    forcePriority: 'P2',
    forceImpact: 'high',
  });
  await writeJson(files.deepScanState, { lastDeepScanAt: nowIso() });
}

const candidates = scanHints
  .filter((c) => CATEGORIES.includes(c.category))
  .map((c) => {
    const n = normalize(c.title);
    let score = 0;
    if (liked && liked.split(' ').some((w) => w.length > 4 && n.includes(w))) score += 2;
    if (disliked && disliked.split(' ').some((w) => w.length > 4 && n.includes(w))) score -= 3;
    if (c.category === 'security') score += 1;
    const cat = byCategory[c.category] || { liked: 0, disliked: 0 };
    score += Number(cat.liked || 0) - Number(cat.disliked || 0);
    return { ...c, score };
  })
  .sort((a, b) => b.score - a.score);

let created = 0;
let createdUserFacing = 0;

for (const c of candidates) {
  const n = normalize(c.title);
  if (disliked && n.split(' ').some((w) => w.length > 4 && disliked.includes(w))) continue;
  if (LOW_VALUE_PATTERNS.some((r) => r.test(c.title))) continue;
  if (neverDoAgain.includes('never_do_again') && neverDoAgain.split('never_do_again').pop()?.includes(n.slice(0, 20))) continue;

  const userFacing = USER_FACING_KEYS.some((k) => n.includes(k));
  const impactScore = c.category === 'security' ? 4 : userFacing ? 4 : 3;
  const confidenceScore = c.evidence?.length ? 4 : 2;
  const effortScore = c.category === 'benchmark' ? 3 : 2;

  // quality gate
  if (impactScore < 3 || confidenceScore < 3) continue;

  const risk = c.category === 'security' ? 'high' : c.category === 'performance' ? 'medium' : 'low';
  const impact = c.forceImpact || (impactScore >= 4 ? 'high' : 'medium');
  const priority = c.forcePriority || (risk === 'high' || impact === 'high' ? 'P1' : 'P2');

  const proposal = {
    id: makeId('PRP'),
    title: c.title,
    category: c.category,
    problem: [
      `Observed ${c.category} friction from local scout signals.`,
      'Current behavior leaves measurable value on the table for end-users or operators.',
      'Without intervention, this problem repeats and reduces trust, clarity, or delivery speed.',
    ].join(' '),
    evidence: c.evidence?.length ? c.evidence : [`source: local scout scan @ ${nowIso()}`],
    proposed_change: [
      'Scope: deliver one focused functional improvement with clear acceptance criteria.',
      'Implementation approach: touch only the highest-leverage files, keep blast-radius small, and add explicit verification steps.',
      'Validation plan: run required checks and provide reproducible artifacts (diff, tests, outcome summary).',
    ].join(' '),
    expected_benefit: [
      'Primary outcome: concrete improvement in user-facing quality or system reliability.',
      'Secondary outcome: clearer operational visibility and lower chance of repeat regressions.',
      'Decision outcome: human reviewer can approve/reject with transparent evidence.',
    ].join(' '),
    risk,
    impact,
    priority,
    impactScore,
    confidenceScore,
    effortScore,
    userFacing,
    success_metrics: [
      'At least one measurable before/after signal is present in artifacts.',
      'All required quality checks pass.',
      'Reviewer can verify impact from summary + evidence without guessing intent.',
    ],
    non_goals: [
      'No unrelated refactor.',
      'No broad redesign outside scoped files.',
      'No production deploy automation without explicit human approval.',
    ],
    files_expected: c.category === 'ux' ? ['src/app/[username]/portfolio_public/page.tsx'] : c.category === 'performance' ? ['src/components/PublicPortfolioView.tsx'] : ['src/services/marketData.ts'],
    tests_required: ['lint', 'unit'],
    rollback_plan: 'Revert local branch to previous commit, remove generated artifacts for this job, and restore previous state snapshot.',
  };

  const dup = proposals.find((p) => {
    const s = proposalSimilarity(p, proposal);
    return s.titleSimilar || (s.problemSimilar && s.fileOverlap > 0);
  });
  if (dup) {
    dup.evidence = [...new Set([...(dup.evidence || []), ...(proposal.evidence || [])])];
    continue;
  }

  const projectedTotal = created + 1;
  const projectedUser = createdUserFacing + (proposal.userFacing ? 1 : 0);
  const projectedRatio = projectedUser / projectedTotal;
  if (!proposal.userFacing && projectedRatio < 0.7) continue;

  proposals.push(proposal);
  created += 1;
  if (proposal.userFacing) createdUserFacing += 1;
}

await writeJson(files.proposals, proposals);
console.log(`[discover] added ${created} proposal(s)`);
