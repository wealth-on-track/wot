import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'Agent Team', 'autonomous-engine');

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) as T; } catch { return fallback; }
}

function Card({ title, items, review }: { title: string; items: any[]; review?: boolean }) {
  return (
    <section className="card" style={{ padding: 12 }}>
      <h2 style={{ margin: 0, marginBottom: 10, fontSize: '1rem' }}>{title}</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.length === 0 ? <div style={{ opacity: 0.7 }}>No items.</div> : items.map((j) => (
          <div key={j.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{j.title}</strong>
              <span>{j.state}</span>
            </div>
            <div style={{ fontSize: 12, marginTop: 6, display: 'grid', gap: 3 }}>
              <div>category: {j.category}</div>
              <div>risk: {j.risk}</div>
              <div>summary: {j.summary}</div>
              <div>changed files: {(j.changedFiles || []).join(', ') || '-'}</div>
              <div>test results: {j.testResults || '-'}</div>
              <div>preview: {j.previewInstructions || '-'}</div>
            </div>
            {review ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <form action="/api/autonomous-engine/review" method="post">
                  <input type="hidden" name="jobId" value={j.id} />
                  <input type="hidden" name="action" value="approve" />
                  <button type="submit">Approve</button>
                </form>
                <form action="/api/autonomous-engine/review" method="post">
                  <input type="hidden" name="jobId" value={j.id} />
                  <input type="hidden" name="action" value="reject" />
                  <button type="submit">Reject</button>
                </form>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function AutonomousEnginePage() {
  const jobs = await readJson<any[]>(path.join(BASE, 'jobs.json'), []);
  const history = await readJson<any[]>(path.join(BASE, 'history.json'), []);
  const lessons = await readJson<any[]>(path.join(ROOT, 'knowledge', 'lessons.json'), []);

  const inbox = jobs.filter((j) => ['discover', 'proposal'].includes(j.state));
  const active = jobs.filter((j) => ['approved_for_build', 'build', 'test'].includes(j.state));
  const reviewReady = jobs.filter((j) => j.state === 'review_ready');

  return (
    <main style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>WOT Autonomous Improvement Engine (Local Only)</h1>
        <form action="/api/autonomous-engine/run" method="post">
          <button type="submit">Run Tick</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <Card title="Inbox" items={inbox} />
        <Card title="Active" items={active} />
        <Card title="Review Ready" items={reviewReady} review />
      </div>

      <Card title="History" items={history.slice().reverse().slice(0, 30)} />

      <section className="card" style={{ padding: 12 }}>
        <h2 style={{ margin: 0, marginBottom: 10, fontSize: '1rem' }}>Lessons Learned</h2>
        <form action="/api/autonomous-engine/lessons" method="post" style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
          <input name="job_id" placeholder="job_id" required />
          <input name="category" placeholder="category" required />
          <input name="liked" placeholder="liked" />
          <input name="disliked" placeholder="disliked" />
          <textarea name="notes" placeholder="notes" rows={3} />
          <button type="submit">Add Lesson</button>
        </form>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(lessons, null, 2)}</pre>
      </section>
    </main>
  );
}
