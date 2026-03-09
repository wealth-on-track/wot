import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'Agent Team', 'autonomous-engine');
const ARTIFACTS = path.join(BASE, 'artifacts');

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const FLOW = ['discover', 'proposal', 'approved_for_build', 'build', 'test', 'review_ready'];

function fmtDate(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('tr-TR', { hour12: false });
}

function stateProgress(state: string) {
  const i = FLOW.indexOf(state);
  if (i < 0) return { done: FLOW.length, total: FLOW.length, pct: 100, label: state };
  const done = i + 1;
  return { done, total: FLOW.length, pct: Math.round((done / FLOW.length) * 100), label: `${done}/${FLOW.length}` };
}

function stateSlaMin(state: string) {
  if (state === 'proposal') return 10;
  if (state === 'build') return 20;
  if (state === 'test') return 15;
  if (state === 'approved_for_build') return 10;
  if (state === 'review_ready') return 10;
  return null;
}

function stateTone(state: string, stale: boolean) {
  if (stale) return '#ef4444';
  if (state === 'review_ready') return '#10b981';
  if (['build', 'test', 'approved_for_build'].includes(state)) return '#f59e0b';
  if (['abandoned_with_reason', 'reverted'].includes(state)) return '#ef4444';
  return '#64748b';
}

function stateIcon(state: string) {
  if (state === 'review_ready') return '✅';
  if (state === 'test') return '🧪';
  if (state === 'build') return '🛠️';
  if (state === 'approved_for_build') return '🚦';
  if (state === 'proposal') return '🧠';
  if (state === 'discover') return '🔎';
  if (state === 'abandoned_with_reason') return '🛑';
  return '📌';
}

