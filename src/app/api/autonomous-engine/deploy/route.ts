import { NextResponse } from 'next/server';
import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type EngineJob = {
  id?: string;
  state?: string;
  timestamps?: {
    updatedAt?: string;
    createdAt?: string;
  };
};

const ENGINE_DIR = path.join('Agent Team', 'autonomous-engine');
const DEPLOY_EXCLUDES = [
  '.next/',
  'node_modules/',
  'local_pg_data/',
  `${ENGINE_DIR}/`,
  'dev.db',
  'dev.log',
  'db.log',
  'server_action.log',
  'server_debug.log',
  'logfile',
];

function run(command: string, options: Record<string, unknown> = {}) {
  return execSync(command, {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 300000,
    maxBuffer: 30 * 1024 * 1024,
    ...options,
  }).toString().trim();
}

function runFile(file: string, args: string[], options: Record<string, unknown> = {}) {
  return execFileSync(file, args, {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 300000,
    maxBuffer: 30 * 1024 * 1024,
    ...options,
  }).toString().trim();
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function latestApprovedJobs(): EngineJob[] {
  const base = path.join(process.cwd(), ENGINE_DIR);
  const history = safeReadJson<EngineJob[]>(path.join(base, 'history.json'), []);
  const jobs = safeReadJson<EngineJob[]>(path.join(base, 'jobs.json'), []);
  const byId = new Map<string, EngineJob>();

  for (const job of [...history, ...jobs]) {
    if (!job?.id || job.state !== 'approved') continue;
    const prev = byId.get(job.id);
    const prevTs = new Date(prev?.timestamps?.updatedAt || prev?.timestamps?.createdAt || 0).getTime();
    const nextTs = new Date(job.timestamps?.updatedAt || job.timestamps?.createdAt || 0).getTime();
    if (!prev || nextTs >= prevTs) byId.set(job.id, job);
  }

  return [...byId.values()].sort((a, b) => {
    const aTs = new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime();
    const bTs = new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime();
    return aTs - bTs;
  });
}

function approvedCommitShas(): string[] {
  const base = path.join(process.cwd(), ENGINE_DIR, 'artifacts');
  const shas: string[] = [];

  for (const job of latestApprovedJobs()) {
    if (!job.id) continue;
    const shaPath = path.join(base, job.id, 'commit-sha.txt');
    if (!fs.existsSync(shaPath)) continue;
    const sha = fs.readFileSync(shaPath, 'utf8').trim();
    if (!sha || sha === 'no-commit-sha') continue;
    shas.push(sha);
  }

  return [...new Set(shas)];
}

function isDeployablePath(filePath: string) {
  return !DEPLOY_EXCLUDES.some((prefix) => filePath === prefix || filePath.startsWith(prefix));
}

function dirtyFiles() {
  const output = execFileSync('git', ['status', '--porcelain', '-z'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 300000,
    maxBuffer: 30 * 1024 * 1024,
  }).toString();

  return output
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const raw = entry.slice(3);
      if (entry.startsWith('R') || entry[1] === 'R' || raw.includes(' -> ')) {
        return (raw.split(' -> ').pop() || raw).replace(/^"|"$/g, '');
      }
      return raw.replace(/^"|"$/g, '');
    });
}

function ensureApprovedCommitsPresent() {
  const applied: string[] = [];

  for (const sha of approvedCommitShas()) {
    try {
      run(`git rev-parse --verify ${sha}^{commit}`);
    } catch {
      continue;
    }

    try {
      run(`git merge-base --is-ancestor ${sha} HEAD`);
      continue;
    } catch {
      run(`git cherry-pick -x ${sha}`);
      applied.push(sha);
    }
  }

  return applied;
}

function commitDeployableWorkspaceChanges() {
  const deployable = dirtyFiles().filter(isDeployablePath);
  if (deployable.length === 0) return { committed: false, files: [] as string[] };

  runFile('git', ['add', '--', ...deployable]);
  const staged = runFile('git', ['diff', '--cached', '--name-only'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (staged.length === 0) return { committed: false, files: [] as string[] };

  run(`git commit -m ${JSON.stringify('deploy: sync local production-ready workspace')}`);
  return { committed: true, files: staged };
}

export async function POST(req: Request) {
  try {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    const startSha = run('git rev-parse --short HEAD');
    const cherryPicked = ensureApprovedCommitsPresent();
    const localCommit = commitDeployableWorkspaceChanges();
    const shouldRunSafetyBuild = process.env.NODE_ENV === 'production';

    if (shouldRunSafetyBuild) {
      run('npm run -s build', { timeout: 1200000 });
    }

    run('git push origin HEAD:main', { timeout: 300000 });

    const endSha = run('git rev-parse --short HEAD');
    const u = new URL('/admin/autonomous-engine', req.url);
    u.searchParams.set('section', 'completed');
    u.searchParams.set('ts', String(Date.now()));

    return NextResponse.json({
      ok: true,
      redirect: `${u.pathname}${u.search}`,
      branch,
      before: startSha,
      after: endSha,
      cherryPickedCount: cherryPicked.length,
      localFileCount: localCommit.files.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(e?.message || e),
        redirect: '/admin/autonomous-engine?section=completed',
      },
      { status: 500 },
    );
  }
}
