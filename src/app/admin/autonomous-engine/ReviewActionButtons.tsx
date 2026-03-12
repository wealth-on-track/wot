"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewActionButtons({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: "approve" | "reject") => {
    setPendingAction(action);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('jobId', jobId);
        fd.set('action', action);
        const res = await fetch('/api/autonomous-engine/review', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        const nextUrl = data?.redirect || '/admin/autonomous-engine?section=completed';
        router.replace(nextUrl);
        router.refresh();
      } catch {
        router.replace('/admin/autonomous-engine?section=completed');
        router.refresh();
      }
    });
  };

  const busy = isPending || !!pendingAction;

  return (
    <div className="ae-review-actions" style={{ display: 'flex', gap: 8 }}>
      <button
        className="ae-action-btn"
        type="button"
        onClick={() => run('approve')}
        disabled={busy}
        style={{ border: '1px solid #86efac', background: '#ecfdf5', color: '#166534', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: busy ? 0.7 : 1 }}
      >
        {pendingAction === 'approve' ? 'Saving…' : 'Approve'}
      </button>
      <button
        className="ae-action-btn"
        type="button"
        onClick={() => run('reject')}
        disabled={busy}
        style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: busy ? 0.7 : 1 }}
      >
        {pendingAction === 'reject' ? 'Saving…' : 'Reject'}
      </button>
    </div>
  );
}
