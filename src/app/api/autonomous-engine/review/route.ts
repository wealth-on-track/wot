import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const action = String(fd.get('action') || '');
  const jobId = String(fd.get('jobId') || '');

  if (!jobId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'invalid_payload', redirect: '/admin/autonomous-engine' }, { status: 400 });
  }

  try {
    execSync(`node scripts/autonomous-engine/review-action.mjs ${action} ${jobId}`, { cwd: process.cwd(), stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as any)?.message || e), redirect: '/admin/autonomous-engine?section=proposal' }, { status: 500 });
  }

  const u = new URL('/admin/autonomous-engine', req.url);
  u.searchParams.set('section', 'completed');
  u.searchParams.set('ts', String(Date.now()));
  return NextResponse.json({ ok: true, redirect: `${u.pathname}${u.search}` }, { status: 200 });
}
