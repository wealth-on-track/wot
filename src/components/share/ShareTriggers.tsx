import React from 'react';
import { Share2, Sparkles, TrendingUp, Target } from 'lucide-react';
import { ShareData } from './Templates';

interface TriggerProps {
    data: ShareData;
    onShare?: (data: ShareData) => void;
    variant?: 'default' | 'minimal' | 'glow';
}

// 1. Success Trigger (Performance Chart)
export const SuccessTrigger = ({ data, onShare }: TriggerProps) => {
    return (
        <button
            onClick={() => onShare && onShare(data)}
            className="trigger-success"
            style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '8px',
                color: '#818cf8', fontWeight: 600, fontSize: '12px',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.2)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.1)';
            }}
        >
            <Sparkles size={14} fill="currentColor" style={{ opacity: 0.8 }} />
            <span>Share Story</span>
        </button>
    );
};

// 2. Intelligence Trigger (Insights)
export const IntelligenceTrigger = ({ data, onShare, label = "Share" }: { data: ShareData, onShare?: (data: ShareData) => void, label?: string }) => {
    // Improved styling for visibility on light backgrounds
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onShare && onShare(data); }}
            style={{
                background: 'rgba(255, 255, 255, 0.5)',
                border: '1px solid rgba(0,0,0,0.05)',
                borderRadius: '6px',
                padding: '4px 8px',
                color: 'var(--text-secondary, #475569)',
                fontSize: '11px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                opacity: 1,
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }}
        >
            <Share2 size={12} strokeWidth={2.5} /> {label}
        </button>
    );
};

// 3. Milestone Trigger (Goals)
export const MilestoneTrigger = ({ data, onShare }: TriggerProps) => {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onShare && onShare(data); }}
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '20px', padding: '4px 10px',
                color: 'var(--text-primary)', fontSize: '10px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        >
            <Target size={12} /> Share
        </button>
    );
};

