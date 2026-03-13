"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function DeployButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/autonomous-engine/deploy', { method: 'POST' });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.ok === false) {
          const message = data?.error || 'Deploy failed';
          window.alert(message);
          return;
        }

        router.replace(data?.redirect || '/admin/autonomous-engine?section=completed');
        router.refresh();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Deploy failed');
      } finally {
        setRunning(false);
      }
    });
  };

  const busy = isPending || running;

  return (
    <button
      className="ae-deploy-btn"
      type="button"
      onClick={run}
      disabled={busy}
      style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: busy ? 0.7 : 1 }}
      title="Deploy all local approved changes"
    >
      {busy ? 'Deploying…' : 'Deploy'}
    </button>
  );
}
