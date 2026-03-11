import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(req: Request) {
  try {
    // Optional safety build before deploy
    execSync('npm run -s build', { cwd: process.cwd(), stdio: 'pipe', timeout: 1200000, maxBuffer: 30 * 1024 * 1024 });

    // Commit any local changes (if present)
    try {
      const status = execSync('git status --porcelain', { cwd: process.cwd(), stdio: 'pipe' }).toString().trim();
      if (status) {
        execSync('git add -A', { cwd: process.cwd(), stdio: 'pipe' });
        execSync('git commit -m "deploy: sync local approved changes"', { cwd: process.cwd(), stdio: 'pipe' });
      }
    } catch {}

    execSync('git push origin HEAD:main', { cwd: process.cwd(), stdio: 'pipe', timeout: 300000, maxBuffer: 30 * 1024 * 1024 });

    const u = new URL('/admin/autonomous-engine', req.url);
    u.searchParams.set('section', 'completed');
    u.searchParams.set('ts', String(Date.now()));
    return NextResponse.json({ ok: true, redirect: `${u.pathname}${u.search}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e), redirect: '/admin/autonomous-engine?section=completed' }, { status: 500 });
  }
}
