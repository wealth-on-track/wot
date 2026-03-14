import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'Agent Team', 'autonomous-engine');
const ARTIFACTS = path.join(BASE, 'artifacts');
const RUNTIME = path.join(BASE, 'runtime');

const FILES = {
  proposals: path.join(BASE, 'proposals.json'),
  jobs: path.join(BASE, 'jobs.json'),
  history: path.join(BASE, 'history.json'),
  lessons: path.join(ROOT, 'knowledge', 'lessons.json'),
  deepScanState: path.join(BASE, 'deep-scan-state.json'),
  events: path.join(BASE, 'events.jsonl'),
  activeJob: path.join(RUNTIME, 'active-job.json'),
};

export const CATEGORIES = ['ux', 'performance', 'security', 'branding', 'product', 'operations', 'benchmark', 'patch'];
export const ACTIVE_STATES = ['proposal', 'scout_update', 'executer_sync', 'execution', 'qa_review'];
export const FINAL_STATES = ['approved', 'reverted', 'abandoned_with_reason'];
export const AGENTS = ['scout', 'executer', 'qa'];
export const WORKFLOW = [...ACTIVE_STATES, ...FINAL_STATES];
export const LEGACY_STATE_MAP = {
  discover: 'proposal',
  approved_for_build: 'executer_sync',
  build: 'execution',
  test: 'qa_review',
  review_ready: 'qa_review',
};
export const LEGACY_AGENT_MAP = {
  planner: 'scout',
  builder: 'executer',
  verifier: 'qa',
  dispatcher: 'scout',
};

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
  await fs.mkdir(RUNTIME, { recursive: true });
  try { await fs.access(FILES.events); } catch { await fs.writeFile(FILES.events, '', 'utf8'); }
  try { await fs.access(FILES.activeJob); } catch { await fs.writeFile(FILES.activeJob, JSON.stringify({ activeJobId: null, updatedAt: null }, null, 2), 'utf8'); }
}

