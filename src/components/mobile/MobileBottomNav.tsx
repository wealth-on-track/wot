"use client";

import { Home, Layers, PieChart, Eye } from "lucide-react";

export type Tab = 'dashboard' | 'positions' | 'allocation' | 'vision';

interface MobileBottomNavProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
    const tabs = [
        { id: 'dashboard', label: 'Home', icon: Home },
        { id: 'positions', label: 'Positions', icon: Layers },
        { id: 'allocation', label: 'Allocation', icon: PieChart },
        { id: 'vision', label: 'Vision', icon: Eye }
    ] as const;

    return (
        <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '8px 0',
            paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
            zIndex: 1000,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.1)'
        }}>
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as Tab)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: 'none',
                            padding: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            color: isActive ? 'var(--accent)' : 'var(--text-muted)'
                        }}
                    >
                        <Icon
                            size={22}
                            strokeWidth={isActive ? 2.5 : 2}
                        />
                        <span style={{
                            fontSize: '0.65rem',
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: '0.02em'
                        }}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
