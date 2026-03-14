import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import DeployButton from './DeployButton';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'Agent Team', 'autonomous-engine');
const ARTIFACTS = path.join(BASE, 'artifacts');

const STATE_MAP: Record<string, string> = {
  discover: 'proposal',
  approved_for_build: 'executer_sync',
  build: 'execution',
  test: 'qa_review',
  review_ready: 'qa_review',
};

const EVENT_LABELS: Record<string, string> = {
  proposal: 'Scout',
  scout_update: 'Scout Update',
  executer_sync: 'Scout + Executer Sync',
  execution: 'Executer',
  qa_review: 'Auto Complete',
  stalled_sync: 'Stall Recovery',
  approved: 'Completed',
  reverted: 'Rejected',
  abandoned_with_reason: 'Abandoned',
};

const PROCESS_STEPS = [
  { key: 'documentation', label: 'Documentation' },
  { key: 'created', label: 'Created' },
  { key: 'proposal', label: 'Scout' },
  { key: 'scout_update', label: 'Scout Update' },
  { key: 'executer_sync', label: 'Scout + Executer Sync' },
  { key: 'execution', label: 'Executer' },
  { key: 'qa_review', label: 'Auto Complete' },
  { key: 'approved', label: 'Completed' },
] as const;

function stepTone(status: 'done' | 'ongoing' | 'pending') {
  if (status === 'done') return { border: '#22c55e', bg: '#f0fdf4', fg: '#166534' };
  if (status === 'ongoing') return { border: '#f59e0b', bg: '#fffbeb', fg: '#92400e' };
  return { border: '#cbd5e1', bg: '#f8fafc', fg: '#475569' };
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function canonicalState(state?: string) {
  return STATE_MAP[String(state || '')] || String(state || '');
}

function normalizeJob(job: any) {
  const state = canonicalState(job?.state);
  const retries = job?.retries || {};
  return {
    ...job,
    state,
    ownerAgent:
      job?.ownerAgent === 'planner'
        ? 'scout'
        : job?.ownerAgent === 'builder'
          ? 'executer'
          : job?.ownerAgent === 'verifier'
            ? 'qa'
            : job?.ownerAgent,
    retries: {
      scout: Number(retries.scout ?? retries.planning ?? 0),
      sync: Number(retries.sync ?? 0),
      executer: Number(retries.executer ?? retries.build ?? 0),
      qa: Number(retries.qa ?? retries.testing ?? retries.verification ?? 0),
    },
  };
}

function fmtDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR', { hour12: false });
}

