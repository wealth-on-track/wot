import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(req: Request) {
  try {
    execSync('node scripts/autonomous-engine/tick.mjs', { cwd: process.cwd(), stdio: 'pipe' });
  } catch {}
  return NextResponse.redirect(new URL('/admin/autonomous-engine', req.url));
}
