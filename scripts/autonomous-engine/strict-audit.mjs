#!/usr/bin/env node
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { ensureEngineFiles, files, CATEGORIES, FINAL_STATES, readJson, AGENTS, WORKFLOW } from './lib.mjs';

await ensureEngineFiles();
const proposals = await readJson(files.proposals);
const jobs = await readJson(files.jobs);
const history = await readJson(files.history);
const lessons = await readJson(files.lessons);

const checks = [];
const ok = (name, pass, evidence) => checks.push({ name, pass, evidence });

ok('categories', CATEGORIES.length === 8, `count=${CATEGORIES.length}`);
ok('agents_defined', AGENTS.join(',') === 'scout,planner,builder,verifier', AGENTS.join(','));
ok('workflow_defined', WORKFLOW.includes('review_ready') && WORKFLOW.includes('approved_for_build'), WORKFLOW.join(' -> '));
ok('lessons_file', Array.isArray(lessons), `lessons=${lessons.length}`);
ok('proposal_format', proposals.every((p) => p.id && p.title && CATEGORIES.includes(p.category) && Array.isArray(p.evidence) && p.evidence.length > 0), `proposals=${proposals.length}`);
ok('task_size_rule', proposals.every((p) => Array.isArray(p.files_expected) && p.files_expected.length <= 5), 'all proposals <=5 files');
ok('job_states_valid', jobs.every((j) => WORKFLOW.includes(j.state)), `jobs=${jobs.length}`);
ok('final_states_only_for_completed', history.every((j) => ['approved','reverted','abandoned_with_reason','review_ready'].includes(j.state)), `history=${history.length}`);
ok('preview_instructions_present', jobs.every((j) => String(j.previewInstructions || '').trim().length > 0), 'all jobs include preview instructions');
ok('verification_scripts_exist', ['check-integration.mjs','check-e2e.mjs','check-performance.mjs'].every((n)=>existsSync(path.join(process.cwd(),'scripts','autonomous-engine',n))), 'integration/e2e/performance checks exist');
ok('loop_script_exists', existsSync(path.join(process.cwd(),'scripts','autonomous-engine','loop.mjs')), 'continuous local loop script exists');

const artifactsBase = path.join(process.cwd(), 'Agent Team', 'autonomous-engine', 'artifacts');
let artifactsOk = true;
let commitArtifactOk = true;
for (const j of jobs.concat(history)) {
  const dir = path.join(artifactsBase, j.id);
  try {
    const names = await fs.readdir(dir);
    if (j.state !== 'proposal' && j.state !== 'discover' && names.length === 0) artifactsOk = false;
    if (['test','review_ready','approved'].includes(j.state) && !names.includes('commit-message.txt')) commitArtifactOk = false;
  } catch {
    if (j.state !== 'proposal' && j.state !== 'discover') artifactsOk = false;
  }
}
ok('artifacts_present', artifactsOk, 'non-proposal jobs have artifacts');
ok('build_outputs_present', commitArtifactOk, 'test/review/approved jobs have commit-message artifact');

const pass = checks.every((c) => c.pass);
console.log(JSON.stringify({ pass, checks }, null, 2));
process.exit(pass ? 0 : 1);
