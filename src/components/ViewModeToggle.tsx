"use client";

import React from "react";
import { LayoutGrid, Maximize2 } from "lucide-react";

interface ViewModeToggleProps {
    viewMode: 'card' | 'fullscreen';
    onToggle: (mode: 'card' | 'fullscreen') => void;
}

export function ViewModeToggle({ viewMode, onToggle }: ViewModeToggleProps) {
    const isFullscreen = viewMode === 'fullscreen';

    return (
        <button
            onClick={() => onToggle(isFullscreen ? 'card' : 'fullscreen')}
            title={isFullscreen ? "Switch to Card View" : "Switch to Full Screen View"}
            className="navbar-btn"
            style={{
                background: 'var(--bg-secondary)',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0',
                width: '2.5rem',
                height: '2.5rem',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {isFullscreen ? <LayoutGrid size={20} /> : <Maximize2 size={20} />}
        </button>
    );
}
