#!/usr/bin/env node
import { ensureEngineFiles, files, nowIso, readJson, writeJson, appendEvent, normalizeJobs } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));

const now = Date.now();
const remindAfterMin = 30;
let reminded = 0;

for (const j of jobs) {
  if (j.state !== '__disabled__') continue;
  const updatedAt = new Date(j.timestamps?.updatedAt || j.timestamps?.createdAt || 0).getTime();
  if (!updatedAt) continue;
  const ageMin = Math.floor((now - updatedAt) / 60000);
  if (ageMin < remindAfterMin) continue;

  const lastRemind = new Date(j.reviewReminderAt || 0).getTime();
  if (lastRemind && (now - lastRemind) < 60 * 60000) continue; // max once/hour

  j.reviewReminderAt = nowIso();
  await appendEvent({
    jobId: j.id,
    proposalId: j.proposalId,
    stage: 'approved',
    message: `auto-complete reminder disabled`,
  });
  reminded += 1;
}

await writeJson(files.jobs, jobs);
console.log(`[review-reminder] reminded ${reminded} job(s)`);
