"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

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
      style={{
        border: '1px solid #d7e3ef',
        background: '#fff',
        color: '#0f172a',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 12,
        fontWeight: 800,
        opacity: busy ? 0.7 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: busy ? 'default' : 'pointer'
      }}
      title="Deploy all local approved changes"
    >
      <span>{busy ? 'Deploying…' : 'Deploy'}</span>
      <Check size={14} />
    </button>
  );
}