function ageMinutes(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

function countdownLabel(from?: string, limitMin = 5) {
  if (!from) return '-';
  const startMs = new Date(from).getTime();
  if (!Number.isFinite(startMs) || startMs <= 0) return '-';
  const leftMs = Math.max(0, (limitMin * 60 * 1000) - (Date.now() - startMs));
  const min = Math.floor(leftMs / 60000);
  const sec = Math.floor((leftMs % 60000) / 1000);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function isCompleted(job: any) {
  return ['approved', 'reverted', 'abandoned_with_reason'].includes(canonicalState(job?.state));
}

function isProcessing(job: any) {
  return ['executer_sync', 'execution', 'qa_review'].includes(canonicalState(job?.state));
}

function statusTone(state: string, stale: boolean) {
  if (stale) return { border: '#ef4444', bg: '#fef2f2', fg: '#991b1b' };
  if (state === 'qa_review') return { border: '#10b981', bg: '#ecfdf5', fg: '#166534' };
  if (state === 'execution' || state === 'executer_sync') return { border: '#f59e0b', bg: '#fffbeb', fg: '#92400e' };
  return { border: '#60a5fa', bg: '#eff6ff', fg: '#1d4ed8' };
}

function eventPhase(stage?: string) {
  return canonicalState(stage);
}

function listSort(a: any, b: any) {
  const processingDelta = Number(isProcessing(b)) - Number(isProcessing(a));
  if (processingDelta !== 0) return processingDelta;
  return new Date(a.timestamps?.createdAt || a.timestamps?.updatedAt || 0).getTime() - new Date(b.timestamps?.createdAt || b.timestamps?.updatedAt || 0).getTime();
}

export default async function AutonomousEnginePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const selectedSection = String(sp.section || 'proposal') === 'completed' ? 'completed' : 'proposal';
  const selectedJobId = String(sp.job || '');
  const savedJobId = String(sp.savedJob || '');

  const jobsRaw = await readJson<any[]>(path.join(BASE, 'jobs.json'), []);
  const proposalsAll = await readJson<any[]>(path.join(BASE, 'proposals.json'), []);
  const historyRaw = await readJson<any[]>(path.join(BASE, 'history.json'), []);
  const lessons = await readJson<any[]>(path.join(ROOT, 'knowledge', 'lessons.json'), []);
  const eventsRaw = await fs.readFile(path.join(BASE, 'events.jsonl'), 'utf8').catch(() => '');

  const jobs = jobsRaw.map(normalizeJob);
  const history = historyRaw.map(normalizeJob);

  const proposalItems = jobs.filter((job) => !isCompleted(job)).sort(listSort);
  const completedMap = new Map<string, any>();
  for (const item of [...jobs, ...history].filter((job) => isCompleted(job))) {
    const key = `${item.id}::${item.timestamps?.updatedAt || item.timestamps?.createdAt || ''}`;
    completedMap.set(key, item);
  }
  const completedItems = [...completedMap.values()].sort(
    (a, b) =>
      new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime() -
      new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime(),
  );

  const currentList = selectedSection === 'completed' ? completedItems : proposalItems;
  const selected = currentList.find((job) => job.id === selectedJobId) || currentList[0] || null;

  const parsedEvents = eventsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as any[];

  const selectedTimeline = selected
    ? parsedEvents
        .filter((event) => event.jobId === selected.id || event.proposalId === selected.proposalId)
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    : [];

  const initialProposal = selected ? proposalsAll.find((proposal) => proposal.id === selected.proposalId || String(selected.proposalId || '').startsWith(String(proposal.id || ''))) : null;

  let artifactNames: string[] = [];
  const artifactMap: Record<string, string> = {};
  if (selected?.id) {
    const artifactDir = path.join(ARTIFACTS, selected.id);
    try {
      artifactNames = (await fs.readdir(artifactDir)).sort();
      for (const fileName of artifactNames.slice(0, 30)) {
        try {
          artifactMap[fileName] = (await fs.readFile(path.join(artifactDir, fileName), 'utf8')).slice(0, 1800);
        } catch {
          artifactMap[fileName] = '(binary or unreadable)';
        }
      }
    } catch {}
  }

  const selectedUpdatedAt = selected?.timestamps?.updatedAt || selected?.timestamps?.createdAt;
  const selectedAgeMin = ageMinutes(selectedUpdatedAt);
  const stale = !!selected && !isCompleted(selected) && selectedAgeMin >= 10;
  const groupedEvents = new Map<string, any[]>();
  for (const event of selectedTimeline) {
    const phase = eventPhase(event.stage);
    if (!groupedEvents.has(phase)) groupedEvents.set(phase, []);
    groupedEvents.get(phase)!.push(event);
  }
  const currentStage = selected ? canonicalState(selected.state) : '';

  return (
    <main style={{ padding: '12px 12px 12px 52px', display: 'grid', gap: 12, background: '#f3f7fb', color: '#0f172a' }}>
      <header style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
          <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Agent Team</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Link href="/admin/autonomous-engine?section=proposal" style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: selectedSection === 'proposal' ? '1px solid #60a5fa' : '1px solid #d7e3ef', background: '#fff', fontWeight: 800 }}>
              Proposal ({proposalItems.length})
            </Link>
            <Link href="/admin/autonomous-engine?section=completed" style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: selectedSection === 'completed' ? '1px solid #60a5fa' : '1px solid #d7e3ef', background: '#fff', fontWeight: 800 }}>
              Completed ({completedItems.length})
            </Link>
            <DeployButton />
          </div>
        </div>
      </header>

      <section className="ae-grid" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
        <aside style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {currentList.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', color: '#64748b' }}>
                {selectedSection === 'proposal' ? 'No live proposals.' : 'No completed items.'}
              </div>
            ) : currentList.map((job) => {
              const jobAgeMin = ageMinutes(job.timestamps?.updatedAt || job.timestamps?.createdAt);
              const jobStale = !isCompleted(job) && jobAgeMin >= 10;
              const tone = statusTone(job.state, jobStale);
              return (
                <Link
                  key={job.id}
                  href={`/admin/autonomous-engine?section=${selectedSection}&job=${encodeURIComponent(job.id)}`}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    borderRadius: 10,
                    border: selected?.id === job.id ? `1px solid ${tone.border}` : `1px solid ${tone.border}33`,
                    background: selected?.id === job.id ? tone.bg : '#fff',
                    padding: '7px 8px',
                    color: '#0f172a',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{job.id}</div>
                </Link>
              );
            })}
          </div>
        </aside>

        <section style={{ display: 'grid', gap: 12 }}>
          {!selected ? (
            <div style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 20 }}>No item selected.</div>
          ) : (
            <>
              <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, display: 'grid', gap: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>{selected.title}</h2>
              </section>

              <section style={{ display: 'grid', gap: 12 }}>
                <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, display: 'grid', gap: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}>
                  {PROCESS_STEPS.map((step, index) => {
                    const events = groupedEvents.get(step.key) || [];
                    const isCompletedFlow = ['approved', 'reverted', 'abandoned_with_reason'].includes(currentStage);
                    const currentIndex = PROCESS_STEPS.findIndex((x) => x.key === currentStage);
                    const ongoing = !isCompletedFlow && step.key === currentStage;
                    const done = isCompletedFlow
                      ? true
                      : step.key === 'documentation' || step.key === 'created'
                        ? true
                        : step.key === 'approved'
                          ? ['approved', 'reverted', 'abandoned_with_reason'].includes(currentStage)
                          : currentIndex > -1
                            ? index < currentIndex
                            : events.length > 0;
                    const status = ongoing ? 'ongoing' : done ? 'done' : 'pending';
                    const colors = stepTone(status);
                    const stepDate = step.key === 'documentation' || step.key === 'created'
                      ? fmtDate(selected.timestamps?.createdAt)
                      : events[0]?.ts
                        ? fmtDate(events[0].ts)
                        : '-';

                    return (
                      <details key={step.key} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, background: colors.bg, padding: '8px 10px' }}>
                        <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: colors.fg }}>
                              {step.label}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {ongoing ? <div style={{ fontSize: 11, fontWeight: 800, color: colors.fg }}>⏳ {countdownLabel(events[0]?.ts || selected.timestamps?.updatedAt || selected.timestamps?.createdAt, 5)}</div> : null}
                              <div style={{ fontSize: 11, color: colors.fg }}>{stepDate}</div>
                            </div>
                          </div>
                        </summary>
                        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, color: '#334155', whiteSpace: 'pre-wrap' }}>
                          {step.key === 'documentation' ? (
                            <>
                              <div><strong>Date:</strong> {fmtDate(selected.timestamps?.createdAt)}</div>
                              <div><strong>Problem:</strong> {initialProposal?.problem || '-'}</div>
                              <div><strong>Proposed change:</strong> {initialProposal?.proposed_change || '-'}</div>
                              <div><strong>Expected benefit:</strong> {initialProposal?.expected_benefit || '-'}</div>
                              <div><strong>Preview instructions:</strong> {selected.previewInstructions || '-'}</div>
                            </>
                          ) : step.key === 'created' ? (
                            'Proposal created and entered the system.'
                          ) : events.length > 0 ? (
                            events.map((event, index) => (
                              <div key={`${event.ts}-${index}`} style={{ marginTop: index === 0 ? 0 : 8 }}>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{fmtDate(event.ts)}</div>
                                <div>
                                  {event.stage === 'stalled_sync'
                                    ? artifactMap[`stalled-sync-${String(selected?.stallRecovery?.count || 1).padStart(2, '0')}.md`] || event.message
                                    : event.message}
                                </div>
                              </div>
                            ))
                          ) : ongoing ? (
                            'Bu adım şu an devam ediyor.'
                          ) : (
                            'Henüz başlamadı.'
                          )}
                        </div>
                      </details>
                    );
                  })}
                </section>

              </section>
            </>
          )}
        </section>
      </section>

      <style>{`
        @media (max-width: 1100px) {
          .ae-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
