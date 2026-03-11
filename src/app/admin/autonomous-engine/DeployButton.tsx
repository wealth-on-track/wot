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
        router.replace(data?.redirect || '/admin/autonomous-engine?section=completed');
        router.refresh();
      } catch {
        router.replace('/admin/autonomous-engine?section=completed');
        router.refresh();
      } finally {
        setRunning(false);
      }
    });
  };

  const busy = isPending || running;

  return (
    <button
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
