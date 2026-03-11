"use client";

import { useMemo, useState } from "react";

type Item = {
  id: string;
  name: string;
  pct: number;
  oneDay?: number;
  allTime?: number;
  assetId?: string;
  besParentId?: string;
  besFundCode?: string;
};

type Category = { name: string; pct: number; items: Item[] };

export function PublicPortfolioView({ categories: initialCategories, canEdit }: { categories: Category[]; canEdit?: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  const allExpanded = useMemo(() => categories.length > 0 && expanded.size >= categories.length, [expanded, categories.length]);

  const toggleOne = (name: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  };

  const toggleAll = () => {
    setExpanded(prev => {
      if (prev.size >= categories.length) return new Set();
      return new Set(categories.map(c => c.name));
    });
  };

  const onDropToCategory = async (toCategory: string, item: Item) => {
    // Local optimistic move
    setCategories(prev => {
      const next = prev.map(c => ({ ...c, items: [...c.items] }));
      let moved: Item | null = null;
      for (const c of next) {
        const idx = c.items.findIndex(i => i.id === item.id);
        if (idx >= 0) moved = c.items.splice(idx, 1)[0];
      }
      if (!moved) return prev;
      const dst = next.find(c => c.name === toCategory);
      if (!dst) return prev;
      dst.items.push(moved);
      return next;
    });

    if (!canEdit) return;

    await fetch('/api/public/move-category', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        category: toCategory,
        assetId: item.assetId,
        besParentId: item.besParentId,
        besFundCode: item.besFundCode,
      })
    });
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Portfolio Allocation (Public)</div>
        <button onClick={toggleAll} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>


      {categories.map((c) => {
        const isOpen = expanded.has(c.name);
        return (
          <div
            key={c.name}
            style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}
            onDragOver={(e) => canEdit && e.preventDefault()}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              const raw = e.dataTransfer.getData('application/json');
              if (!raw) return;
              const item: Item = JSON.parse(raw);
              onDropToCategory(c.name, item);
            }}
          >
            <button onClick={() => toggleOne(c.name)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface)', border: 'none', cursor: 'pointer' }}>
              <b style={{ fontSize: 12 }}>{c.name}</b>
              <b style={{ fontSize: 12 }}>{Math.round(c.pct)}%</b>
            </button>
            {isOpen && (
              <div>
                {c.items.map((a) => (
                  <div
                    key={a.id}
                    draggable={!!canEdit}
                    onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify(a))}
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: '6px 10px', borderTop: '1px solid var(--border)', fontSize: 12, cursor: canEdit ? 'grab' : 'default' }}
                  >
                    <span style={{ opacity: 0.9 }}>{a.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>1D {typeof a.oneDay === 'number' ? `${Math.round(a.oneDay)}%` : '-'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>ALL {typeof a.allTime === 'number' ? `${Math.round(a.allTime)}%` : '-'}</span>
                    <span>{Math.round(a.pct)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* autonomous-engine:JOB-20260309-204954896-002:single-functional-change */

/* autonomous-engine:JOB-20260310-144014279-001:single-functional-change */

/* autonomous-engine:JOB-20260310-144014279-001:r1-t1:single-functional-change */

/* autonomous-engine:JOB-20260310-144014279-001:r1-t2:single-functional-change */

/* autonomous-engine:JOB-20260310-144014279-001:r1-t3:single-functional-change */

/* autonomous-engine:JOB-20260310-150019647-003:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-150019647-003:r0-t1:single-functional-change */

/* autonomous-engine:JOB-20260310-150019648-004:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-150019648-004:r0-t1:single-functional-change */

/* autonomous-engine:JOB-20260310-192540859-001:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-192540859-001:r0-t1:single-functional-change */

/* autonomous-engine:JOB-20260310-192709346-001:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-202813645-001:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-144014279-001:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-150019646-001:a1:r1-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-150019646-001:a2:r2-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-150019647-002:a1:r1-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-210108325-001:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-150019648-004:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-205527358-001:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-150019647-003:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260310-192540859-001:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-084829410-001:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-090354314-001721:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-093414582-001279:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-093453850-001648:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-110002390-001799:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-125530848-001323:a2:r1-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-125530848-001323:a4:r3-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-125530848-001323:a6:r5-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-125530848-001323:a8:r7-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-142120531-001121:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-142120531-001121:a3:r2-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-125530848-001323:a10:r9-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-142120531-001121:a6:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-150530034-001903:a1:r0-t0:single-functional-change */

/* autonomous-engine:JOB-20260311-155530844-001527:a3:r0-t0:single-functional-change */
