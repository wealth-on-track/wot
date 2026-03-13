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

const toneClass = (value?: number) => {
  if (typeof value !== "number") return "public-allocation-pill is-neutral";
  return value >= 0 ? "public-allocation-pill is-positive" : "public-allocation-pill is-negative";
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
    <div className="public-allocation-shell">
      <div className="public-allocation-summary">
        <div className="public-allocation-summary-head">
          <div className="public-allocation-title">Portfolio Allocation</div>
          <button onClick={toggleAll} className="public-allocation-toggle-all">
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <div className="public-allocation-summary-meta">
          <span>{categories.length} categories · {totalItems} holdings</span>
          {canEdit ? <span>Drag holdings between categories to reorganize</span> : <span>Public read-only view</span>}
        </div>
      </div>

      {categories.map((c) => {
        const isOpen = expanded.has(c.name);
        return (
          <div
            key={c.name}
            className="public-allocation-category"
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
            <button onClick={() => toggleOne(c.name)} className="public-allocation-category-head">
              <div className="public-allocation-category-title-wrap">
                <b className="public-allocation-category-title">{c.name}</b>
                <span className="public-allocation-category-count">{c.items.length} holdings</span>
              </div>
              <div className="public-allocation-category-right">
                <b className="public-allocation-category-pct">{Math.round(c.pct)}%</b>
                <span className={`public-allocation-chevron ${isOpen ? "is-open" : ""}`} aria-hidden="true">⌄</span>
              </div>
            </button>

            {isOpen && (
              <div>
                {c.items.length === 0 && <div className="public-allocation-empty">No holdings in this category.</div>}

                {c.items.map((a) => (
                  <div
                    key={a.id}
                    draggable={!!canEdit}
                    onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify(a))}
                    className={`public-allocation-row ${canEdit ? "is-draggable" : ""}`}
                  >
                    <span className="public-allocation-row-name">{a.name}</span>

                    <span className={toneClass(a.oneDay)} aria-label={`1 day return ${formatSignedPercent(a.oneDay)}`}>
                      1D {formatSignedPercent(a.oneDay)}
                    </span>

                    <span className={toneClass(a.allTime)} aria-label={`All time return ${formatSignedPercent(a.allTime)}`}>
                      ALL {formatSignedPercent(a.allTime)}
                    </span>

                    <span className="public-allocation-row-pct">{Math.round(a.pct)}%</span>
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
