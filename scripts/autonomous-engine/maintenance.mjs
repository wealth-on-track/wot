#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { ensureEngineFiles, files, nowIso, readJson, writeJson } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);

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

// archive old finished jobs to history and keep jobs.json clean
const keep = [];
let archived = 0;
for (const j of jobs) {
  if (['approved', 'reverted', 'abandoned_with_reason'].includes(j.state)) {
    history.push(j);
    archived += 1;
  } else {
    keep.push(j);
  }
}

// compact events to last 1200 lines
const eventsPath = path.join(process.cwd(), 'Agent Team', 'autonomous-engine', 'events.jsonl');
try {
  const lines = (await fs.readFile(eventsPath, 'utf8')).split('\n').filter(Boolean);
  const compact = lines.slice(-1200);
  await fs.writeFile(eventsPath, compact.join('\n') + (compact.length ? '\n' : ''), 'utf8');
} catch {}

await writeJson(files.jobs, keep);
await writeJson(files.history, history.slice(-1500));
state.lastRunAt = nowIso();
await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');

console.log(`[maintenance] archived=${archived} keep=${keep.length}`);