function StepPill({ step, active, done }: { step: string; active: boolean; done: boolean }) {
  const bg = done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(59,130,246,0.16)' : 'rgba(148,163,184,0.12)';
  const border = done ? '1px solid rgba(16,185,129,0.45)' : active ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(148,163,184,0.35)';
  const color = done ? '#10b981' : active ? '#60a5fa' : '#94a3b8';

  return (
    <div style={{ border, background: bg, color, borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
      {step.replaceAll('_', ' ')}
    </div>
  );
}

function IdRow({ job, selected, section }: { job: any; selected: boolean; section: string }) {
  return (
    <Link
      href={`/admin/autonomous-engine?section=${section}&job=${job.id}`}
      style={{
        display: 'block',
        border: selected ? '1px solid #3b82f6' : '1px solid #dbe3f0',
        background: selected ? 'linear-gradient(180deg, #eff6ff, #dbeafe)' : '#ffffff',
        borderRadius: 10,
        padding: '10px 12px',
        textDecoration: 'none',
        color: selected ? '#1e40af' : '#334155',
        fontWeight: 800,
        letterSpacing: '0.02em',
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

  const groups: Record<string, any[]> = { inbox, active, review: reviewReady };
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
          artifactMap[n] = c.slice(0, 1600);
        } catch {
          artifactMap[n] = '(binary or unreadable)';
        }
      }
    } catch {}
  }

  const updatedAt = selected?.timestamps?.updatedAt || selected?.timestamps?.createdAt;
  const ageMin = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000) : 0;
  const sla = selected ? stateSlaMin(selected.state) : null;
  const stale = selected && sla !== null ? ageMin > sla : false;
  const progress = selected ? stateProgress(selected.state) : { pct: 0, label: '-' } as any;

  const total = inbox.length + active.length + reviewReady.length;
  const healthScore = total === 0 ? 100 : Math.max(0, Math.round(100 - ((active.filter((j) => stateSlaMin(j.state) && ((Date.now() - new Date(j.timestamps?.updatedAt || j.timestamps?.createdAt).getTime()) / 60000 > (stateSlaMin(j.state) || 0))).length) / Math.max(active.length, 1)) * 35));

  return (
    <main style={{ padding: 10, display: 'grid', gap: 8, background: '#f1f5f9' }}>
      <header style={{
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        padding: 10,
        background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #f5f8ff 100%)',
        boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 800, letterSpacing: '0.08em' }}>WOT AUTONOMOUS IMPROVEMENT ENGINE</div>
            <h1 style={{ margin: '2px 0 0', fontSize: 20, color: '#0f172a' }}>Agent Team Control Center</h1>
          </div>
          <form action="/api/autonomous-engine/run" method="post">
            <button type="submit" style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #2563eb', background: '#2563eb', color: '#ffffff', fontWeight: 800 }}>
              ▶ Run Tick
            </button>
          </form>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginTop: 8 }}>
          <Link href="/admin/autonomous-engine?section=inbox" className="card" style={{ textDecoration: 'none', padding: 10, border: selectedSection === 'inbox' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>📥 Inbox</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{inbox.length}</div>
          </Link>
          <Link href="/admin/autonomous-engine?section=active" className="card" style={{ textDecoration: 'none', padding: 10, border: selectedSection === 'active' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>⚙️ Active</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{active.length}</div>
          </Link>
          <Link href="/admin/autonomous-engine?section=review" className="card" style={{ textDecoration: 'none', padding: 10, border: selectedSection === 'review' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>✅ Review Ready</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{reviewReady.length}</div>
          </Link>
          <div className="card" style={{ padding: 10, border: '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>🧭 Workflow Health</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{healthScore}%</div>
          </div>
          <div className="card" style={{ padding: 10, border: '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>📚 Lessons</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{lessons.length}</div>
          </div>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '220px 1fr 300px', gap: 8, minHeight: 'calc(100vh - 180px)' }}>
        <aside className="card" style={{ padding: 10, overflow: 'auto', border: '1px solid #cfd8e6', borderRadius: 12, background: '#f8fafc', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8, marginBottom: 8 }}>UNIQUE IDs</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {currentList.length === 0 ? <div style={{ opacity: 0.65 }}>No items.</div> : currentList.map((j) => (
              <IdRow key={j.id} job={j} selected={selected?.id === j.id} section={selectedSection} />
            ))}
          </div>
        </aside>

        <section className="card" style={{ padding: 10, overflow: 'auto', display: 'grid', gap: 8, border: '1px solid #cfd8e6', borderRadius: 12, background: '#ffffff', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          {!selected ? <div>No item selected.</div> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', border: '1px solid #d7e0ee', borderRadius: 10, padding: 10, background: '#f8fafc' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Job ID: {selected.id} · Proposal: {selected.proposalId || '-'}</div>
                  <h2 style={{ margin: '4px 0', fontSize: 22 }}>{selected.title}</h2>
                  <div style={{ fontSize: 13 }}>
                    {stateIcon(selected.state)} state: <strong style={{ color: stateTone(selected.state, stale) }}>{selected.state}</strong> · category: <strong>{selected.category}</strong> · risk: <strong>{selected.risk}</strong>
                  </div>
                </div>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>Progress: {progress.label} ({progress.pct}%)</div>
                  <div style={{ height: 9, borderRadius: 999, background: '#e2e8f0' }}>
                    <div style={{ width: `${progress.pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#10b981,#2563eb)' }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: stale ? '#dc2626' : '#475569' }}>
                    ⏱ {ageMin}m since update {sla ? `· SLA ${sla}m` : ''} {stale ? '· STALE' : ''}
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc' }}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8, fontWeight: 700 }}>FLOW</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FLOW.map((s, idx) => {
                    const current = FLOW.indexOf(selected.state);
                    return <StepPill key={s} step={s} active={idx === current} done={idx < current} />;
                  })}
                </div>
              </div>

              <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Summary & Validation</summary>
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{selected.summary || '-'}</div>
                <div style={{ marginTop: 8, fontSize: 12 }}>Test results: <strong>{selected.testResults || '-'}</strong></div>
                <div style={{ marginTop: 4, fontSize: 12 }}>Preview: {selected.previewInstructions || '-'}</div>
              </details>

              <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Changed Files</summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {(selected.changedFiles || []).length === 0 ? <li>-</li> : selected.changedFiles.map((f: string) => <li key={f}>{f}</li>)}
                </ul>
              </details>

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
            </>
          )}
        </section>

        <aside className="card" style={{ padding: 10, overflow: 'auto', display: 'grid', gap: 8, border: '1px solid #cfd8e6', borderRadius: 12, background: '#f8fafc', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }} open>
            <summary style={{ cursor: 'pointer', fontSize: 12, opacity: 0.9, fontWeight: 800 }}>📡 Monitoring</summary>
            <div style={{ marginTop: 8, fontSize: 13 }}>Queue total: <strong>{total}</strong></div>
            <div style={{ marginTop: 4, fontSize: 13 }}>History: <strong>{history.length}</strong></div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Selected stale: <strong style={{ color: stale ? '#ef4444' : '#10b981' }}>{selected ? (stale ? 'YES' : 'NO') : '-'}</strong></div>
          </details>

          <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, opacity: 0.9, fontWeight: 800 }}>🔁 Retries</summary>
            {!selected ? <div style={{ marginTop: 6 }}>-</div> : (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                planning: {selected.retries?.planning || 0}<br />
                build: {selected.retries?.build || 0}<br />
                testing: {selected.retries?.testing || 0}<br />
                verification: {selected.retries?.verification || 0}
              </div>
            )}
          </details>

          <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, opacity: 0.9, fontWeight: 800 }}>🧾 Artifacts ({artifactNames.length})</summary>
            {artifactNames.length === 0 ? <div style={{ marginTop: 8, opacity: 0.7 }}>No artifacts.</div> : (
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {artifactNames.map((n) => (
                  <details key={n}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>{n}</summary>
                    <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', overflowX: 'auto', maxHeight: 160, fontSize: 11 }}>{artifactMap[n]}</pre>
                  </details>
                ))}
              </div>
            )}
          </details>
        </aside>
      </section>
    </main>
  );
}
