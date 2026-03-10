#!/usr/bin/env node
import { ensureEngineFiles, files, readJson } from './lib.mjs';

await ensureEngineFiles();
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);

const all = [...history, ...jobs];
const total = all.length || 1;
const reviewReady = all.filter((j) => j.state === 'review_ready').length;
const approved = all.filter((j) => j.state === 'approved').length;
const humanReview = all.filter((j) => j.quality?.status === 'needs_human_review').length;
const verifyFailures = all.filter((j) => (j.retries?.testing || 0) > 0).length;

const passRate = Math.round((approved / total) * 100);
const readyRate = Math.round((reviewReady / total) * 100);
const escalationRate = Math.round((humanReview / total) * 100);

console.log(JSON.stringify({
  total,
  passRate,
  readyRate,
  escalationRate,
  verifyFailures,
  states: all.reduce((a, j) => (a[j.state] = (a[j.state] || 0) + 1, a), {}),
}, null, 2));
