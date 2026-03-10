import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { execSync } from 'child_process';

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

function compactJobId(id: string) {
  const s = String(id || '');
  const m = s.match(/^JOB-(\d{8})-(.+)$/);
  if (!m) return s;
  return `${m[1]} - ${m[2]}`;
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

export default async function AutonomousEnginePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const selectedSection = String(sp.section || 'active');
  const selectedJobId = String(sp.job || '');
  // New behavior: left list is closed by default; legacy ?list=1 is ignored.
  const showList = String(sp.panel || '0') === '1';
  const showRight = String(sp.right || '1') === '1';
  const showAdminPanel = String(sp.admin || '1') === '1';
  const showSidebar = String(sp.sidebar || '0') === '1';
  const savedJobId = String(sp.savedJob || '');

  const jobs = await readJson<any[]>(path.join(BASE, 'jobs.json'), []);
  const proposalsAll = await readJson<any[]>(path.join(BASE, 'proposals.json'), []);
  const history = await readJson<any[]>(path.join(BASE, 'history.json'), []);
  const lessons = await readJson<any[]>(path.join(ROOT, 'knowledge', 'lessons.json'), []);
  let eventsRaw = '';
  try {
    eventsRaw = await fs.readFile(path.join(BASE, 'events.jsonl'), 'utf8');
  } catch {}

  const proposal = jobs.filter((j) => j.state === 'proposal');
  const inbox = jobs.filter((j) => j.state === 'discover');
  const active = jobs.filter((j) => ['approved_for_build', 'build', 'test'].includes(j.state));
  const reviewReady = jobs.filter((j) => j.state === 'review_ready');
  const completed = jobs.filter((j) => ['approved', 'reverted'].includes(j.state));

  const groups: Record<string, any[]> = { proposal, inbox, active, review: reviewReady, completed };
  const currentList = groups[selectedSection] || active;
  const selected = currentList.find((j) => j.id === selectedJobId) || currentList[0] || null;

  const parsedEvents = eventsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean) as any[];

  const selectedTimeline = !selected
    ? []
    : parsedEvents
        .filter((e) => e.jobId === selected.id || e.proposalId === selected.proposalId)
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const selectedLesson = selected ? (lessons.find((l) => String(l?.job_id || '') === selected.id) || null) : null;
  const justSaved = selected ? savedJobId === selected.id : false;

  let artifactNames: string[] = [];
  const artifactMap: Record<string, string> = {};
  let initialProposal: any = null;
  const updatedProposal = selected ? proposalsAll.find((p) => p.id === selected.proposalId || String(selected.proposalId || '').startsWith(String(p.id || ''))) : null;
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
      try {
        initialProposal = JSON.parse(await fs.readFile(path.join(dir, 'proposal.json'), 'utf8'));
      } catch {}
    } catch {}
  }

  const updatedAt = selected?.timestamps?.updatedAt || selected?.timestamps?.createdAt;
  const ageMin = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000) : 0;
  const sla = selected ? stateSlaMin(selected.state) : null;
  const stale = selected && sla !== null ? ageMin > sla : false;
  const progress = selected ? stateProgress(selected.state) : { pct: 0, label: '-' } as any;
  const flowForSelected = selected
    ? ([
        ...FLOW,
        ...(selected.state === 'approved' ? ['approved'] : selected.state === 'reverted' ? ['rejected'] : []),
      ] as string[])
    : FLOW;

  const total = proposal.length + inbox.length + active.length + reviewReady.length + completed.length;
  const nowMs = Date.now();
  const healthScore = total === 0 ? 100 : Math.max(0, Math.round(100 - ((active.filter((j) => stateSlaMin(j.state) && ((nowMs - new Date(j.timestamps?.updatedAt || j.timestamps?.createdAt).getTime()) / 60000 > (stateSlaMin(j.state) || 0))).length) / Math.max(active.length, 1)) * 35));

  let liveCommit = 'unknown';
  try { liveCommit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: 'pipe' }).toString().trim(); } catch {}

  return (
    <main style={{ padding: 10, display: 'grid', gap: 8, background: '#f1f5f9' }}>
      <header style={{
        border: '1px solid #d8e1ee',
        borderRadius: 12,
        padding: 10,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
        boxShadow: '0 3px 10px rgba(15,23,42,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'center' }}>
          <Link href={`/admin/autonomous-engine?section=${selectedSection}&sidebar=${showSidebar ? '0' : '1'}&admin=${showAdminPanel ? '1' : '1'}&panel=${showList ? '1' : '0'}&right=${showRight ? '1' : '0'}${selected ? `&job=${encodeURIComponent(selected.id)}` : ''}`} title={showSidebar ? 'Sol admin menüyü gizle' : 'Sol admin menüyü aç'} className="card" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: 34, height: 34, border: '1px solid #60a5fa', borderRadius: 10, background: '#eff6ff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', fontWeight: 900, color: '#1d4ed8' }}>
            🧭
          </Link>
          <Link href={`/admin/autonomous-engine?section=${selectedSection}&sidebar=${showSidebar ? '1' : '0'}&admin=${showAdminPanel ? '0' : '1'}&panel=${showList ? '1' : '0'}&right=${showRight ? '1' : '0'}${selected ? `&job=${encodeURIComponent(selected.id)}` : ''}`} title={showAdminPanel ? 'Agent Team panelini gizle' : 'Agent Team panelini aç'} className="card" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: 34, height: 34, border: '1px solid #60a5fa', borderRadius: 10, background: '#eff6ff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', fontWeight: 900, color: '#1d4ed8' }}>
            🧩
          </Link>
          <Link href={`/admin/autonomous-engine?section=${selectedSection}&sidebar=${showSidebar ? '1' : '0'}&admin=${showAdminPanel ? '1' : '0'}&panel=${showList ? '0' : '1'}&right=${showRight ? '1' : '0'}${selected ? `&job=${encodeURIComponent(selected.id)}` : ''}`} title={showList ? 'Listeyi gizle' : 'Listeyi aç'} className="card" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: 34, height: 34, border: '1px solid #60a5fa', borderRadius: 10, background: '#eff6ff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', fontWeight: 900, color: '#1d4ed8' }}>
            🗂️
          </Link>
          <Link href={`/admin/autonomous-engine?section=${selectedSection}&sidebar=${showSidebar ? '1' : '0'}&admin=${showAdminPanel ? '1' : '0'}&panel=${showList ? '1' : '0'}&right=${showRight ? '0' : '1'}${selected ? `&job=${encodeURIComponent(selected.id)}` : ''}`} title={showRight ? 'Lessons panelini gizle' : 'Lessons panelini aç'} className="card" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: 34, height: 34, border: '1px solid #60a5fa', borderRadius: 10, background: '#eff6ff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', fontWeight: 900, color: '#1d4ed8' }}>
            📚
          </Link>
          <Link href="/admin/autonomous-engine?section=proposal" className="card" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '8px 10px', border: selectedSection === 'proposal' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', whiteSpace: 'nowrap', fontWeight: 800 }}>
