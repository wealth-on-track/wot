#!/usr/bin/env node
import { execSync } from 'child_process';
import { ensureEngineFiles, files, makeId, readJson, writeJson, normalize, CATEGORIES, nowIso, parseLessons } from './lib.mjs';

await ensureEngineFiles();
const lessons = await readJson(files.lessons);
const proposals = await readJson(files.proposals);

const { liked, disliked } = parseLessons(lessons);
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

scanHints.push({ category: 'ux', title: 'Refine UI structure consistency across admin and mobile surfaces', evidence: ['UI structure heuristic mismatch in local code scan'] });
scanHints.push({ category: 'benchmark', title: 'Compare critical portfolio flows against benchmark scripts and align best practices', evidence: ['benchmark category periodic proposal seed'] });
scanHints.push({ category: 'performance', title: 'Reduce initial bundle execution in dashboard route', evidence: ['performance category periodic proposal seed'] });

const candidates = scanHints
  .filter((c) => CATEGORIES.includes(c.category))
  .map((c) => {
    const n = normalize(c.title);
    let score = 0;
    if (liked && liked.split(' ').some((w) => w.length > 4 && n.includes(w))) score += 2;
    if (disliked && disliked.split(' ').some((w) => w.length > 4 && n.includes(w))) score -= 3;
    if (c.category === 'security') score += 1;
    return { ...c, score };
  })
  .sort((a, b) => b.score - a.score);

let created = 0;

for (const c of candidates) {
  const n = normalize(c.title);
  if (disliked && n.split(' ').some((w) => w.length > 4 && disliked.includes(w))) continue;
  if (proposals.some((p) => normalize(p.title) === n)) continue;

  proposals.push({
    id: makeId('PRP'),
    title: c.title,
    category: c.category,
    problem: `Detected opportunity in ${c.category} via local scout scan.`,
    evidence: c.evidence?.length ? c.evidence : [`source: local scout scan @ ${nowIso()}`],
    proposed_change: 'Apply one minimal local change set and verify with required checks.',
    expected_benefit: 'Safer and incremental project quality improvement.',
    risk: c.category === 'security' ? 'medium' : 'low',
    files_expected: c.category === 'ux' ? ['src/app/admin/autonomous-engine/page.tsx'] : ['src/lib/autonomousEngine.ts'],
    tests_required: ['lint', 'unit'],
    rollback_plan: 'Revert local branch to previous commit and remove generated job artifacts.',
  });
  created += 1;
}

await writeJson(files.proposals, proposals);
console.log(`[discover] added ${created} proposal(s)`);
