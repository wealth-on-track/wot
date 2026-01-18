import React from 'react';
import { motion } from 'framer-motion';

export interface WotTabItem {
    id: string;
    label: string | React.ReactNode;
    count?: number | string;
    isHistory?: boolean;
}

interface WotTabsProps {
    tabs: WotTabItem[];
    activeTabId: string;
    onTabChange: (id: string) => void;
    layoutIdPrefix?: string;
    theme?: 'dark' | 'light';
    /** 
     * Active indicator color (bottom border) 
     * Default: '#10B981' (green)
     * Example: Change to '#3B82F6' for blue active tabs
     */
    activeIndicatorColor?: string;
    /**
     * Gap between tabs
     * Default: '7px'
     */
    gap?: string;
}

/**
 * WotTabs - Unified Tab Component
 * 
 * Centralized tab system used across the app (Performance/Vision, Open/Closed Positions).
 * To change all active tabs to blue, simply pass activeIndicatorColor="#3B82F6"
 * 
 * Features:
 * - Folder-style tabs with active indicator
 * - Customizable colors and spacing
 * - Count badges support
 * - Smooth transitions
 */
export function WotTabs({
    tabs,
    activeTabId,
    onTabChange,
    layoutIdPrefix = 'wot-tabs',
    theme = 'light',
    activeIndicatorColor = '#10B981', // Default green, easily customizable
    gap = '7px'
}: WotTabsProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap,
            paddingLeft: 1,
            position: 'relative',
            zIndex: 10,
            marginBottom: '1.5px' // Locks to card border
        }}>
            {tabs.map((tab, index) => {
                const isActive = activeTabId === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        style={{
                            // Folder Shape
                            padding: '12px 14px',
                            borderRadius: '12px 12px 0 0',

                            // Border (active: visible, inactive: transparent for spacing)
                            border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                            borderBottom: isActive ? `2px solid ${activeIndicatorColor}` : '2px solid transparent',

                            // Colors
                            background: 'var(--surface)',
                            color: isActive ? 'var(--text-primary)' : '#64748B',

                            // Typography
                            fontSize: '0.9rem',
                            fontWeight: isActive ? 700 : 500,

                            // Layout
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            position: 'relative',
                            transition: 'all 0.2s',
                            boxShadow: isActive ? '0 -4px 12px -2px rgba(0,0,0,0.05)' : 'none',
                            marginLeft: '0',
                            opacity: isActive ? 1 : 0.7
                        }}
                    >
                        {tab.label}

                        {/* Count Badge */}
                        {(tab.count !== undefined) && (
                            <span style={{
                                fontSize: '0.75rem',
                                opacity: isActive ? 0.7 : 0.5,
                                fontWeight: 500,
                                background: isActive ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.05)',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                marginLeft: '0'
                            }}>
                                {tab.isHistory ? `(${tab.count})` : tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
