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
};

export const CATEGORIES = ['ux', 'performance', 'security', 'branding', 'product', 'operations', 'benchmark', 'patch'];
export const FINAL_STATES = ['review_ready', 'reverted', 'abandoned_with_reason'];
export const AGENTS = ['scout', 'planner', 'builder', 'verifier'];
export const WORKFLOW = ['discover', 'proposal', 'approved_for_build', 'build', 'test', 'review_ready', 'approved', 'rejected', 'reverted', 'abandoned_with_reason'];

async function ensureFile(filePath, fallback) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try { await fs.access(filePath); } catch { await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8'); }
}

export async function ensureEngineFiles() {
  await ensureFile(FILES.proposals, []);
  await ensureFile(FILES.jobs, []);
  await ensureFile(FILES.history, []);
  await ensureFile(FILES.lessons, []);
  await fs.mkdir(ARTIFACTS, { recursive: true });
}

export async function readJson(filePath) { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
export async function writeJson(filePath, data) { await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8'); }

export const files = FILES;
export const paths = { ROOT, BASE, ARTIFACTS };

export function nowIso() { return new Date().toISOString(); }
export function makeId(prefix) {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${y}${m}${day}-${rnd}`;
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
    review_ready: ['approved', 'rejected', 'reverted'],
    approved: [],
    rejected: ['reverted'],
    reverted: [],
    abandoned_with_reason: [],
  };
  return (allowed[from] || []).includes(to);
}

export function validateProposal(p) {
  const required = ['id', 'title', 'category', 'problem', 'evidence', 'proposed_change', 'expected_benefit', 'risk', 'files_expected', 'tests_required', 'rollback_plan'];
  for (const k of required) if (p[k] === undefined || p[k] === null) return { ok: false, reason: `missing_${k}` };
  if (!CATEGORIES.includes(p.category)) return { ok: false, reason: 'invalid_category' };
  if (!Array.isArray(p.evidence) || p.evidence.length === 0) return { ok: false, reason: 'missing_evidence' };
  if (!Array.isArray(p.files_expected) || p.files_expected.length === 0) return { ok: false, reason: 'missing_files_expected' };
  if (p.files_expected.length > 5) return { ok: false, reason: 'max_5_files_expected' };
  if (!['low', 'medium', 'high'].includes(String(p.risk))) return { ok: false, reason: 'invalid_risk' };
  return { ok: true };
}

export function parseLessons(lessons = []) {
  const liked = String((lessons || []).map((l) => l?.liked || '').join(' ')).toLowerCase();
  const disliked = String((lessons || []).map((l) => l?.disliked || '').join(' ')).toLowerCase();
  return { liked, disliked };
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
