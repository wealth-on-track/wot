"use client";

import React from 'react';
import { TrendingDown, Activity, TrendingUp, Edit2 } from 'lucide-react';

interface VisionSettingsProps {
    visionYears: number;
    setVisionYears: (years: number) => void;
    monthlyAdd: number;
    setMonthlyAdd: (amount: number) => void;
    scenario: 'bear' | 'expected' | 'bull' | 'custom';
    setScenario: (scenario: 'bear' | 'expected' | 'bull' | 'custom') => void;
    customRate: number;
    setCustomRate: (rate: number) => void;
}

const SCENARIOS = {
    bear: { rate: 3, label: 'Bear', icon: TrendingDown, color: '#EF4444' },
    expected: { rate: 10, label: 'Expected', icon: Activity, color: '#8B5CF6' },
    bull: { rate: 15, label: 'Bull', icon: TrendingUp, color: '#10B981' },
    custom: { rate: 0, label: 'Custom', icon: Edit2, color: '#F59E0B' }
};

export function VisionSettings({
    visionYears,
    setVisionYears,
    monthlyAdd,
    setMonthlyAdd,
    scenario,
    setScenario,
    customRate,
    setCustomRate
}: VisionSettingsProps) {
    const [isMonthlyAddFocused, setIsMonthlyAddFocused] = React.useState(false);
    const [customInputValue, setCustomInputValue] = React.useState(customRate.toString());

    const handleMonthlyAddFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsMonthlyAddFocused(true);
        e.target.select(); // Select all text so it gets replaced when user types
    };

    const handleMonthlyAddBlur = () => {
        setIsMonthlyAddFocused(false);
        if (monthlyAdd === 0 || isNaN(monthlyAdd)) {
            setMonthlyAdd(0);
        }
    };

    const handleCustomRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomInputValue(value);
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            setCustomRate(numValue);
        }
    };

    return (
        <div style={{
            marginTop: '1.5rem',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08)'
        }}>
            {/* Row 1: Time Horizon + Monthly Add */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem',
                marginBottom: '1.5rem'
            }}>
                {/* TIME HORIZON */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        TIME HORIZON: <span style={{
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            marginLeft: '0.25rem'
                        }}>{visionYears} YEARS</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={visionYears}
                            onChange={(e) => setVisionYears(Number(e.target.value))}
                            style={{
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                background: '#E5E7EB',
                                outline: 'none',
                                accentColor: '#8B5CF6',
                                cursor: 'pointer'
                            }}
                        />
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '0.5rem'
                        }}>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600 }}>1Y</span>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600 }}>30Y</span>
                        </div>
                    </div>
                </div>

                {/* MONTHLY ADD */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        MONTHLY ADD (€)
                    </label>
                    <input
                        type="number"
                        value={isMonthlyAddFocused && monthlyAdd === 0 ? '' : monthlyAdd}
                        onChange={(e) => setMonthlyAdd(Number(e.target.value) || 0)}
                        onFocus={handleMonthlyAddFocus}
                        onBlur={handleMonthlyAddBlur}
                        placeholder=""
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                        onFocusCapture={(e) => {
                            e.target.style.borderColor = '#8B5CF6';
                            e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                        }}
                        onBlurCapture={(e) => {
                            e.target.style.borderColor = 'var(--border)';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>
            </div>

            {/* Row 2: Market Scenario (Full Width) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#9CA3AF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    MARKET SCENARIO
                </label>
                <div style={{
                    display: 'flex',
                    gap: '0.75rem'
                }}>
                    {(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).filter(key => key !== 'custom').map((key) => {
                        const s = SCENARIOS[key];
                        const Icon = s.icon;
                        const isActive = scenario === key;

                        return (
                            <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setScenario(key)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.85rem 0.6rem',
                                        background: isActive ? s.color : 'var(--surface)',
                                        border: `2px solid ${isActive ? s.color : 'var(--border)'}`,
                                        borderRadius: '10px',
                                        color: isActive ? '#fff' : 'var(--text-secondary)',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textTransform: 'capitalize'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.borderColor = s.color;
                                            e.currentTarget.style.background = `${s.color}10`;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.background = 'var(--surface)';
                                        }
                                    }}
                                >
                                    <Icon size={16} />
                                    <span>{s.label}</span>
                                </button>
                                {/* Percentage below button */}
                                <div style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: isActive ? s.color : 'var(--text-muted)',
                                    textAlign: 'center'
                                }}>
                                    {s.rate}%
                                </div>
                            </div>
                        );
                    })}

                    {/* Custom Button */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={() => setScenario('custom')}
                            style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.85rem 0.6rem',
                                background: scenario === 'custom' ? SCENARIOS.custom.color : 'var(--surface)',
                                border: `2px solid ${scenario === 'custom' ? SCENARIOS.custom.color : 'var(--border)'}`,
                                borderRadius: '10px',
                                color: scenario === 'custom' ? '#fff' : 'var(--text-secondary)',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textTransform: 'capitalize'
                            }}
                            onMouseEnter={(e) => {
                                if (scenario !== 'custom') {
                                    e.currentTarget.style.borderColor = SCENARIOS.custom.color;
                                    e.currentTarget.style.background = `${SCENARIOS.custom.color}10`;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (scenario !== 'custom') {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.background = 'var(--surface)';
                                }
                            }}
                        >
                            <Edit2 size={16} />
                            <span>Custom</span>
                        </button>
                        {/* Custom input below button */}
                        {scenario === 'custom' ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px'
                            }}>
                                <input
                                    type="number"
                                    value={customInputValue}
                                    onChange={handleCustomRateChange}
                                    onFocus={(e) => e.target.select()}
                                    placeholder=""
                                    min="-50"
                                    max="100"
                                    step="0.5"
                                    style={{
                                        width: '50px',
                                        padding: '4px 6px',
                                        background: 'var(--surface)',
                                        border: '1px solid ' + SCENARIOS.custom.color,
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: SCENARIOS.custom.color,
                                        outline: 'none',
                                        textAlign: 'center'
                                    }}
                                />
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: SCENARIOS.custom.color
                                }}>%</span>
                            </div>
                        ) : (
                            <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                textAlign: 'center'
                            }}>
                                %
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
