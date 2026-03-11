import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const action = String(fd.get('action') || '');
  const jobId = String(fd.get('jobId') || '');

  if (!jobId || !['approve', 'reject'].includes(action)) {
    return NextResponse.redirect(new URL('/admin/autonomous-engine', req.url));
  }

  try {
    execSync(`node scripts/autonomous-engine/review-action.mjs ${action} ${jobId}`, { cwd: process.cwd(), stdio: 'pipe' });
  } catch {}

  const u = new URL('/admin/autonomous-engine', req.url);
  u.searchParams.set('section', 'completed');
  u.searchParams.set('ts', String(Date.now()));
  return NextResponse.redirect(u, { status: 303 });
}
