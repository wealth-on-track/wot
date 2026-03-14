#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { ensureEngineFiles, files, nowIso, readJson, writeJson } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);
const proposals = await readJson(files.proposals);

const runtimeDir = path.join(process.cwd(), 'Agent Team', 'autonomous-engine', 'runtime');
await fs.mkdir(runtimeDir, { recursive: true });
const stateFile = path.join(runtimeDir, 'maintenance-state.json');
let state = { lastRunAt: null };
try { state = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch {}

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
if (state.lastRunAt && now - new Date(state.lastRunAt).getTime() < DAY) {
  console.log('[maintenance] skipped (already ran in last 24h)');
  process.exit(0);
}

// archive old finished jobs + stale human-review jobs to history and keep jobs.json clean
const keep = [];
let archived = 0;
let archivedHumanReview = 0;
const nowMs = Date.now();
for (const j of jobs) {
  const updatedAt = new Date(j.timestamps?.updatedAt || j.timestamps?.createdAt || 0).getTime();
  const staleHumanReview = j.state === 'proposal' && j.quality?.status === 'needs_human_review' && updatedAt > 0 && (nowMs - updatedAt) > (48 * 60 * 60 * 1000);

  if (['approved', 'reverted', 'abandoned_with_reason'].includes(j.state) || staleHumanReview) {
    if (staleHumanReview) {
      j.state = 'abandoned_with_reason';
      j.finalReason = 'stale_needs_human_review_archived';
      archivedHumanReview += 1;
    }
    history.push(j);
    archived += 1;
  } else {
    keep.push(j);
  }
}

// prune stale/unplannable proposals so empty queue can generate fresh work again
const activeProposalIds = new Set(keep.map((j) => String(j.proposalId || '')));
const recentCompletedProposalIds = new Set(history.slice(-300).map((j) => String(j.proposalId || '')));
const recentCompletedTitles = new Set(history.slice(-300).map((j) => String(j.title || '').trim().toLowerCase()).filter(Boolean));
const cleanedProposals = proposals.filter((p) => {
  const id = String(p?.id || '');
  const title = String(p?.title || '').trim().toLowerCase();
  if (activeProposalIds.has(id)) return true;
  if (!p?._planned) return false;
  if (recentCompletedProposalIds.has(id)) return false;
  if (title && recentCompletedTitles.has(title)) return false;
  return false;
});

// compact events to last 1200 lines
const eventsPath = path.join(process.cwd(), 'Agent Team', 'autonomous-engine', 'events.jsonl');
try {
  const lines = (await fs.readFile(eventsPath, 'utf8')).split('\n').filter(Boolean);
  const compact = lines.slice(-1200);
  await fs.writeFile(eventsPath, compact.join('\n') + (compact.length ? '\n' : ''), 'utf8');
} catch {}

await writeJson(files.jobs, keep);
await writeJson(files.history, history.slice(-1500));
await writeJson(files.proposals, cleanedProposals);
state.lastRunAt = nowIso();
await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');

console.log(`[maintenance] archived=${archived} (human_review_archived=${archivedHumanReview}) keep=${keep.length}`);
