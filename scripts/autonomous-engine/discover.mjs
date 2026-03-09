#!/usr/bin/env node
import { execSync } from 'child_process';
import { ensureEngineFiles, files, makeId, readJson, writeJson, normalize, CATEGORIES, nowIso, parseLessons, proposalSimilarity } from './lib.mjs';

await ensureEngineFiles();
const lessons = await readJson(files.lessons);
const proposals = await readJson(files.proposals);
const deepState = await readJson(files.deepScanState);

const { liked, disliked, byCategory } = parseLessons(lessons);
const scanHints = [];

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

scanHints.push({ category: 'ux', title: 'Add empty state CTA when portfolio has no assets', evidence: ['actionable ux flow gap detected'] });
try {
  const bench = execSync('node scripts/autonomous-engine/check-performance.mjs', { stdio: 'pipe', timeout: 120000 }).toString();
  scanHints.push({ category: 'benchmark', title: 'Compare critical portfolio flows against benchmark scripts and align best practices', evidence: [`benchmark_result: ${bench.trim()}`] });
} catch {
  scanHints.push({ category: 'benchmark', title: 'Compare critical portfolio flows against benchmark scripts and align best practices', evidence: ['benchmark_result: fail'] });
}
scanHints.push({ category: 'performance', title: 'Reduce initial bundle execution in dashboard route with lazy chunking', evidence: ['performance category periodic proposal seed'] });

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

for (const c of candidates) {
  const n = normalize(c.title);
  if (disliked && n.split(' ').some((w) => w.length > 4 && disliked.includes(w))) continue;

  const risk = c.category === 'security' ? 'high' : c.category === 'performance' ? 'medium' : 'low';
  const impact = c.forceImpact || (c.category === 'product' || c.category === 'performance' ? 'high' : 'medium');
  const priority = c.forcePriority || (risk === 'high' || impact === 'high' ? 'P1' : 'P2');

  const proposal = {
    id: makeId('PRP'),
    title: c.title,
    category: c.category,
    problem: `Detected actionable ${c.category} issue via local scout scan.`,
    evidence: c.evidence?.length ? c.evidence : [`source: local scout scan @ ${nowIso()}`],
    proposed_change: 'Apply one minimal local change set and verify with required checks.',
    expected_benefit: 'Safer and incremental project quality improvement.',
    risk,
    impact,
    priority,
    files_expected: c.category === 'ux' ? ['src/app/admin/autonomous-engine/page.tsx'] : ['src/lib/autonomousEngine.ts'],
    tests_required: ['lint', 'unit'],
    rollback_plan: 'Revert local branch to previous commit and remove generated job artifacts.',
  };

  const dup = proposals.find((p) => {
    const s = proposalSimilarity(p, proposal);
    return s.titleSimilar || (s.problemSimilar && s.fileOverlap > 0);
  });
  if (dup) {
    dup.evidence = [...new Set([...(dup.evidence || []), ...(proposal.evidence || [])])];
    continue;
  }

  proposals.push(proposal);
  created += 1;
}

await writeJson(files.proposals, proposals);
console.log(`[discover] added ${created} proposal(s)`);
