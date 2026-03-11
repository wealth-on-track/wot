#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const base = path.join(process.cwd(), 'Agent Team', 'autonomous-engine');
const runtime = path.join(base, 'runtime');
const artifacts = path.join(base, 'artifacts');

await fs.mkdir(base, { recursive: true });
await fs.mkdir(runtime, { recursive: true });
await fs.mkdir(artifacts, { recursive: true });

await fs.writeFile(path.join(base, 'proposals.json'), '[]\n', 'utf8');
await fs.writeFile(path.join(base, 'jobs.json'), '[]\n', 'utf8');
await fs.writeFile(path.join(base, 'history.json'), '[]\n', 'utf8');
await fs.writeFile(path.join(base, 'events.jsonl'), '', 'utf8');
await fs.writeFile(path.join(runtime, 'active-job.json'), JSON.stringify({ activeJobId: null, updatedAt: null }, null, 2), 'utf8');

try {
  const entries = await fs.readdir(artifacts, { withFileTypes: true });
  for (const e of entries) {
    await fs.rm(path.join(artifacts, e.name), { recursive: true, force: true });
  }
} catch {}

console.log('[reset-state] done');