export async function readJson(filePath) { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
export async function writeJson(filePath, data) { await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8'); }

export const files = FILES;
export const paths = { ROOT, BASE, ARTIFACTS, RUNTIME };

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
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${y}${m}${day}-${h}${mi}${s}${ms}-${String(__seq).padStart(3, '0')}${rnd}`;
}

export function nextDailySequenceId(existingIds = [], date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const base = `${y}${m}${d}`;
  let max = 0;
  for (const raw of existingIds || []) {
    const id = String(raw || '');
    const match = id.match(new RegExp(`^${base}\\.(\\d{3})$`));
    if (match) max = Math.max(max, Number(match[1] || 0));
  }
  return `${base}.${String(max + 1).padStart(3, '0')}`;
}

export function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export function primaryTargetFile(item = {}) {
  const fileFromList = (item?.files_expected || item?.changedFiles || [])[0];
  const fileFromSpec = (item?.change_spec || [])[0]?.file;
  return String(fileFromList || fileFromSpec || '').trim();
}

export function proposalTitleStem(title) {
  return normalize(title)
    .replace(/\b\d+\b/g, ' ')
    .replace(/\btriaged\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function proposalIntentKey(item = {}) {
  const file = primaryTargetFile(item).toLowerCase();
  const title = proposalTitleStem(item?.title);
  return `${file}::${title}`.trim();
}

export function sameProposalIntent(a = {}, b = {}) {
  const fileA = primaryTargetFile(a).toLowerCase();
  const fileB = primaryTargetFile(b).toLowerCase();
  if (!fileA || !fileB || fileA !== fileB) return false;

  const titleA = proposalTitleStem(a?.title);
  const titleB = proposalTitleStem(b?.title);
  return Boolean(titleA && titleB && titleA === titleB);
}

export function itemTimestampMs(item = {}) {
  const ts = item?.timestamps?.updatedAt
    || item?.timestamps?.createdAt
    || item?.updatedAt
    || item?.createdAt
    || item?._plannedAt
    || null;
  const ms = ts ? new Date(ts).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

export function compareProposalPriority(a = {}, b = {}) {
  const priorityRank = { P1: 1, P2: 2, P3: 3 };
  return (priorityRank[a?.priority] || 9) - (priorityRank[b?.priority] || 9)
    || (Number(b?.impactScore || 0) - Number(a?.impactScore || 0))
    || (Number(b?.confidenceScore || 0) - Number(a?.confidenceScore || 0))
    || (Number(a?.effortScore || 99) - Number(b?.effortScore || 99))
    || ((Array.isArray(b?.evidence) ? b.evidence.length : 0) - (Array.isArray(a?.evidence) ? a.evidence.length : 0))
    || (itemTimestampMs(a) - itemTimestampMs(b))
    || String(a?.id || '').localeCompare(String(b?.id || ''));
}

export function canonicalState(state) {
  return LEGACY_STATE_MAP[String(state || '').trim()] || String(state || '').trim();
}

export function isActiveState(state) {
  return ACTIVE_STATES.includes(canonicalState(state));
}

export function isCompletedState(state) {
  return FINAL_STATES.includes(canonicalState(state));
}

export function normalizeRetries(retries = {}) {
  return {
    scout: Number(retries.scout ?? retries.planning ?? 0),
    sync: Number(retries.sync ?? 0),
    executer: Number(retries.executer ?? retries.build ?? 0),
    qa: Number(retries.qa ?? retries.testing ?? retries.verification ?? 0),
  };
}

export function normalizeJob(job = {}) {
  const normalized = { ...job };
  normalized.state = canonicalState(normalized.state);
  normalized.ownerAgent = LEGACY_AGENT_MAP[String(normalized.ownerAgent || '').trim()] || normalized.ownerAgent || stageOwner(normalized.state);
  normalized.retries = normalizeRetries(normalized.retries);
  normalized.timestamps ||= { createdAt: nowIso(), updatedAt: nowIso() };
  normalized.timestamps.createdAt ||= normalized.timestamps.updatedAt || nowIso();
  normalized.timestamps.updatedAt ||= normalized.timestamps.createdAt || nowIso();
  normalized.stageStartedAt ||= normalized.timestamps.updatedAt || normalized.timestamps.createdAt || nowIso();
  return normalized;
}

export function normalizeJobs(jobs = []) {
  return (jobs || []).map((job) => normalizeJob(job));
}

export function stageOwner(state) {
  const current = canonicalState(state);
  if (current === 'proposal' || current === 'scout_update') return 'scout';
  if (current === 'executer_sync' || current === 'execution') return 'executer';
  if (current === 'qa_review') return 'qa';
  return null;
}

export function canTransition(from, to) {
  const allowed = {
    proposal: ['executer_sync', 'abandoned_with_reason'],
    scout_update: ['executer_sync', 'abandoned_with_reason'],
    executer_sync: ['execution', 'scout_update', 'abandoned_with_reason'],
    execution: ['qa_review', 'executer_sync', 'scout_update', 'abandoned_with_reason'],
    qa_review: ['approved', 'reverted', 'scout_update', 'execution', 'abandoned_with_reason'],
    approved: [],
    reverted: [],
    abandoned_with_reason: [],
  };
  return (allowed[canonicalState(from)] || []).includes(canonicalState(to));
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

export const WIP_LIMITS = { scout: 10, executer: 3, qa: 20 };

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

export function buildProposalIndex(proposals = []) {
  return new Map((proposals || []).map((proposal) => [String(proposal?.id || ''), proposal]));
}

export function proposalLineageRoot(proposalId, proposalsOrIndex = []) {
  const proposalIndex = proposalsOrIndex instanceof Map ? proposalsOrIndex : buildProposalIndex(proposalsOrIndex);
  const startId = String(proposalId || '').trim();
  if (!startId) return '';

  let currentId = startId;
  const seen = new Set();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const proposal = proposalIndex.get(currentId);
    const parentId = String(proposal?.triagedFrom || '').trim();
    if (!parentId) break;
    currentId = parentId;
  }

  return currentId || startId;
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

export async function appendEvent({ jobId, proposalId = null, stage, message, meta = {} }) {
  const row = {
    ts: nowIso(),
    jobId,
    proposalId,
    stage,
    message,
    meta,
  };
  await fs.appendFile(FILES.events, `${JSON.stringify(row)}\n`, 'utf8');
}

export async function getActiveJobLock() {
  try { return JSON.parse(await fs.readFile(FILES.activeJob, 'utf8')); } catch { return { activeJobId: null, updatedAt: null }; }
}

export async function setActiveJobLock(activeJobId) {
  const payload = { activeJobId: activeJobId || null, updatedAt: nowIso() };
  await fs.writeFile(FILES.activeJob, JSON.stringify(payload, null, 2), 'utf8');
}

export async function withEngineRunLock(name, fn, { staleMs = 8 * 60 * 1000 } = {}) {
  const lockPath = path.join(RUNTIME, `${name}.lock`);
  const payload = { pid: process.pid, acquiredAt: nowIso(), name };

  const tryAcquire = async () => {
    const handle = await fs.open(lockPath, 'wx');
    await handle.writeFile(JSON.stringify(payload, null, 2), 'utf8');
    return handle;
  };

  let handle = null;
  try {
    try {
      handle = await tryAcquire();
    } catch (e) {
      if (e?.code !== 'EEXIST') return { skipped: true, reason: `lock_error:${e?.code || 'unknown'}` };
      try {
        const raw = await fs.readFile(lockPath, 'utf8');
        const lock = JSON.parse(raw);
        const ageMs = Date.now() - new Date(lock?.acquiredAt || 0).getTime();
        if (!Number.isFinite(ageMs) || ageMs > staleMs) {
          await fs.unlink(lockPath);
          handle = await tryAcquire();
        } else {
          return { skipped: true, reason: 'lock_held' };
        }
      } catch {
        try {
          await fs.unlink(lockPath);
          handle = await tryAcquire();
        } catch {
          return { skipped: true, reason: 'lock_held' };
        }
      }
    }

    const result = await fn();
    return { skipped: false, result };
  } finally {
    if (handle) {
      try { await handle.close(); } catch {}
      try { await fs.unlink(lockPath); } catch {}
    }
  }
}

export function currentStageStartedAt(job = {}) {
  return job?.stageStartedAt || job?.timestamps?.updatedAt || job?.timestamps?.createdAt || null;
}

export function stageAgeMinutes(job = {}, nowMs = Date.now()) {
  const startedAt = new Date(currentStageStartedAt(job) || 0).getTime();
  if (!Number.isFinite(startedAt) || startedAt <= 0) return 0;
  return Math.max(0, Math.floor((nowMs - startedAt) / 60000));
}

export function transitionJob(job = {}, nextState, { ownerAgent, resetStageStartedAt = false } = {}) {
  const normalizedNext = canonicalState(nextState);
  const now = nowIso();
  const previousState = canonicalState(job?.state);

  job.state = normalizedNext;
  if (ownerAgent !== undefined) job.ownerAgent = ownerAgent;
  job.timestamps ||= { createdAt: now, updatedAt: now };
  job.timestamps.createdAt ||= now;
  job.timestamps.updatedAt = now;
  if (resetStageStartedAt || previousState !== normalizedNext || !job.stageStartedAt) {
    job.stageStartedAt = now;
  }

  return job;
}

export async function finalizeJob(jobs = [], history = [], job = {}) {
  await setActiveJobLock(null);
  history.push({ ...job });
  await writeJson(files.history, history);
  await writeJson(files.jobs, jobs.filter((entry) => entry.id !== job.id));
}

export function approvedJobSummary(job = {}, proposal = {}) {
  const change = String(proposal?.proposed_change || job?.summary || job?.title || 'Updated the public portfolio page').trim().replace(/\s+/g, ' ');
  const files = Array.isArray(job?.changedFiles) && job.changedFiles.length > 0
    ? ` across ${job.changedFiles.length} file${job.changedFiles.length === 1 ? '' : 's'}`
    : '';
  const sentence = `${change}${files}, and the public portfolio page now shows this change in the completed before/after preview.`;
  return sentence.replace(/\s+/g, ' ').trim();
}

export function capturePublicPreviewCommand(outputPath) {
  const quotedPath = JSON.stringify(outputPath);
  return [
    `WOT_PREVIEW_OUTPUT=${quotedPath} node scripts/autonomous-engine/capture-public-preview.mjs`,
    `WOT_PREVIEW_OUTPUT=${quotedPath} npx -y -p playwright node scripts/autonomous-engine/capture-public-preview.mjs`,
    `WOT_PREVIEW_OUTPUT=${quotedPath} npx playwright test scripts/autonomous-engine/capture-public-preview.spec.js --reporter=line --workers=1`,
  ];
}

export async function capturePublicPreview(outputPath, { timeoutMs = 180000 } = {}) {
  let lastError = null;
  for (const cmd of capturePublicPreviewCommand(outputPath)) {
    try {
      execSync(cmd, { stdio: 'pipe', timeout: timeoutMs, cwd: ROOT });
      return { ok: true, command: cmd };
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError ? String(lastError?.stderr || lastError?.stdout || lastError?.message || lastError) : 'unknown_capture_error';
  return { ok: false, error: detail };
}
