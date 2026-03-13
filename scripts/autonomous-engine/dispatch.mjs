#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, writeArtifact, WIP_LIMITS, appendEvent, getActiveJobLock, setActiveJobLock, withEngineRunLock, buildProposalIndex, proposalLineageRoot, normalizeJobs } from './lib.mjs';

async function main() {
  await ensureEngineFiles();
  const proposals = await readJson(files.proposals);
  const jobs = normalizeJobs(await readJson(files.jobs));
  const proposalIndex = buildProposalIndex(proposals);

  const executerCount = jobs.filter((j) => ['executer_sync', 'execution'].includes(j.state)).length;
  const qaCount = jobs.filter((j) => j.state === 'qa_review').length;
  const activeCount = executerCount + qaCount;

  if (activeCount >= 1) {
    console.log(`[dispatch] single-active guard in place (${activeCount} active)`);
    return;
  }

  if (qaCount >= WIP_LIMITS.qa) {
    console.log('[dispatch] qa_review WIP limit reached');
    return;
  }

  if (executerCount >= WIP_LIMITS.executer) {
    console.log('[dispatch] executer WIP limit reached');
    return;
  }

  const lock = await getActiveJobLock();
  const hasLockedActive = lock?.activeJobId && jobs.some((j) => j.id === lock.activeJobId && ['executer_sync', 'execution', 'qa_review'].includes(j.state));
  if (hasLockedActive) {
    console.log(`[dispatch] active lock in place (${lock.activeJobId})`);
    return;
  }
  if (lock?.activeJobId && !hasLockedActive) {
    await setActiveJobLock(null);
  }

  const activeProposalRoots = new Set(
    jobs
      .filter((j) => ['executer_sync', 'execution', 'qa_review'].includes(j.state))
      .map((j) => proposalLineageRoot(j.proposalId, proposalIndex))
      .filter(Boolean),
  );

  const priorityRank = { P1: 1, P2: 2, P3: 3 };
  const next = jobs
    .filter((j) => ['proposal', 'scout_update'].includes(j.state) && ['pass', 'proposal_ready'].includes(j.quality?.status) && !activeProposalRoots.has(proposalLineageRoot(j.proposalId, proposalIndex)))
    .sort((a, b) =>
      (priorityRank[a.priority] || 9) - (priorityRank[b.priority] || 9)
      || (Number(a.retries?.qa || 0) - Number(b.retries?.qa || 0))
      || (new Date(a.timestamps.createdAt || a.timestamps.updatedAt || 0).getTime() - new Date(b.timestamps.createdAt || b.timestamps.updatedAt || 0).getTime())
    )[0];

  if (next) {
    next.state = 'executer_sync';
    next.ownerAgent = 'executer';
    next.timestamps.updatedAt = nowIso();
    await writeArtifact(next.id, 'dispatch-decision.txt', `Scout synced proposal with Executer and queued execution (priority=${next.priority || 'P2'}).`);
    await appendEvent({ jobId: next.id, proposalId: next.proposalId, stage: 'executer_sync', message: `Scout synced with Executer and queued execution (priority=${next.priority || 'P2'})` });
    await setActiveJobLock(next.id);
    console.log(`[dispatch] promoted ${next.id} to executer_sync`);
  } else {
    const blockedByActiveProposal = jobs.filter((j) => j.state === 'proposal' && ['pass', 'proposal_ready'].includes(j.quality?.status) && activeProposalRoots.has(proposalLineageRoot(j.proposalId, proposalIndex))).length;
    if (blockedByActiveProposal > 0) {
      console.log(`[dispatch] no proposal to activate (blocked duplicates=${blockedByActiveProposal})`);
    } else {
      console.log('[dispatch] no proposal to activate');
    }
  }

  await writeJson(files.jobs, jobs);
}

const lockResult = await withEngineRunLock('dispatch-run', main);
if (lockResult?.skipped) {
  console.log(`[dispatch] skipped (${lockResult.reason})`);
}
