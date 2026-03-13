#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { ensureEngineFiles, files, paths, nowIso, readJson, writeJson, appendEvent, WIP_LIMITS } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);
const proposals = await readJson(files.proposals);
const proposalIds = new Set((proposals || []).map((p) => String(p.id || '')));

let fixed = 0;
const ts = nowIso();

const markProposal = async (job, reason) => {
  job.state = 'proposal';
  job.ownerAgent = 'planner';
  job.quality = { ...(job.quality || {}), status: 'needs_human_review', checkedAt: ts, reason };
  job.timestamps ||= { createdAt: ts, updatedAt: ts };
  job.timestamps.updatedAt = ts;
  await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'proposal', message: `critical-flow-guard: ${reason}` });
  fixed += 1;
};

for (const job of jobs) {
  const proposalRefExists = [...proposalIds].some((id) => job.proposalId === id || String(job.proposalId || '').startsWith(id));
  if (['proposal', 'approved_for_build', 'build', 'test'].includes(job.state) && !proposalRefExists) {
    await markProposal(job, 'orphan_job_auto_fixed');
    continue;
  }

  if (['approved_for_build', 'build', 'test'].includes(job.state) && job.quality?.status && job.quality.status !== 'pass') {
    await markProposal(job, 'quality_bypass_auto_fixed');
    continue;
  }

  if (String(job.summary || '').includes('halted: no implementation diff') && Number(job.retries?.build || 0) >= 1 && job.state !== 'proposal') {
    await markProposal(job, 'ping_pong_no_diff_auto_fixed');
    continue;
  }
}

// deadlock/lock guard
const activeLock = JSON.parse(await fs.readFile(files.activeJob, 'utf8'));
if (activeLock?.activeJobId) {
  const activeExists = jobs.some((j) => j.id === activeLock.activeJobId && ['approved_for_build', 'build', 'test'].includes(j.state));
  if (!activeExists) {
    await fs.writeFile(files.activeJob, JSON.stringify({ activeJobId: null, updatedAt: ts }, null, 2), 'utf8');
    fixed += 1;
  }
}

const runtimeEntries = await fs.readdir(paths.RUNTIME);
for (const name of runtimeEntries) {
  if (!name.endsWith('.lock')) continue;
  const full = path.join(paths.RUNTIME, name);
  try {
    const raw = await fs.readFile(full, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const ageMs = Date.now() - new Date(parsed.acquiredAt || 0).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 15 * 60 * 1000) {
      await fs.unlink(full);
      fixed += 1;
    }
  } catch {
    try { await fs.unlink(full); fixed += 1; } catch {}
  }
}

// deadlock: multiple active jobs -> keep oldest as active, move rest back
const active = jobs
  .filter((j) => ['approved_for_build', 'build', 'test'].includes(j.state))
  .sort((a, b) => new Date(a.timestamps?.createdAt || 0).getTime() - new Date(b.timestamps?.createdAt || 0).getTime());
if (active.length > 1) {
  for (const extra of active.slice(1)) {
    await markProposal(extra, 'deadlock_multi_active_auto_fixed');
  }
}

// planning deadlock: if proposal queue is saturated with non-runnable human-review items,
// archive oldest sticky jobs so scout/planner can admit at least one fresh proposal each cycle.
const proposalJobs = jobs.filter((j) => j.state === 'proposal');
const passCount = proposalJobs.filter((j) => j.quality?.status === 'pass').length;
if (proposalJobs.length >= WIP_LIMITS.planning && passCount === 0) {
  const overflow = Math.max(1, proposalJobs.length - (WIP_LIMITS.planning - 1));
  const candidates = proposalJobs
    .filter((j) => j.quality?.status === 'needs_human_review')
    .sort((a, b) => {
      const aScore = Number(a.retries?.planning || 0) + Number(a.retries?.build || 0) + Number(a.retries?.testing || 0);
      const bScore = Number(b.retries?.planning || 0) + Number(b.retries?.build || 0) + Number(b.retries?.testing || 0);
      if (bScore !== aScore) return bScore - aScore;
      return new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime() - new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime();
    })
    .slice(0, Math.max(0, overflow));

  for (const job of candidates) {
    job.state = 'abandoned_with_reason';
    job.finalReason = 'planning_queue_deadlock_auto_archived';
    job.ownerAgent = 'planner';
    job.timestamps ||= { createdAt: ts, updatedAt: ts };
    job.timestamps.updatedAt = ts;
    history.push({ ...job });
    await appendEvent({ jobId: job.id, proposalId: job.proposalId, stage: 'abandoned_with_reason', message: 'critical-flow-guard: planning queue deadlock auto-archived stale human-review job' });
    fixed += 1;
  }
}

const liveJobs = jobs.filter((j) => !['approved', 'reverted', 'abandoned_with_reason'].includes(j.state));
await writeJson(files.jobs, liveJobs);
await writeJson(files.history, history.slice(-1500));
console.log(`[critical-flow-guard] fixed ${fixed} issue(s)`);
