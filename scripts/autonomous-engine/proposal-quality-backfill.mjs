#!/usr/bin/env node
import { ensureEngineFiles, files, readJson, writeJson, nowIso } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
let updated = 0;

for (const p of proposals) {
  let changed = false;
  if (!p.kpi_target || String(p.kpi_target).trim().length < 8) {
    p.kpi_target = 'Target KPI: measurable before/after improvement with explicit threshold.';
    changed = true;
  }
  if (!p.benchmark_delta || String(p.benchmark_delta).trim().length < 8) {
    p.benchmark_delta = 'Benchmark delta: identify best-practice fintech gap and closing action.';
    changed = true;
  }
  if (!Array.isArray(p.risk_controls) || p.risk_controls.length < 2) {
    p.risk_controls = ['Single-intent scoped implementation', 'QA artifacts required before completion'];
    changed = true;
  }
  if (changed) {
    p._qualityBackfilledAt = nowIso();
    updated += 1;
  }
}

await writeJson(files.proposals, proposals);
console.log(`[proposal-quality-backfill] updated ${updated} proposal(s)`);
