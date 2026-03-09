#!/usr/bin/env node
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const intervalSec = Number(process.argv[2] || 300);
const base = path.join(process.cwd(), 'Agent Team', 'autonomous-engine');
const runtimeDir = path.join(base, 'runtime');
const pidFile = path.join(runtimeDir, 'loop.pid');
const heartbeatFile = path.join(runtimeDir, 'heartbeat.json');

await fs.mkdir(runtimeDir, { recursive: true });

async function writeHeartbeat(status = 'ok', note = '') {
  await fs.writeFile(
    heartbeatFile,
    JSON.stringify({ ts: new Date().toISOString(), status, note, pid: process.pid, intervalSec }, null, 2),
    'utf8',
  );
}

async function acquireLock() {
  try {
    const oldPid = Number((await fs.readFile(pidFile, 'utf8')).trim());
    if (oldPid && oldPid !== process.pid) {
      try {
        process.kill(oldPid, 0);
        console.log(`[loop] another loop is running (pid ${oldPid}), exiting`);
        process.exit(0);
      } catch {}
    }
  } catch {}
  await fs.writeFile(pidFile, String(process.pid), 'utf8');
}

async function cleanup() {
  try {
    const pid = Number((await fs.readFile(pidFile, 'utf8')).trim());
    if (pid === process.pid) await fs.unlink(pidFile);
  } catch {}
}

await acquireLock();
console.log(`[loop] starting local autonomous loop every ${intervalSec}s (pid ${process.pid})`);
await writeHeartbeat('starting');

let busy = false;
const tick = async () => {
  if (busy) return;
  busy = true;
  const started = Date.now();
  try {
    execSync('node scripts/autonomous-engine/tick.mjs', { stdio: 'inherit' });
    await writeHeartbeat('ok', `tick_ms=${Date.now() - started}`);
  } catch (e) {
    await writeHeartbeat('error', String(e?.message || e));
  } finally {
    busy = false;
  }
};

process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
process.on('exit', () => { cleanup(); });

await tick();
setInterval(() => { tick(); }, intervalSec * 1000);
