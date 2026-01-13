"use client";

type View = 'overview' | 'performance' | 'allocations' | 'positions';

interface MobileBottomNavProps {
    activeView: View;
    onViewChange: (view: View) => void;
}

import { LayoutGrid, PieChart, TrendingUp, List } from "lucide-react";

export function MobileBottomNav({ activeView, onViewChange }: MobileBottomNavProps) {
    const navItems = [
        { id: 'overview' as View, label: 'Overview', icon: <LayoutGrid size={24} /> },
        { id: 'performance' as View, label: 'Performance', icon: <TrendingUp size={24} /> },
        { id: 'allocations' as View, label: 'Allocations', icon: <PieChart size={24} /> },
        { id: 'positions' as View, label: 'Positions', icon: <List size={24} /> },
    ];

    return (
        <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1000,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))'
        }}>
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.3rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        color: activeView === item.id ? 'var(--accent)' : 'var(--text-muted)',
                        opacity: activeView === item.id ? 1 : 0.6
                    }}
                >
                    <div style={{
                        transition: 'transform 0.2s',
                        transform: activeView === item.id ? 'scale(1.1)' : 'scale(1)'
                    }}>
                        {item.icon}
                    </div>
                    <div style={{
                        fontSize: '0.6rem',
                        fontWeight: activeView === item.id ? 800 : 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        marginTop: '2px'
                    }}>
                        {item.label}
                    </div>
                </button>
            ))}
        </nav>
    );
}
