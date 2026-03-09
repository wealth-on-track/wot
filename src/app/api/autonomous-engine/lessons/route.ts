import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const item = {
    job_id: String(fd.get('job_id') || ''),
    category: String(fd.get('category') || ''),
    liked: String(fd.get('liked') || ''),
    disliked: String(fd.get('disliked') || ''),
    notes: String(fd.get('notes') || ''),
    created_at: new Date().toISOString(),
  };

  const fp = path.join(process.cwd(), 'knowledge', 'lessons.json');
  await fs.mkdir(path.dirname(fp), { recursive: true });
  let arr: any[] = [];
  try { arr = JSON.parse(await fs.readFile(fp, 'utf8')); } catch {}

  const idx = arr.findIndex((x) => String(x?.job_id || '') === item.job_id);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...item, updated_at: new Date().toISOString() };
  } else {
    arr.push(item);
  }

  await fs.writeFile(fp, JSON.stringify(arr, null, 2), 'utf8');

  const section = String(fd.get('section') || 'review');
  const job = String(fd.get('job') || item.job_id || '');
  const redirectUrl = new URL('/admin/autonomous-engine', req.url);
  if (section) redirectUrl.searchParams.set('section', section);
  if (job) redirectUrl.searchParams.set('job', job);
  if (item.job_id) redirectUrl.searchParams.set('savedJob', item.job_id);

  return NextResponse.redirect(redirectUrl);
}
