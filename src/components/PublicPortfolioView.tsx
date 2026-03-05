"use client";

import { useMemo, useState } from "react";

type Item = { id: string; name: string; pct: number };
type Category = { name: string; pct: number; items: Item[] };

export function PublicPortfolioView({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Portfolio Allocation (Public)</div>
        <button onClick={toggleAll} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div style={{ color: 'var(--text-muted)', marginBottom: 10, fontSize: 11 }}>Amounts hidden • Percent only</div>

      {categories.map((c) => {
        const isOpen = expanded.has(c.name);
        return (
          <div key={c.name} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <button onClick={() => toggleOne(c.name)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface)', border: 'none', cursor: 'pointer' }}>
              <b style={{ fontSize: 12 }}>{c.name}</b>
              <b style={{ fontSize: 12 }}>{Math.round(c.pct)}%</b>
            </button>
            {isOpen && (
              <div>
                {c.items.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ opacity: 0.9 }}>{a.name}</span>
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
