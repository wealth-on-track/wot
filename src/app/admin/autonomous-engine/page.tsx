/* eslint-disable @next/next/no-img-element */
import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { StageCountdown } from './StageCountdown';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'Agent Team', 'autonomous-engine');
const ARTIFACTS = path.join(BASE, 'artifacts');
const RUNTIME = path.join(BASE, 'runtime');
const OPEN_PROPOSAL_STATUSES = new Set(['open', 'proposed']);

const STAGES = [
  { key: 'scout', label: 'Scout' },
  { key: 'shape', label: 'Shape' },
  { key: 'execute', label: 'Execute' },
  { key: 'verify', label: 'Verify' },
  { key: 'completed', label: 'Completed' },
] as const;

type EngineEvent = {
  ts?: string;
  jobId?: string | null;
  proposalId?: string | null;
  stage?: string;
  message?: string;
};

type EngineCheck = {
  status?: string;
  cmd?: string;
};

type EngineIntervention = {
  stage?: string;
  note?: string;
};

type EngineCompletion = {
  status?: string;
  mode?: string;
  summary?: string;
  completedAt?: string;
} | null;

type EngineItem = {
  id?: string;
  state?: string;
  title?: string;
  proposalId?: string;
  summary?: string;
  targetModel?: {
    primaryUser?: string;
    moment?: string;
    need?: string;
    successSignal?: string;
  } | null;
  proposalSnapshot?: EngineProposal | null;
  executionPlan?: {
    interventionPlan?: string;
  } | null;
  executionNotes?: string[];
  interventions?: EngineIntervention[];
  checks?: EngineCheck[];
  completion?: EngineCompletion;
  timestamps?: {
    updatedAt?: string;
    createdAt?: string;
  };
  stageStartedAt?: string;
};

type EngineProposal = {
  id?: string;
  title?: string;
  status?: string;
  jobId?: string;
  freshnessDeadlineAt?: string;
  updatedAt?: string;
  createdAt?: string;
  proposed_change?: string;
  problem?: string;
  quality?: {
    executable?: boolean;
  } | null;
  files_expected?: string[];
  targetModel?: EngineItem['targetModel'];
};

type LessonRow = {
  job_id?: string;
  liked?: string;
  notes?: string;
};

type LearnedArtifact = {
  proposalLearning?: string;
  architectureLearning?: string;
};

function canonicalState(state?: string) {
  const value = String(state || '').trim();
  return {
    discover: 'scout',
    proposal: 'scout',
    scout_update: 'shape',
    approved_for_build: 'shape',
    executer_sync: 'shape',
    build: 'execute',
    execution: 'execute',
    test: 'verify',
    qa_review: 'verify',
    review_ready: 'verify',
    approved: 'completed',
    reverted: 'completed',
    abandoned_with_reason: 'completed',
  }[value] || value;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function fmtDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { hour12: false });
}

