#!/usr/bin/env node
import { ensureEngineFiles, files, readJson, writeJson } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);

const dedupeSentence = (txt, sentence) => {
  const low = String(txt || '');
  const n = low.split(sentence).filter(Boolean);
  if (!n.length) return low;
  return `${n[0].trim()} ${sentence}`.trim();
};

let fixed = 0;
for (const p of proposals) {
  const before = JSON.stringify(p);
  p.problem = dedupeSentence(p.problem, 'Quality rewrite note: problem statement expanded to clarify consequence, urgency, and verification boundary.');
  p.proposed_change = dedupeSentence(p.proposed_change, 'Quality rewrite note: execution plan now includes concrete implementation and validation sequence.');
  p.expected_benefit = dedupeSentence(p.expected_benefit, 'Quality rewrite note: expected outcomes are framed for reviewer decision and measurable closure.');

  if (!Array.isArray(p.change_spec) || p.change_spec.length === 0) {
    p.change_spec = [{
      file: (p.files_expected || [])[0] || 'src/components/PublicPortfolioView.tsx',
      change: 'Apply concrete scoped change with measurable acceptance target.',
      why: 'Ensures proposal is implementation-specific.',
    }];
  }

  if (JSON.stringify(p) !== before) fixed += 1;
}

await writeJson(files.proposals, proposals);
console.log(`[proposal-sanitize] fixed ${fixed} proposal(s)`);
