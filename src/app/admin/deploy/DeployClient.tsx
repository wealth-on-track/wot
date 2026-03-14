"use client";

import { useState } from "react";

const steps = [
  "Preparing approved changes",
  "Running local safety checks",
  "Creating deploy commit",
  "Pushing to GitHub",
  "Refreshing admin state",
];

export default function DeployClient() {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setRunning(true);
    setDone(false);
    setError("");
    setResult(null);
    setCurrentStep(0);

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1400);

    try {
      const res = await fetch('/api/autonomous-engine/deploy', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Deploy failed');
      setResult(data);
      setCurrentStep(steps.length - 1);
      setDone(true);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 20, display: 'grid', gap: 14, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>Deploy</div>
        <div style={{ fontSize: 14, color: '#475569' }}>GitHub push ve deploy akışını canlı ilerleme ile buradan yönet.</div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          style={{
            width: 'fit-content',
            border: '1px solid #d7e3ef',
            background: running ? '#e2e8f0' : '#0f172a',
            color: running ? '#475569' : '#fff',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 900,
            cursor: running ? 'default' : 'pointer'
          }}
        >
          {running ? 'Deploying…' : 'Start Deploy'}
        </button>
      </div>

      <div style={{ border: '1px solid #d7e3ef', borderRadius: 16, background: '#fff', padding: 20, display: 'grid', gap: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}>
        {steps.map((step, index) => {
          const active = index === currentStep && running;
          const finished = done && index <= currentStep;
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, color: finished ? '#166534' : active ? '#92400e' : '#64748b', fontWeight: 700 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: finished ? '#22c55e' : active ? '#f59e0b' : '#cbd5e1' }} />
              <div>{step}</div>
            </div>
          );
        })}
        {done && result ? <div style={{ marginTop: 8, color: '#166534', fontWeight: 800 }}>Bitti · {result.before} → {result.after}</div> : null}
        {error ? <div style={{ marginTop: 8, color: '#b91c1c', fontWeight: 800 }}>{error}</div> : null}
      </div>
    </section>
  );
}
