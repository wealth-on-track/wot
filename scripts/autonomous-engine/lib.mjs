import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'Agent Team', 'autonomous-engine');
const ARTIFACTS = path.join(BASE, 'artifacts');

const FILES = {
  proposals: path.join(BASE, 'proposals.json'),
  jobs: path.join(BASE, 'jobs.json'),
  history: path.join(BASE, 'history.json'),
  lessons: path.join(ROOT, 'knowledge', 'lessons.json'),
  deepScanState: path.join(BASE, 'deep-scan-state.json'),
};

export const CATEGORIES = ['ux', 'performance', 'security', 'branding', 'product', 'operations', 'benchmark', 'patch'];
export const FINAL_STATES = ['review_ready', 'reverted', 'abandoned_with_reason'];
export const AGENTS = ['scout', 'planner', 'builder', 'verifier'];
export const WORKFLOW = ['discover', 'proposal', 'approved_for_build', 'build', 'test', 'review_ready', 'reverted', 'abandoned_with_reason'];

async function ensureFile(filePath, fallback) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try { await fs.access(filePath); } catch { await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8'); }
}

export async function ensureEngineFiles() {
  await ensureFile(FILES.proposals, []);
  await ensureFile(FILES.jobs, []);
  await ensureFile(FILES.history, []);
  await ensureFile(FILES.lessons, []);
  await ensureFile(FILES.deepScanState, { lastDeepScanAt: null });
  await fs.mkdir(ARTIFACTS, { recursive: true });
}

export async function readJson(filePath) { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
export async function writeJson(filePath, data) { await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8'); }

export const files = FILES;
export const paths = { ROOT, BASE, ARTIFACTS };

export function nowIso() { return new Date().toISOString(); }
let __seq = 0;
export function makeId(prefix) {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  __seq += 1;
  return `${prefix}-${y}${m}${day}-${h}${mi}${s}${ms}-${String(__seq).padStart(3, '0')}`;
}

export function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export function stageOwner(state) {
  if (state === 'discover') return 'scout';
  if (state === 'proposal' || state === 'approved_for_build') return 'planner';
  if (state === 'build') return 'builder';
  if (state === 'test') return 'verifier';
  return null;
}

export function canTransition(from, to) {
  const allowed = {
    discover: ['proposal', 'abandoned_with_reason'],
    proposal: ['approved_for_build', 'abandoned_with_reason'],
    approved_for_build: ['build', 'abandoned_with_reason'],
    build: ['test', 'approved_for_build', 'abandoned_with_reason'],
    test: ['review_ready', 'build', 'abandoned_with_reason'],
    review_ready: ['reverted'],
    reverted: [],
    abandoned_with_reason: [],
  };
  return (allowed[from] || []).includes(to);
}

export function validateProposal(p) {
  const required = ['id', 'title', 'category', 'problem', 'evidence', 'proposed_change', 'expected_benefit', 'risk', 'impact', 'priority', 'files_expected', 'tests_required', 'rollback_plan'];
  for (const k of required) if (p[k] === undefined || p[k] === null) return { ok: false, reason: `missing_${k}` };
  if (!CATEGORIES.includes(p.category)) return { ok: false, reason: 'invalid_category' };
  if (!Array.isArray(p.evidence) || p.evidence.length === 0) return { ok: false, reason: 'missing_evidence' };
  if (!Array.isArray(p.files_expected) || p.files_expected.length === 0) return { ok: false, reason: 'missing_files_expected' };
  if (p.files_expected.length > 5) return { ok: false, reason: 'max_5_files_expected' };
  if (!['low', 'medium', 'high'].includes(String(p.risk))) return { ok: false, reason: 'invalid_risk' };
  if (!['low', 'medium', 'high'].includes(String(p.impact))) return { ok: false, reason: 'invalid_impact' };
  if (!['P1', 'P2', 'P3'].includes(String(p.priority))) return { ok: false, reason: 'invalid_priority' };
  const vague = /\b(improve|better|optimize|enhance)\b/i.test(String(p.title || '')) && String(p.title || '').trim().split(/\s+/).length <= 5;
  if (vague) return { ok: false, reason: 'vague_title' };
  return { ok: true };
}

export const WIP_LIMITS = { planning: 10, building: 3, testing: 3, reviewReady: 20 };

export function proposalSimilarity(a, b) {
  const t1 = normalize(a?.title);
  const t2 = normalize(b?.title);
  const p1 = normalize(a?.problem);
  const p2 = normalize(b?.problem);
  const files1 = new Set((a?.files_expected || []).map((f) => String(f).toLowerCase()));
  const files2 = new Set((b?.files_expected || []).map((f) => String(f).toLowerCase()));
  const overlap = [...files1].filter((f) => files2.has(f)).length;
  return {
    titleSimilar: t1 && t2 && (t1 === t2 || t1.includes(t2) || t2.includes(t1)),
    problemSimilar: p1 && p2 && (p1 === p2 || p1.includes(p2) || p2.includes(p1)),
    fileOverlap: overlap,
  };
}

export function parseLessons(lessons = []) {
  const liked = String((lessons || []).map((l) => l?.liked || '').join(' ')).toLowerCase();
  const disliked = String((lessons || []).map((l) => l?.disliked || '').join(' ')).toLowerCase();
  const byCategory = {};
  for (const l of lessons || []) {
    const c = String(l?.category || '').toLowerCase();
    if (!c) continue;
    byCategory[c] ||= { liked: 0, disliked: 0 };
    if (String(l?.liked || '').trim()) byCategory[c].liked += 1;
    if (String(l?.disliked || '').trim()) byCategory[c].disliked += 1;
  }
  return { liked, disliked, byCategory };
}

export async function ensureJobArtifacts(jobId) {
  const dir = path.join(ARTIFACTS, jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeArtifact(jobId, name, content) {
  const dir = await ensureJobArtifacts(jobId);
  const fp = path.join(dir, name);
  await fs.writeFile(fp, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
  return fp;
}