function ageMinutes(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

function isOpenProposal(proposal?: EngineProposal | null) {
  return OPEN_PROPOSAL_STATUSES.has(String(proposal?.status || '').trim().toLowerCase()) && !proposal?.jobId;
}

function isExecutableProposal(proposal?: EngineProposal | null) {
  return isOpenProposal(proposal)
    && Boolean(proposal?.quality?.executable)
    && Array.isArray(proposal?.files_expected)
    && proposal.files_expected.length === 1;
}

function proposalFreshnessMs(proposal?: EngineProposal | null) {
  const value = proposal?.freshnessDeadlineAt || proposal?.updatedAt || proposal?.createdAt;
  const ms = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function isFreshProposal(proposal?: EngineProposal | null, maxAgeMs = 6 * 60 * 60 * 1000) {
  const deadlineMs = proposal?.freshnessDeadlineAt ? proposalFreshnessMs(proposal) : 0;
  if (deadlineMs > 0) return deadlineMs >= Date.now();
  const updatedMs = proposalFreshnessMs(proposal);
  return updatedMs > 0 && (Date.now() - updatedMs) <= maxAgeMs;
}

function isDashboardReadyProposal(proposal?: EngineProposal | null) {
  return isExecutableProposal(proposal) && isFreshProposal(proposal);
}

function statusTone(state: string) {
  if (state === 'completed') return { border: '#16a34a', bg: '#f0fdf4', fg: '#166534' };
  if (state === 'blocked') return { border: '#b91c1c', bg: '#fef2f2', fg: '#991b1b' };
  if (state === 'verify') return { border: '#0f766e', bg: '#ecfeff', fg: '#155e75' };
  if (state === 'execute') return { border: '#b45309', bg: '#fffbeb', fg: '#92400e' };
  if (state === 'shape') return { border: '#1d4ed8', bg: '#eff6ff', fg: '#1d4ed8' };
  if (state === 'scout') return { border: '#7c3aed', bg: '#f5f3ff', fg: '#6d28d9' };
  if (state === 'proposal') return { border: '#2563eb', bg: '#eff6ff', fg: '#1d4ed8' };
  return { border: '#64748b', bg: '#f8fafc', fg: '#334155' };
}

function stepTone(status: 'done' | 'ongoing' | 'pending') {
  if (status === 'done') return { border: '#16a34a', bg: '#f0fdf4', fg: '#166534' };
  if (status === 'ongoing') return { border: '#b45309', bg: '#fffbeb', fg: '#92400e' };
  return { border: '#cbd5e1', bg: '#f8fafc', fg: '#475569' };
}

function normalizeJob(job: EngineItem): EngineItem {
  return {
    ...job,
    state: canonicalState(job?.state),
  };
}

function readArtifactText(artifactMap: Record<string, string>, name: string) {
  const value = artifactMap[name];
  return typeof value === 'string' ? value.trim() : '';
}

export default async function AutonomousEnginePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const selectedJobId = String(sp.job || '');

  const jobs = (await readJson<EngineItem[]>(path.join(BASE, 'jobs.json'), [])).map(normalizeJob);
  const history = (await readJson<EngineItem[]>(path.join(BASE, 'history.json'), [])).map(normalizeJob);
  const proposals = await readJson<EngineProposal[]>(path.join(BASE, 'proposals.json'), []);
  const lessons = await readJson<LessonRow[]>(path.join(ROOT, 'knowledge', 'lessons.json'), []);
  const lastTick = await readJson<{ ranAt?: string; ok?: boolean; deadZone?: boolean; queue?: { activeJobs?: number; executableOpenProposals?: number }; steps?: Array<{ label?: string; status?: string }> }>(path.join(RUNTIME, 'last-tick.json'), {});
  const heartbeat = await readJson<{ ts?: string; status?: string; note?: string; pid?: number }>(path.join(RUNTIME, 'heartbeat.json'), {});
  const activeJobLock = await readJson<{ activeJobId?: string | null; updatedAt?: string | null }>(path.join(RUNTIME, 'active-job.json'), {});
  const kralLogRaw = await fs.readFile(path.join(RUNTIME, 'kral-log.jsonl'), 'utf8').catch(() => '');
  const eventsRaw = await fs.readFile(path.join(BASE, 'events.jsonl'), 'utf8').catch(() => '');

  const activeJobs = jobs
    .filter((job) => !['completed', 'blocked'].includes(String(job.state || '')))
    .sort((a, b) => new Date(b.timestamps?.updatedAt || 0).getTime() - new Date(a.timestamps?.updatedAt || 0).getTime());
  const terminalJobs = [...history, ...jobs.filter((job) => ['completed', 'blocked'].includes(String(job.state || '')))]
    .sort((a, b) => new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime() - new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime());
  const openProposalItems: EngineItem[] = proposals
    .filter((item) => isDashboardReadyProposal(item) && !jobs.some((job) => job.proposalId === item.id))
    .map((item): EngineItem => ({
      id: item.id,
      proposalId: item.id,
      title: item.title,
      state: 'proposal',
      summary: item.proposed_change,
      timestamps: { createdAt: item.createdAt, updatedAt: item.updatedAt || item.createdAt },
      targetModel: item.targetModel,
      proposalSnapshot: item,
    }))
    .sort((a, b) => new Date(b.timestamps?.updatedAt || b.timestamps?.createdAt || 0).getTime() - new Date(a.timestamps?.updatedAt || a.timestamps?.createdAt || 0).getTime());

  const items: EngineItem[] = [...activeJobs, ...openProposalItems, ...terminalJobs].sort((a, b) => {
    const aState = String(a?.state || '');
    const bState = String(b?.state || '');
    const aRank = ['shape', 'execute', 'verify'].includes(aState) ? 0 : aState === 'scout' ? 1 : aState === 'proposal' ? 2 : 3;
    const bRank = ['shape', 'execute', 'verify'].includes(bState) ? 0 : bState === 'scout' ? 1 : bState === 'proposal' ? 2 : 3;
    if (aRank !== bRank) return aRank - bRank;
    if (aRank === 3) {
      return new Date(b?.timestamps?.updatedAt || b?.timestamps?.createdAt || 0).getTime() - new Date(a?.timestamps?.updatedAt || a?.timestamps?.createdAt || 0).getTime();
    }
    return String(a?.id || '').localeCompare(String(b?.id || ''), undefined, { numeric: true });
  });
  const selected = items.find((job) => job.id === selectedJobId) || items[0] || null;

  const events = eventsRaw
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
    .filter(Boolean) as EngineEvent[];

  const selectedTimeline = selected
    ? events
        .filter((event) => event.jobId === selected.id || event.proposalId === selected.proposalId)
        .sort((a, b) => new Date(b.ts || '0').getTime() - new Date(a.ts || '0').getTime())
    : [];

  const proposal = selected
    ? selected.proposalSnapshot || proposals.find((item) => item.id === selected.proposalId) || null
    : null;

  const artifactMap: Record<string, string> = {};
  if (selected?.id) {
    const dir = path.join(ARTIFACTS, selected.id);
    try {
      const files = (await fs.readdir(dir)).sort();
      for (const name of files.slice(0, 50)) {
        const fullPath = path.join(dir, name);
        if (/\.(png|jpg|jpeg|webp)$/i.test(name)) {
          const buf = await fs.readFile(fullPath);
          const mime = name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
          artifactMap[name] = `data:${mime};base64,${buf.toString('base64')}`;
        } else {
          artifactMap[name] = (await fs.readFile(fullPath, 'utf8')).slice(0, 4000);
        }
      }
    } catch {}
  }

  const learnedFromArtifact = (() => {
    try {
      return JSON.parse(artifactMap['lessons-learned.json'] || 'null') as LearnedArtifact | null;
    } catch {
      return null;
    }
  })();
  const selectedItem: EngineItem | null = selected;
  const lessonRow = selected ? lessons.find((item) => String(item?.job_id || '') === selected.id) : null;
  const completionSummary = readArtifactText(artifactMap, 'completion-summary.txt') || selectedItem?.completion?.summary || '';
  const beforePreview = artifactMap['before-page.png'] || null;
  const afterPreview = artifactMap['after-page.png'] || null;
  const beforePreviewError = readArtifactText(artifactMap, 'before-screenshot-error.txt');
  const afterPreviewError = readArtifactText(artifactMap, 'after-screenshot-error.txt');
  const verificationFailure = readArtifactText(artifactMap, 'verification-failure.txt');
  const targetModel = proposal?.targetModel || selectedItem?.targetModel || null;
  const currentStage = selectedItem?.state || '';
  const stageStartedAt = selectedItem?.stageStartedAt || selectedItem?.timestamps?.updatedAt || selectedItem?.timestamps?.createdAt;
  const stageAge = ageMinutes(stageStartedAt);
  const dashboardReadyProposals = proposals.filter((item) => isDashboardReadyProposal(item));
  const staleExecutableProposals = proposals.filter((item) => isExecutableProposal(item) && !isFreshProposal(item));
  const openProposalCount = dashboardReadyProposals.length;
  const queueStarved = activeJobs.length === 0 && openProposalCount === 0;
  const blockedVerifyCount = activeJobs.filter((job) => job.state === 'verify' && (job.checks || []).some((check: EngineCheck) => check?.status !== 'pass')).length;
  const heartbeatAge = ageMinutes(heartbeat?.ts);
  const activeJobLockId = String(activeJobLock?.activeJobId || '');
  const activeJobIds = new Set(activeJobs.map((job) => String(job.id || '')));
  const activeJobLockMismatch = activeJobs.length > 0
    ? !activeJobLockId || !activeJobIds.has(activeJobLockId)
    : Boolean(activeJobLockId);
  const runtimeStatus = queueStarved
    ? 'Dead zone'
    : (activeJobLockMismatch || heartbeat?.status === 'error' || heartbeatAge >= 3 || lastTick?.ok === false)
      ? 'Degraded'
      : 'Healthy';
  const runtimeNote = queueStarved
    ? 'No active job and no executable open proposal are available.'
    : activeJobLockMismatch
      ? `active-job lock mismatch (${activeJobLockId || 'null'})`
      : heartbeat?.status === 'error'
        ? (heartbeat.note || 'Loop heartbeat reported an error.')
        : heartbeatAge >= 3
          ? `Heartbeat is stale (${heartbeatAge}m old).`
          : `Heartbeat ${heartbeat?.pid ? `pid ${heartbeat.pid}` : 'present'} · ${heartbeat.note || 'loop healthy'}`;
  const completedJobs = terminalJobs.filter((job) => job.state === 'completed');
  const blockedJobs = terminalJobs.filter((job) => job.state === 'blocked' || job.completion?.status === 'blocked');
  const completedStrictCount = completedJobs.filter((job) => job.completion?.mode !== 'completed_with_intervention' && !String(job.completion?.summary || '').includes('degraded verify mode') && !String(job.completion?.mode || '').startsWith('manual_')).length;
  const completedDegradedCount = completedJobs.filter((job) => job.completion?.mode === 'completed_with_intervention' || String(job.completion?.summary || '').includes('degraded verify mode')).length;
  const completedManualCount = completedJobs.filter((job) => String(job.completion?.mode || '').startsWith('manual_')).length;
  const freshestProposal = dashboardReadyProposals
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || '0').getTime() - new Date(a.updatedAt || a.createdAt || '0').getTime())[0];
  const kralLogs = kralLogRaw.split('\n').map((x) => x.trim()).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean).slice(-8).reverse() as Array<{ ts?: string; title?: string; summary?: string }>;

  const selectedFailedChecks = (selectedItem?.checks || []).filter((check: EngineCheck) => check?.status !== 'pass');
  const verifyMode = selectedFailedChecks.length > 0 || selectedItem?.completion?.mode === 'completed_with_intervention' || selectedItem?.completion?.summary?.includes('degraded verify mode') ? 'degraded' : 'strict';

  return (
    <main className="autopilot-root" style={{ padding: '16px 16px 16px 56px', display: 'grid', gap: 12, background: '#eef4f7', color: '#0f172a' }}>
      <section className="autopilot-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          {[
          { label: 'Open Proposals', value: String(openProposalCount), note: staleExecutableProposals.length ? `${staleExecutableProposals.length} stale hidden from queue` : (freshestProposal ? `Freshest: ${freshestProposal.title}` : (queueStarved ? 'Queue starved: scout should reseed immediately' : 'Scout will seed one automatically')) },
          { label: 'Active Jobs', value: String(activeJobs.length), note: blockedVerifyCount > 0 ? `${blockedVerifyCount} verify job(s) blocked` : (activeJobs[0] ? `${activeJobs[0].id} · ${activeJobs[0].state}` : (openProposalCount > 0 ? 'No active job; scout queue ready' : (queueStarved ? 'No active job; queue needs reseed' : 'No active job'))) },
          { label: 'Completed', value: String(completedJobs.length), note: `Strict ${completedStrictCount} · degraded ${completedDegradedCount} · manual ${completedManualCount}` },
          { label: 'Blocked', value: String(blockedJobs.length), note: blockedJobs[0] ? `${blockedJobs[0].id} needs follow-up` : 'No blocked terminal jobs' },
          { label: 'Runtime', value: runtimeStatus, note: lastTick?.steps?.length ? `${runtimeNote} Last tick: ${lastTick.ok ? 'OK' : 'Failed'} · ${lastTick.steps.map((step) => `${step.label}:${step.status}`).join(', ')}` : runtimeNote },
        ].map((card) => (
          <div key={card.label} style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 14, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{card.note}</div>
          </div>
        ))}
      </section>

      <section className="autopilot-kral" style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 14, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Kral</div>
        {kralLogs.length === 0 ? (
          <div style={{ fontSize: 12, color: '#64748b' }}>No updates yet.</div>
        ) : kralLogs.map((row, index) => (
          <div key={`${row.ts}-${index}`} style={{ display: 'grid', gap: 4, paddingBottom: index === kralLogs.length - 1 ? 0 : 10, borderBottom: index === kralLogs.length - 1 ? 'none' : '1px solid #eef2f7' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>{fmtDate(row.ts)}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{row.title || 'Autopilot update'}</div>
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>{row.summary || '-'}</div>
          </div>
        ))}
      </section>

      <section className="ae-grid autopilot-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) minmax(0, 1fr)', gap: 12 }}>
        <aside style={{ minWidth: 0, border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 8, alignContent: 'start' }}>
          {items.length === 0 ? (
            <div style={{ fontSize: 12, color: '#64748b' }}>No jobs yet. Scout queue: {openProposalCount}</div>
          ) : items.map((job) => {
            const tone = statusTone(String(job.state || ''));
            const isSelected = String(selected?.id || '') === String(job.id || '');
            return (
              <div key={job.id} style={{ display: 'grid', gap: 6 }}>
                <Link
                  href={`/admin/autonomous-engine?job=${encodeURIComponent(String(job.id || ''))}`}
                  style={{ borderRadius: 12, border: `1px solid ${tone.border}`, background: tone.bg, color: '#0f172a', textDecoration: 'none', padding: 10, display: 'grid', gap: 4 }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: tone.fg, textTransform: 'uppercase' }}>{job.state}</div>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{job.id}</div>
                  <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.4 }}>{job.title}</div>
                </Link>
                {isSelected ? (
                  <div className="autopilot-mobile-inline-detail" style={{ border: '1px solid #d7e3ef', borderRadius: 12, background: '#fff', padding: 10, display: 'none', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{job.id} - {job.title}</div>
                    <div style={{ fontSize: 11, color: tone.fg, fontWeight: 800, textTransform: 'uppercase' }}>{job.state}</div>
                    <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>{String(job.completion?.summary || job.summary || job.proposalSnapshot?.proposed_change || '-')}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </aside>

        <section style={{ minWidth: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
          {!selected ? (
            <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>No active job selected</div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>
                Scout queue: {openProposalCount}{freshestProposal ? ` · ${freshestProposal.title}` : ''}
              </div>
            </section>
          ) : (
            <>
              <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{selected.id}</div>
                    <h1 style={{ margin: '4px 0 0', fontSize: 22, lineHeight: 1.2 }}>{selected.title}</h1>
                  </div>
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: statusTone(String(currentStage || '')).fg }}>{currentStage}</div>
                    {['completed', 'blocked'].includes(String(currentStage || '')) ? (
                      <div style={{ fontSize: 12, color: currentStage === 'blocked' ? '#991b1b' : '#475569' }}>
                        {currentStage === 'blocked' ? 'Stopped truthfully with follow-up required' : `Finished ${fmtDate(selected.timestamps?.updatedAt || selected.timestamps?.createdAt)}`}
                      </div>
                    ) : (
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                        <StageCountdown stageStartedAt={stageStartedAt} limitMinutes={5} />
                      </div>
                    )}
                    {!['completed', 'blocked'].includes(String(currentStage || '')) ? (
                      <div style={{ fontSize: 11, color: stageAge >= 4 ? '#b45309' : '#64748b' }}>
                        {stageAge >= 4 ? 'Intervention window active' : 'Intervention starts at 04:00'}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#334155' }}>{proposal?.proposed_change || selected?.summary || '-'}</div>
              </section>

              <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>5-Stage Flow</div>
                  {STAGES.map((stage, index) => {
                    const currentIndex = STAGES.findIndex((item) => item.key === currentStage);
                    const ongoing = currentStage === stage.key;
                    const done = ['completed', 'blocked'].includes(String(currentStage || '')) ? true : currentIndex > index;
                    const tone = stepTone(ongoing ? 'ongoing' : done ? 'done' : 'pending');
                    const stageEvents = selectedTimeline.filter((event) => canonicalState(event.stage) === stage.key);
                    return (
                      <div key={stage.key} style={{ border: `1px solid ${tone.border}`, borderRadius: 12, background: tone.bg, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: tone.fg }}>{stage.label}</div>
                          <div style={{ fontSize: 11, color: tone.fg }}>
                            {ongoing && stage.key !== 'completed' ? <StageCountdown stageStartedAt={stageStartedAt} limitMinutes={5} /> : fmtDate(stageEvents[0]?.ts || (stage.key === 'scout' ? selected.timestamps?.createdAt : selected.timestamps?.updatedAt))}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#334155', marginTop: 6, lineHeight: 1.5 }}>
                          {stage.key === 'scout' ? proposal?.problem || 'Scout activated a local executable proposal.' : null}
                          {stage.key === 'shape' ? (selectedItem?.executionPlan?.interventionPlan || 'Shape locks the execution/test/intervention plan.') : null}
                          {stage.key === 'execute' ? (selectedItem?.executionNotes || []).join(' ') || 'Execute applies one scoped local change.' : null}
                          {stage.key === 'verify' ? ((selectedItem?.checks || []).map((check: EngineCheck) => `${String(check.status || '').toUpperCase()}: ${check.cmd || ''}`).join(' | ') || 'Verify runs required local checks.') : null}
                          {stage.key === 'completed' ? (selectedItem?.state === 'blocked' ? (selectedItem?.completion?.summary || 'Stopped truthfully without claiming completion.') : (completionSummary || selectedItem?.completion?.summary || 'Completed with local trace and artifacts.')) : null}
                        </div>
                      </div>
                    );
                  })}
                </section>

                <section style={{ display: 'grid', gap: 12 }}>
                  <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Target Model</div>
                    <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                      <div><strong>User:</strong> {targetModel?.primaryUser || '-'}</div>
                      <div><strong>Moment:</strong> {targetModel?.moment || '-'}</div>
                      <div><strong>Need:</strong> {targetModel?.need || '-'}</div>
                      <div><strong>Success signal:</strong> {targetModel?.successSignal || '-'}</div>
                    </div>
                  </section>

                  <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Interventions</div>
                    {(selectedItem?.interventions || []).length > 0 ? (
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                        {(selectedItem?.interventions || []).map((item: EngineIntervention, index: number) => (
                          <div key={`${item.stage}-${index}`}>{item.stage}: {item.note}</div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#64748b' }}>No intervention used.</div>
                    )}
                  </section>
                </section>
              </section>

              {(beforePreview || afterPreview || beforePreviewError || afterPreviewError) ? (
                <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Before / After</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>Before</div>
                      {beforePreview ? <img src={beforePreview} alt="Before preview" style={{ width: '100%', borderRadius: 12, border: '1px solid #d7e3ef' }} /> : <div style={{ fontSize: 12, color: beforePreviewError ? '#b45309' : '#64748b' }}>{beforePreviewError || 'No before screenshot'}</div>}
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>After</div>
                      {afterPreview ? <img src={afterPreview} alt="After preview" style={{ width: '100%', borderRadius: 12, border: '1px solid #d7e3ef' }} /> : <div style={{ fontSize: 12, color: afterPreviewError ? '#b45309' : '#64748b' }}>{afterPreviewError || 'No after screenshot'}</div>}
                    </div>
                  </div>
                </section>
              ) : null}

              <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Completion Summary</div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{completionSummary || 'Completion summary will appear here after verification.'}</div>
                  {selectedItem?.state === 'verify' || selectedItem?.state === 'completed' || selectedItem?.state === 'blocked' ? (
                    <div style={{ fontSize: 12, color: selectedItem?.state === 'blocked' ? '#991b1b' : verifyMode === 'degraded' ? '#b45309' : '#166534' }}>
                      Verification mode: {selectedItem?.state === 'blocked' ? 'blocked' : verifyMode}{selectedFailedChecks.length ? ` · ${selectedFailedChecks.length} failing check(s) recorded` : ''}
                    </div>
                  ) : null}
                  {verificationFailure ? <div style={{ fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>Verification is waiting for intervention: {verificationFailure.slice(0, 280)}</div> : null}
                </section>

                <section style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.05)', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Lessons Learned</div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                    <div><strong>From proposal:</strong> {learnedFromArtifact?.proposalLearning || lessonRow?.liked || 'Lessons will appear after completion.'}</div>
                    <div><strong>Architecture improved:</strong> {learnedFromArtifact?.architectureLearning || lessonRow?.notes || 'Architecture notes will appear after completion.'}</div>
                  </div>
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
        @media (max-width: 900px) {
          .autopilot-stats {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 760px) {
          .autopilot-root {
            padding: 12px !important;
            gap: 10px !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }
          .autopilot-mobile-inline-detail {
            display: grid !important;
          }
          .autopilot-main-grid > section:last-child {
            display: none !important;
          }
          .autopilot-stats,
          .autopilot-main-grid,
          .autopilot-root section[style*="grid-template-columns: 1.2fr 1fr"],
          .autopilot-root section[style*="grid-template-columns: 1fr 1fr"],
          .autopilot-root section[style*="repeat(5, minmax(0, 1fr))"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .autopilot-root img,
          .autopilot-root pre,
          .autopilot-root code,
          .autopilot-root a,
          .autopilot-root div,
          .autopilot-root section,
          .autopilot-root aside {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .autopilot-kral {
            padding: 12px !important;
          }
        }
        @media (max-width: 560px) {
          .autopilot-stats {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .autopilot-root {
            padding: 10px !important;
            overflow-x: hidden !important;
          }
        }
      `}</style>
    </main>
  );
}