🧠 Proposal ({proposal.length})
          </Link>
          <Link href="/admin/autonomous-engine?section=inbox" className="card" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '8px 10px', border: selectedSection === 'inbox' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', whiteSpace: 'nowrap', fontWeight: 800 }}>
📥 Inbox ({inbox.length})
          </Link>
          <Link href="/admin/autonomous-engine?section=active" className="card" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '8px 10px', border: selectedSection === 'active' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', whiteSpace: 'nowrap', fontWeight: 800 }}>
⚙️ Active ({active.length})
          </Link>
          <Link href="/admin/autonomous-engine?section=review" className="card" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '8px 10px', border: selectedSection === 'review' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', whiteSpace: 'nowrap', fontWeight: 800 }}>
✅ Review Ready ({reviewReady.length})
          </Link>
          <Link href="/admin/autonomous-engine?section=completed" className="card" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '8px 10px', border: selectedSection === 'completed' ? '1px solid #60a5fa' : '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', whiteSpace: 'nowrap', fontWeight: 800 }}>
🏁 Completed ({completed.length})
          </Link>
          <span className="card" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 10px', border: '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', whiteSpace: 'nowrap', fontWeight: 800 }}>
            🧭 Health ({healthScore}%)
          </span>
          <span className="card" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 10px', border: '1px solid #dbe3ef', borderRadius: 10, background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', whiteSpace: 'nowrap', fontWeight: 800 }}>
            📚 Lessons ({lessons.length})
          </span>
        </div>
      </header>

      {showAdminPanel ? (
      <section className="ae-layout-grid" style={{ display: 'grid', gridTemplateColumns: showList ? (showRight ? '220px 1fr 300px' : '220px 1fr') : (showRight ? '1fr 300px' : '1fr'), gap: 8 }}>
        {showList ? (
          <aside className="card ae-left-panel" style={{ padding: 10, overflow: 'auto', border: '1px solid #cfd8e6', borderRadius: 12, background: '#f8fafc', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {currentList.length === 0 ? <div style={{ opacity: 0.65 }}>No items.</div> : currentList.map((j, idx) => (
                <Link
                  key={`${j.id}-${idx}`}
                  href={`/admin/autonomous-engine?section=${selectedSection}&panel=1&job=${encodeURIComponent(j.id)}`}
                  style={{
                    display: 'block',
                    border: selected?.id === j.id ? '1px solid #3b82f6' : '1px solid #dbe3f0',
                    background: selected?.id === j.id ? 'linear-gradient(180deg, #eff6ff, #dbeafe)' : '#ffffff',
                    borderRadius: 10,
                    padding: '10px 12px',
                    textDecoration: 'none',
                    color: selected?.id === j.id ? '#1e40af' : '#334155',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    fontSize: 13,
                  }}
                >
                  {compactJobId(j.id)}
                </Link>
              ))}
            </div>
          </aside>
        ) : null}

        <section className="card ae-center-panel" style={{ padding: 10, overflow: 'auto', display: 'grid', gap: 8, border: '1px solid #cfd8e6', borderRadius: 12, background: '#ffffff', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          {!selected ? <div>No item selected.</div> : (
            <>
              <div className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {flowForSelected.map((s, idx) => {
                      const current = flowForSelected.indexOf(
                        selected.state === 'reverted' ? 'rejected' : selected.state,
                      );
                      return (
                        <span key={`${s}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <StepPill step={s} active={idx === current} done={idx < current} />
                          {idx < flowForSelected.length - 1 ? <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 800 }}>{'>'}</span> : null}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selected.state === 'review_ready' ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid #d7e0ee', borderRadius: 10, padding: 10, background: '#f8fafc', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700 }}>
                    {selected.title}
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    Category: <strong style={{ textTransform: 'capitalize' }}>{selected.category}</strong>
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    Risk: <strong style={{ textTransform: 'capitalize' }}>{selected.risk}</strong>
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    Progress: <strong>{progress.label}</strong>
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    Updated: <strong>{ageMin}M</strong>
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    SLA: <strong>{sla ? `${sla}M` : '-'}</strong>
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    Impact: <strong>{selected.impactScore || '-'}/5</strong>
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    Confidence: <strong>{selected.confidenceScore || '-'}/5</strong>
                  </div>
                  <div style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#0f172a', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    Effort: <strong>{selected.effortScore || '-'}/5</strong>
                  </div>
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

              <div className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#334155' }}>Details</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Initial Proposal</div>
                    <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                      {initialProposal ? (
                        <>
                          <div><strong>Problem:</strong> {initialProposal.problem || '-'}</div>
                          <div><strong>Proposed change:</strong> {initialProposal.proposed_change || '-'}</div>
                          <div><strong>Expected benefit:</strong> {initialProposal.expected_benefit || '-'}</div>
                        </>
                      ) : 'Initial proposal artifact not found for this job.'}
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Feedback Received</div>
                    <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                      {selected.quality?.feedback ? (
                        <>
                          <div><strong>Reason codes:</strong> {(selected.quality.feedback.reject_reason_codes || []).join(', ') || '-'}</div>
                          <div><strong>Must fix:</strong> {(selected.quality.feedback.must_fix || []).join(', ') || '-'}</div>
                          <div><strong>Evidence gap:</strong> {selected.quality.feedback.evidence_gap || '-'}</div>
                        </>
                      ) : 'No quality feedback recorded.'}
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Updated Version</div>
                    <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                      {updatedProposal ? (
                        <>
                          <div><strong>Updated change:</strong> {updatedProposal.proposed_change || '-'}</div>
                          <div><strong>Impact/Confidence/Effort:</strong> {updatedProposal.impactScore || '-'} / {updatedProposal.confidenceScore || '-'} / {updatedProposal.effortScore || '-'}</div>
                          <div><strong>User-facing:</strong> {updatedProposal.userFacing ? 'yes' : 'no'}</div>
                        </>
                      ) : 'Updated proposal not found in proposal store.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#f8fafc', minHeight: 160 }}>
                <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                  <div className="ae-timeline-head" style={{ display: 'grid', gridTemplateColumns: '200px 170px 1fr 190px', gap: 8, padding: '0 4px', fontSize: 11, fontWeight: 800, opacity: 0.75, textTransform: 'uppercase' }}>
                    <div>Stage</div>
                    <div>Time</div>
                    <div>Comment</div>
                    <div>Live</div>
                  </div>
                  {selectedTimeline.map((e: any, idx: number) => (
                    <div key={`${e.ts}-${idx}`}>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: '7px 10px' }}>
                        <div className="ae-timeline-row" style={{ display: 'grid', gridTemplateColumns: '200px 170px 1fr 190px', gap: 8, alignItems: 'start' }}>
                          <div style={{ fontWeight: 700 }}>{String(e.stage || 'event').toUpperCase()}</div>
                          <div style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.ts)}</div>
                          <div>{e.message}</div>
                          <div>
                            {String(e.stage).toLowerCase() === 'live_verified'
                              ? '✅ live'
                              : String(e.stage).toLowerCase() === 'live_mismatch'
                                ? '⚠️ mismatch'
                                : String(e.stage).toLowerCase() === 'approval_failed'
                                  ? '❌ not live'
                                  : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selected && selectedTimeline.length === 0 ? (
                    <>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: '7px 10px' }}><div style={{ display: 'grid', gridTemplateColumns: '200px 170px 1fr 190px', gap: 8 }}><div style={{ fontWeight: 700 }}>{String(selected.state).toUpperCase()}</div><div>{fmtDate(selected.timestamps?.updatedAt)}</div><div>Current workflow status</div><div>{selected.state === 'approved' ? '✅ live' : '-'}</div></div></div>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: '7px 10px' }}><div style={{ display: 'grid', gridTemplateColumns: '200px 170px 1fr 190px', gap: 8 }}><div style={{ fontWeight: 700 }}>PROPOSAL</div><div>{fmtDate(selected.timestamps?.createdAt)}</div><div>Proposal structured and queued for dispatch</div><div>-</div></div></div>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: '7px 10px' }}><div style={{ display: 'grid', gridTemplateColumns: '200px 170px 1fr 190px', gap: 8 }}><div style={{ fontWeight: 700 }}>DISCOVER</div><div>{fmtDate(selected.timestamps?.createdAt)}</div><div>Opportunity detected from local scout scan</div><div>-</div></div></div>
                    </>
                  ) : null}
                </div>
              </div>

            </>
          )}
        </section>

        {showRight ? (
        <aside className="card ae-right-panel" style={{ padding: 10, overflow: 'auto', display: 'grid', gap: 8, border: '1px solid #cfd8e6', borderRadius: 12, background: '#f8fafc', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
          <details className="card" style={{ padding: 10, border: '1px solid #d7e0ee', borderRadius: 10, background: '#ffffff' }} open>
            <summary style={{ cursor: 'pointer', fontSize: 12, opacity: 0.9, fontWeight: 800 }}>📝 Lessons Learned</summary>
            {!selected ? <div style={{ marginTop: 8, opacity: 0.7 }}>Select a job first.</div> : (
              <form action="/api/autonomous-engine/lessons" method="post" style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                <input type="hidden" name="job_id" value={selected.id} />
                <input type="hidden" name="category" value={selected.category || ''} />
                <input type="hidden" name="section" value={selectedSection} />
                <input type="hidden" name="job" value={selected.id} />
                <input name="liked" placeholder="Liked" defaultValue={selectedLesson?.liked || ''} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                <input name="disliked" placeholder="Disliked" defaultValue={selectedLesson?.disliked || ''} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                <textarea name="notes" placeholder="Notes" defaultValue={selectedLesson?.notes || ''} rows={2} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="submit"
                    style={justSaved
                      ? { border: '1px solid #86efac', background: '#ecfdf5', color: '#166534', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }
                      : { border: '1px solid #93c5fd', background: '#eff6ff', color: '#1e3a8a', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}
                  >
                    {justSaved ? 'Saved' : 'Save / Update Lesson'}
                  </button>
                  {(selectedLesson || justSaved) ? <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>Saved</span> : null}
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
            <div style={{ marginTop: 8, fontSize: 12, color: '#334155' }}>GitHub: commitleniyor / push denemesi yapılıyor</div>
            <div style={{ marginTop: 2, fontSize: 12, color: '#0f172a' }}>Live commit: <strong>{liveCommit}</strong></div>
          </details>
        </aside>
        ) : null}
      </section>
      ) : (
        <section className="card" style={{ padding: 14, border: '1px solid #cfd8e6', borderRadius: 12, background: '#ffffff' }}>
          <div style={{ fontWeight: 800 }}>Admin panel gizli.</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Üstteki 🧩 ikonuna basarak tekrar açabilirsin.</div>
        </section>
      )}

      <style>{`
        @media (max-width: 960px) {
          .ae-layout-grid {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }
          .ae-left-panel,
          .ae-right-panel,
          .ae-center-panel {
            max-height: none !important;
            padding: 8px !important;
          }
          .ae-left-panel { order: 1; }
          .ae-center-panel { order: 2; }
          .ae-right-panel { order: 3; }
          .ae-center-panel .card,
          .ae-right-panel .card,
          .ae-left-panel .card {
            padding: 8px !important;
            border-radius: 9px !important;
          }
          .ae-center-panel details summary,
          .ae-right-panel details summary {
            font-size: 11px !important;
          }
          .ae-timeline-head,
          .ae-timeline-row {
            grid-template-columns: 112px 116px 1fr !important;
            gap: 6px !important;
            font-size: 11px !important;
          }
          .ae-timeline-head > :last-child,
          .ae-timeline-row > :last-child {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}

/* autonomous-engine:JOB-20260309-193820617-001:single-functional-change */
