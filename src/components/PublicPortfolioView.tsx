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

const formatSignedPercent = (value?: number) => {
  if (typeof value !== "number") return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
};

const toneStyle = (value?: number) => {
  if (typeof value !== "number") {
    return {
      color: "var(--text-muted)",
      background: "transparent",
      border: "1px solid transparent",
    };
  }

  if (value >= 0) {
    return {
      color: "#10b981",
      background: "rgba(16,185,129,0.1)",
      border: "1px solid rgba(16,185,129,0.2)",
    };
  }

  return {
    color: "#ef4444",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.2)",
  };
};

export function PublicPortfolioView({ categories: initialCategories, canEdit }: { categories: Category[]; canEdit?: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  const allExpanded = useMemo(() => categories.length > 0 && expanded.size >= categories.length, [expanded, categories.length]);
  const totalItems = useMemo(() => categories.reduce((sum, category) => sum + category.items.length, 0), [categories]);

  const toggleOne = (name: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  };

  const toggleAll = () => {
    setExpanded((prev) => {
      if (prev.size >= categories.length) return new Set();
      return new Set(categories.map((c) => c.name));
    });
  };

  const onDropToCategory = async (toCategory: string, item: Item) => {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, items: [...c.items] }));
      let moved: Item | null = null;
      for (const c of next) {
        const idx = c.items.findIndex((i) => i.id === item.id);
        if (idx >= 0) moved = c.items.splice(idx, 1)[0];
      }
      if (!moved) return prev;
      const dst = next.find((c) => c.name === toCategory);
      if (!dst) return prev;
      dst.items.push(moved);
      return next;
    });

    if (!canEdit) return;

    await fetch("/api/public/move-category", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category: toCategory,
        assetId: item.assetId,
        besParentId: item.besParentId,
        besFundCode: item.besFundCode,
      }),
    });
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "linear-gradient(180deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 86%, black) 100%)",
          padding: "12px 14px",
          marginBottom: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.01em", color: "var(--text-primary)" }}>Portfolio Allocation</div>
          <button
            onClick={toggleAll}
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span>{categories.length} categories · {totalItems} holdings</span>
          {canEdit ? <span>Drag holdings between categories to reorganize</span> : <span>Public read-only view</span>}
        </div>
      </div>

      {categories.map((c) => {
        const isOpen = expanded.has(c.name);
        return (
          <div
            key={c.name}
            style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8, overflow: "hidden", background: "var(--surface)" }}
            onDragOver={(e) => canEdit && e.preventDefault()}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/json");
              if (!raw) return;
              const item: Item = JSON.parse(raw);
              onDropToCategory(c.name, item);
            }}
          >
            <button
              onClick={() => toggleOne(c.name)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <b style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.name}</b>
              <b style={{ fontSize: 12, color: "var(--text-secondary)" }}>{Math.round(c.pct)}%</b>
            </button>

            {isOpen && (
              <div>
                {c.items.length === 0 && (
                  <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)" }}>
                    No holdings in this category.
                  </div>
                )}

                {c.items.map((a) => {
                  const oneDayTone = toneStyle(a.oneDay);
                  const allTimeTone = toneStyle(a.allTime);

                  return (
                    <div
                      key={a.id}
                      draggable={!!canEdit}
                      onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify(a))}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto",
                        gap: 8,
                        alignItems: "center",
                        padding: "8px 12px",
                        borderTop: "1px solid var(--border)",
                        fontSize: 12,
                        cursor: canEdit ? "grab" : "default",
                      }}
                    >
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{a.name}</span>

                      <span
                        style={{
                          ...oneDayTone,
                          padding: "3px 6px",
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                        aria-label={`1 day return ${formatSignedPercent(a.oneDay)}`}
                      >
                        1D {formatSignedPercent(a.oneDay)}
                      </span>

                      <span
                        style={{
                          ...allTimeTone,
                          padding: "3px 6px",
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                        aria-label={`All time return ${formatSignedPercent(a.allTime)}`}
                      >
                        ALL {formatSignedPercent(a.allTime)}
                      </span>

                      <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{Math.round(a.pct)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
