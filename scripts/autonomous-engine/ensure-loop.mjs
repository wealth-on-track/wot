#!/usr/bin/env node
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const intervalSec = Number(process.argv[2] || 300);
const maxStaleSec = Number(process.argv[3] || intervalSec * 2 + 30);
const base = path.join(process.cwd(), 'Agent Team', 'autonomous-engine', 'runtime');
const pidFile = path.join(base, 'loop.pid');
const heartbeatFile = path.join(base, 'heartbeat.json');

await fs.mkdir(base, { recursive: true });

const startLoop = () => {
  execSync(`nohup node scripts/autonomous-engine/loop.mjs ${intervalSec} > /tmp/wot-auto-loop.log 2>&1 &`, { stdio: 'ignore' });
  console.log('[ensure-loop] started loop');
};

let needsStart = false;
let pid = null;
try {
  pid = Number((await fs.readFile(pidFile, 'utf8')).trim());
  process.kill(pid, 0);
} catch {
  needsStart = true;
}

let stale = true;
try {
  const hb = JSON.parse(await fs.readFile(heartbeatFile, 'utf8'));
  const ageSec = Math.floor((Date.now() - new Date(hb.ts).getTime()) / 1000);
  stale = ageSec > maxStaleSec;
  if (!stale) console.log(`[ensure-loop] healthy (age=${ageSec}s pid=${hb.pid})`);
} catch {
  stale = true;
}

if (stale) {
  needsStart = true;
  if (pid) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
}

if (!needsStart && !pid) {
  needsStart = true;
}

if (needsStart) startLoop();
else console.log('[ensure-loop] no action needed');
