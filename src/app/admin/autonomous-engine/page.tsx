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
  const bg = done ? '#ecfdf5' : active ? '#eff6ff' : '#f8fafc';
  const border = done ? '1px solid #86efac' : active ? '1px solid #93c5fd' : '1px solid #dbe3ef';
  const color = done ? '#047857' : active ? '#1d4ed8' : '#64748b';

  return (
    <div style={{ border, background: bg, color, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}>
      {step.replaceAll('_', ' ')}
    </div>
  );
}

function compactJobId(id: string) {
  const m = String(id || '').match(/JOB-(\d{8})-.*?(\d{3})$/);
  if (!m) return id;
  return `${m[1]} - ${m[2]}`;
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
      {compactJobId(job.id)}
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
  const selectedLesson = selected ? (lessons.find((l) => String(l?.job_id || '') === selected.id) || null) : null;

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
        border: '1px solid #d8e1ee',
        borderRadius: 12,
        padding: 10,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
        boxShadow: '0 3px 10px rgba(15,23,42,0.06)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
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

      <section style={{ display: 'grid', gridTemplateColumns: '220px 1fr 300px', gap: 8 }}>
        <aside className="card" style={{ padding: 10, overflow: 'auto', border: '1px solid #cfd8e6', borderRadius: 12, background: '#f8fafc', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {currentList.length === 0 ? <div style={{ opacity: 0.65 }}>No items.</div> : currentList.map((j) => (
              <IdRow key={j.id} job={j} selected={selected?.id === j.id} section={selectedSection} />
            ))}
          </div>
        </aside>

        <section className="card" style={{ padding: 10, overflow: 'auto', display: 'grid', gap: 8, border: '1px solid #cfd8e6', borderRadius: 12, background: '#ffffff', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          {!selected ? <div>No item selected.</div> : (
            <>
              <div className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {FLOW.map((s, idx) => {
                      const current = FLOW.indexOf(selected.state);
                      return <StepPill key={s} step={s} active={idx === current} done={idx < current} />;
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <form action="/api/autonomous-engine/review" method="post">
                      <input type="hidden" name="jobId" value={selected.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button type="submit" style={{ border: '1px solid #86efac', background: '#ecfdf5', color: '#166534', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Approve</button>
                    </form>
                    <form action="/api/autonomous-engine/review" method="post">
                      <input type="hidden" name="jobId" value={selected.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button type="submit" style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Reject</button>
                    </form>
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid #d7e0ee', borderRadius: 10, padding: 10, background: '#f8fafc', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 800 }}>{compactJobId(selected.id)}</div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>{selected.title}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>Category: <strong style={{ textTransform: 'capitalize' }}>{selected.category}</strong></div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>Risk: <strong style={{ textTransform: 'capitalize' }}>{selected.risk}</strong></div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>Progress: <strong>{progress.label}</strong></div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>Updated: <strong>{ageMin}M</strong></div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>SLA: <strong>{sla ? `${sla}M` : '-'}</strong></div>
                </div>
              </div>

              <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }} open>
                <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#334155' }}>Summary & Validation</summary>
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', padding: '8px 10px', fontSize: 13, color: '#0f172a' }}>
                    {selected.summary || '-'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ border: '1px solid #dbe3ef', borderRadius: 8, background: '#ffffff', padding: '6px 10px', fontSize: 12, color: '#0f172a' }}>
                      Test results: <strong style={{ textTransform: 'uppercase' }}>{selected.testResults || '-'}</strong>
                    </div>
                    <div style={{ border: '1px solid #dbe3ef', borderRadius: 8, background: '#ffffff', padding: '6px 10px', fontSize: 12, color: '#0f172a', flex: 1, minWidth: 260 }}>
                      Preview: <strong style={{ fontWeight: 600 }}>{selected.previewInstructions || '-'}</strong>
                    </div>
                  </div>
                </div>
              </details>

              <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Changed Files</summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {(selected.changedFiles || []).length === 0 ? <li>-</li> : selected.changedFiles.map((f: string) => <li key={f}>{f}</li>)}
                </ul>
              </details>

              <div className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc', minHeight: 160 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Context Timeline</div>
                <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                  {(history.slice().reverse().slice(0, 6)).map((h: any) => (
                    <div key={`${h.id}-${h.timestamps?.updatedAt || h.timestamps?.createdAt}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: '6px 8px' }}>
                      <div style={{ fontWeight: 700 }}>{h.id}</div>
                      <div style={{ opacity: 0.8 }}>{h.state} · {fmtDate(h.timestamps?.updatedAt || h.timestamps?.createdAt)}</div>
                    </div>
                  ))}
                  {history.length === 0 ? <div style={{ opacity: 0.7 }}>No history yet.</div> : null}
                </div>
              </div>

            </>
          )}
        </section>

        <aside className="card" style={{ padding: 10, overflow: 'auto', display: 'grid', gap: 8, border: '1px solid #cfd8e6', borderRadius: 12, background: '#f8fafc', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }} open>
            <summary style={{ cursor: 'pointer', fontSize: 12, opacity: 0.9, fontWeight: 800 }}>📝 Lessons Learned</summary>
            {!selected ? <div style={{ marginTop: 8, opacity: 0.7 }}>Select a job first.</div> : (
              <form action="/api/autonomous-engine/lessons" method="post" style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                <input type="hidden" name="job_id" value={selected.id} />
                <input type="hidden" name="category" value={selected.category || ''} />
                <input name="liked" placeholder="Liked" defaultValue={selectedLesson?.liked || ''} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                <input name="disliked" placeholder="Disliked" defaultValue={selectedLesson?.disliked || ''} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                <textarea name="notes" placeholder="Notes" defaultValue={selectedLesson?.notes || ''} rows={2} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="submit" style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1e3a8a', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Save / Update Lesson</button>
                  {selectedLesson ? <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>Saved</span> : null}
                </div>
              </form>
            )}
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

          <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, opacity: 0.9, fontWeight: 800 }}>📡 Monitoring</summary>
            <div style={{ marginTop: 8, fontSize: 13 }}>Queue total: <strong>{total}</strong></div>
            <div style={{ marginTop: 4, fontSize: 13 }}>History: <strong>{history.length}</strong></div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Selected stale: <strong style={{ color: stale ? '#ef4444' : '#10b981' }}>{selected ? (stale ? 'YES' : 'NO') : '-'}</strong></div>
          </details>
        </aside>
      </section>
    </main>
  );
}

/* autonomous-engine:JOB-20260309-193820617-001:single-functional-change */
