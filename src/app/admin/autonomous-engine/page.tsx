import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'Agent Team', 'autonomous-engine');
const ARTIFACTS = path.join(BASE, 'artifacts');

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) as T; } catch { return fallback; }
}

function fmtDate(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('tr-TR', { hour12: false });
}

function stateProgress(state: string) {
  const steps = ['discover', 'proposal', 'approved_for_build', 'build', 'test', 'review_ready'];
  const i = steps.indexOf(state);
  if (i < 0) return { done: 0, total: steps.length, pct: 100, label: state };
  const done = i + 1;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100), label: `${done}/${steps.length}` };
}

function stateSlaMin(state: string) {
  if (state === 'proposal') return 10;
  if (state === 'build') return 20;
  if (state === 'test') return 15;
  if (state === 'review_ready') return 10;
  return null;
}

function stateTone(state: string, stale: boolean) {
  if (stale) return '#ef4444';
  if (state === 'review_ready') return '#10b981';
  if (['build', 'test', 'approved_for_build'].includes(state)) return '#f59e0b';
  return '#64748b';
}

function Item({
  job,
  selected,
  section,
}: {
  job: any;
  selected: boolean;
  section: string;
}) {
  return (
    <Link
      href={`/admin/autonomous-engine?section=${section}&job=${job.id}`}
      style={{
        display: 'block',
        border: selected ? '1px solid #3b82f6' : '1px solid var(--border)',
        background: selected ? 'rgba(59,130,246,0.08)' : 'var(--card-bg)',
        borderRadius: 10,
        padding: 10,
        textDecoration: 'none',
        color: 'inherit',
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {job.id}
    </Link>
  );
}

export default async function AutonomousEnginePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const selectedSection = String(sp.section || 'active');
  const selectedJobId = String(sp.job || '');

  const jobs = await readJson<any[]>(path.join(BASE, 'jobs.json'), []);
  const history = await readJson<any[]>(path.join(BASE, 'history.json'), []);
  const lessons = await readJson<any[]>(path.join(ROOT, 'knowledge', 'lessons.json'), []);

  const inbox = jobs.filter((j) => ['discover', 'proposal'].includes(j.state));
  const active = jobs.filter((j) => ['approved_for_build', 'build', 'test'].includes(j.state));
  const reviewReady = jobs.filter((j) => j.state === 'review_ready');

  const groups: Record<string, any[]> = {
    inbox: inbox,
    active: active,
    review: reviewReady,
  };

  const currentList = groups[selectedSection] || active;
  const selected = currentList.find((j) => j.id === selectedJobId) || currentList[0] || null;

  let artifactNames: string[] = [];
  const artifactMap: Record<string, string> = {};
  if (selected?.id) {
    const dir = path.join(ARTIFACTS, selected.id);
    try {
      artifactNames = (await fs.readdir(dir)).sort();
      for (const n of artifactNames.slice(0, 20)) {
        try {
          const c = await fs.readFile(path.join(dir, n), 'utf8');
          artifactMap[n] = c.slice(0, 1200);
        } catch {
          artifactMap[n] = '(binary or unreadable)';
        }
      }
    } catch {}
  }

  const updatedAt = selected?.timestamps?.updatedAt || selected?.timestamps?.createdAt;
  const ageMin = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000) : 0;
  const sla = selected ? stateSlaMin(selected.state) : null;
  const stuck = selected && sla !== null ? ageMin > sla : false;
  const progress = selected ? stateProgress(selected.state) : { pct: 0, label: '-' } as any;

  return (
    <main style={{ padding: 12, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/admin/autonomous-engine?section=inbox" className="card" style={{ padding: '6px 10px', textDecoration: 'none', fontWeight: selectedSection === 'inbox' ? 800 : 600 }}>Inbox: <strong>{inbox.length}</strong></Link>
          <Link href="/admin/autonomous-engine?section=active" className="card" style={{ padding: '6px 10px', textDecoration: 'none', fontWeight: selectedSection === 'active' ? 800 : 600 }}>Active: <strong>{active.length}</strong></Link>
          <Link href="/admin/autonomous-engine?section=review" className="card" style={{ padding: '6px 10px', textDecoration: 'none', fontWeight: selectedSection === 'review' ? 800 : 600 }}>Review Ready: <strong>{reviewReady.length}</strong></Link>
          <span className="card" style={{ padding: '6px 10px' }}>History: <strong>{history.length}</strong></span>
          <span className="card" style={{ padding: '6px 10px' }}>Lessons: <strong>{lessons.length}</strong></span>
        </div>
        <form action="/api/autonomous-engine/run" method="post">
          <button type="submit">Run Tick</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 10, minHeight: '74vh' }}>
        <aside className="card" style={{ padding: 10, overflow: 'auto' }}>
          <div style={{ marginTop: 2, display: 'grid', gap: 8 }}>
            {currentList.length === 0 ? <div style={{ opacity: 0.7 }}>No items.</div> : currentList.map((j) => (
              <Item key={j.id} job={j} selected={selected?.id === j.id} section={selectedSection} />
            ))}
          </div>
        </aside>

        <section className="card" style={{ padding: 12, overflow: 'auto' }}>
          {!selected ? <div>No item selected.</div> : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Job ID: {selected.id} · Proposal: {selected.proposalId || '-'}</div>
                  <h2 style={{ margin: '4px 0' }}>{selected.title}</h2>
                  <div style={{ fontSize: 13 }}>category: <strong>{selected.category}</strong> · risk: <strong>{selected.risk}</strong> · state: <strong>{selected.state}</strong></div>
                </div>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontSize: 12 }}>Progress: {progress.label} ({progress.pct}%)</div>
                  <div style={{ marginTop: 4, height: 8, background: '#1f293733', borderRadius: 999 }}>
                    <div style={{ width: `${progress.pct}%`, height: '100%', background: '#22c55e', borderRadius: 999 }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: stuck ? '#ef4444' : '#94a3b8' }}>
                    {sla ? `${ageMin}m since update · SLA ${sla}m${stuck ? ' (STUCK RISK)' : ''}` : `${ageMin}m since update`}
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 10 }}>
                <strong>Summary</strong>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{selected.summary || '-'}</div>
                <div style={{ marginTop: 8, fontSize: 12 }}>test results: <strong>{selected.testResults || '-'}</strong></div>
                <div style={{ marginTop: 4, fontSize: 12 }}>preview: {selected.previewInstructions || '-'}</div>
              </div>

              <div className="card" style={{ padding: 10 }}>
                <strong>Changed Files</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {(selected.changedFiles || []).length === 0 ? <li>-</li> : selected.changedFiles.map((f: string) => <li key={f}>{f}</li>)}
                </ul>
              </div>

              <div className="card" style={{ padding: 10 }}>
                <strong>Retries & Timing</strong>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  planning: {selected.retries?.planning || 0} · build: {selected.retries?.build || 0} · testing: {selected.retries?.testing || 0} · verification: {selected.retries?.verification || 0}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                  created: {fmtDate(selected.timestamps?.createdAt)} · updated: {fmtDate(selected.timestamps?.updatedAt)}
                </div>
              </div>

              <div className="card" style={{ padding: 10 }}>
                <strong>Artifacts ({artifactNames.length})</strong>
                {artifactNames.length === 0 ? <div style={{ marginTop: 6 }}>No artifacts yet.</div> : (
                  <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                    {artifactNames.map((n) => (
                      <details key={n}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{n}</summary>
                        <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', overflowX: 'auto', maxHeight: 220 }}>{artifactMap[n]}</pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>

              {selected.state === 'review_ready' ? (
                <div className="card" style={{ padding: 10, display: 'flex', gap: 8 }}>
                  <form action="/api/autonomous-engine/review" method="post">
                    <input type="hidden" name="jobId" value={selected.id} />
                    <input type="hidden" name="action" value="approve" />
                    <button type="submit">Approve</button>
                  </form>
                  <form action="/api/autonomous-engine/review" method="post">
                    <input type="hidden" name="jobId" value={selected.id} />
                    <input type="hidden" name="action" value="reject" />
                    <button type="submit">Reject</button>
                  </form>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
