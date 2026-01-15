"use client";

import { useState } from "react";
import { MobileVision } from "./MobileVision";
import { MobileImpactSheet } from "./MobileImpactSheet";

interface MobileVisionTabProps {
    totalValueEUR: number;
}

type VisionSubTab = 'vision' | 'spendings';

export function MobileVisionTab({ totalValueEUR }: MobileVisionTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<VisionSubTab>('vision');

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Sub-Tab Header */}
            <div style={{
                display: 'flex',
                gap: '0',
                borderBottom: '2px solid var(--border)',
                background: 'var(--bg-primary)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                padding: '0 1rem'
            }}>
                {[
                    { key: 'vision', label: 'Vision' },
                    { key: 'spendings', label: 'Spendings' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveSubTab(tab.key as VisionSubTab)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            padding: '12px 8px',
                            fontSize: '0.85rem',
                            fontWeight: activeSubTab === tab.key ? 800 : 600,
                            color: activeSubTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.2s',
                            borderBottom: activeSubTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
                            marginBottom: '-2px'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-Tab Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {activeSubTab === 'vision' && (
                    <MobileVision totalValueEUR={totalValueEUR} />
                )}

                {activeSubTab === 'spendings' && (
                    <div style={{ padding: '1rem' }}>
                        {/* Spendings Impact Simulator - Embedded Version */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            border: '1px solid var(--border)'
                        }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Impact Simulator</h2>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                See the true cost of spending vs. investing.
                            </p>

                            {/* Input Field */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    SPENDING AMOUNT
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{
                                        position: 'absolute',
                                        left: '16px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: '1.2rem',
                                        fontWeight: 700,
                                        color: 'var(--text-muted)'
                                    }}>€</span>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            paddingLeft: '32px',
                                            fontSize: '1.5rem',
                                            fontWeight: 700,
                                            color: 'var(--text-primary)',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Settings */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1, background: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>TIMEFRAME</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>10 Years</div>
                                    <input
                                        type="range"
                                        min="1" max="40"
                                        defaultValue="10"
                                        style={{ width: '100%', marginTop: '8px', accentColor: 'var(--accent)' }}
                                    />
                                </div>
                                <div style={{ flex: 1, background: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>RETURN RATE</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>8%</div>
                                    <input
                                        type="range"
                                        min="1" max="20"
                                        defaultValue="8"
                                        style={{ width: '100%', marginTop: '8px', accentColor: 'var(--accent)' }}
                                    />
                                </div>
                            </div>

                            {/* Result Placeholder */}
                            <div style={{
                                background: 'linear-gradient(135deg, var(--accent), #a855f7)',
                                borderRadius: '16px',
                                padding: '1.5rem',
                                textAlign: 'center',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                                    FUTURE VALUE
                                </div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>
                                    €0
                                </div>
                            </div>

                            {/* Warning Message */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                padding: '12px',
                                borderRadius: '12px',
                                border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    💡 <strong style={{ color: 'var(--danger)' }}>Don't spend, invest!</strong> Every euro you invest today could be worth much more tomorrow.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
