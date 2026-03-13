#!/usr/bin/env node
import { ensureEngineFiles, files, readJson, normalizeJobs } from './lib.mjs';

await ensureEngineFiles();
const jobs = normalizeJobs(await readJson(files.jobs));
const history = normalizeJobs(await readJson(files.history));

const all = [...history, ...jobs];
const total = all.length || 1;
const qaReview = all.filter((j) => j.state === 'qa_review').length;
const approved = all.filter((j) => j.state === 'approved').length;
const humanReview = all.filter((j) => j.quality?.status === 'needs_human_review').length;
const qaFailures = all.filter((j) => (j.retries?.qa || 0) > 0).length;

const passRate = Math.round((approved / total) * 100);
const readyRate = Math.round((qaReview / total) * 100);
const escalationRate = Math.round((humanReview / total) * 100);

console.log(JSON.stringify({
  total,
  passRate,
  readyRate,
  escalationRate,
  qaFailures,
  states: all.reduce((a, j) => (a[j.state] = (a[j.state] || 0) + 1, a), {}),
}, null, 2));
