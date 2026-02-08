"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Target, TrendingDown, Activity, TrendingUp, Edit2 } from 'lucide-react';
import { usePortfolioHistory } from '@/hooks/useBenchmarkData';
import { useCurrency } from '@/context/CurrencyContext';
import { convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { formatNumber } from '@/lib/formatters';
import { normalizeToPercentage } from '@/lib/benchmarkApi';

const SCENARIOS = {
    bear: { rate: 0.03, label: 'Bear', icon: TrendingDown, color: '#EF4444' },
    expected: { rate: 0.10, label: 'Expected', icon: Activity, color: '#8B5CF6' },
    bull: { rate: 0.15, label: 'Bull', icon: TrendingUp, color: '#10B981' },
    custom: { rate: 0, label: 'Custom', icon: Edit2, color: '#F59E0B' }
};

interface VisionChartProps {
    username: string;
    totalValueEUR: number;
}

interface ChartDataPoint {
    date: string;
    portfolio?: number;
    projectedValue?: number;
    _actualValue?: number;
}

// Vision Tooltip
function VisionTooltip({ active, payload, label, currencySym }: any) {
    if (!active || !payload || payload.length === 0) return null;

    const dataPoint = payload[0]?.payload;
    const projectedVal = dataPoint?._actualValue || 0;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        if (date > new Date()) {
            return `${month} ${year} (Projected)`;
        }
        const day = date.getDate();
        return `${day} ${month} ${year}`;
    };

    const fmtCurrency = (val: number) =>
        new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

    const freedomDays = Math.floor(projectedVal / 50);
    const rentYears = (projectedVal / 12000).toFixed(1);

    return (
        <div style={{
            background: '#0f172a',
            border: '1px solid #10B981',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1)',
            minWidth: '220px',
            zIndex: 1000
        }}>
            <p style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginBottom: '12px',
                fontWeight: 600,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '8px'
            }}>
                {formatDate(label || '')}
            </p>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>Projected Value</span>
                <span style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#10B981',
                    fontVariantNumeric: 'tabular-nums'
                }}>
                    {currencySym}{fmtCurrency(projectedVal)}
                </span>
            </div>

            {/* Lifestyle Power */}
            <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '12px',
                borderRadius: '10px'
            }}>
                <div style={{
                    fontSize: '10px',
                    color: '#10B981',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: '8px',
                    letterSpacing: '0.05em'
                }}>
                    Lifestyle Power
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                        <span>🏠</span>
                        <strong style={{ color: '#10B981' }}>{rentYears}</strong> Years of Rent
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                        <span>🏄</span>
                        <strong style={{ color: '#10B981' }}>{freedomDays}</strong> Days of Freedom
                    </div>
                </div>
            </div>
        </div>
    );
}

// Skeleton for loading
function ChartSkeleton() {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            gap: '4px',
            padding: '20px 20px 60px 20px'
        }}>
            {Array.from({ length: 20 }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        flex: 1,
                        height: `${20 + i * 4}%`,
                        background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                        borderRadius: '4px 4px 0 0',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        animationDelay: `${i * 0.08}s`
                    }}
                />
            ))}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }
            `}</style>
        </div>
    );
}

export function VisionChart({ username, totalValueEUR }: VisionChartProps) {
    const { currency } = useCurrency();
    const [isMounted, setIsMounted] = useState(false);
    const [visionYears, setVisionYears] = useState(10);
    const [monthlyAdd, setMonthlyAdd] = useState(0);
    const [activeScenario, setActiveScenario] = useState<keyof typeof SCENARIOS>('expected');
    const [customRate, setCustomRate] = useState(10);

    useEffect(() => { setIsMounted(true); }, []);

    // Fetch historical data
    const { data: portfolioData = [], isLoading } = usePortfolioHistory(username, 'ALL');

    // Currency
    const targetCurrency = currency === 'ORG' ? 'EUR' : currency;
    const currencySym = getCurrencySymbol(targetCurrency);
    const displayedTotalValue = convertCurrency(totalValueEUR, 'EUR', targetCurrency);

    // Calculate projected end value
    const projectedEndValue = useMemo(() => {
        const monthlyRate = activeScenario === 'custom'
            ? (customRate / 100) / 12
            : SCENARIOS[activeScenario].rate / 12;

        let value = totalValueEUR;
        for (let m = 0; m < visionYears * 12; m++) {
            value = (value * (1 + monthlyRate)) + monthlyAdd;
        }
        return convertCurrency(value, 'EUR', targetCurrency);
    }, [totalValueEUR, visionYears, monthlyAdd, activeScenario, customRate, targetCurrency]);

    // Chart data with projections
    const chartData = useMemo(() => {
        const normalizedPortfolio = normalizeToPercentage(portfolioData);
        const dataMap = new Map<string, ChartDataPoint>();

        // Add historical data
        normalizedPortfolio.forEach(point => {
            const dateKey = new Date(point.date).toISOString().split('T')[0];
            dataMap.set(dateKey, {
                date: point.date,
                portfolio: point.change || 0
            });
        });

        // Generate projections
        if (portfolioData.length > 0) {
            const lastPoint = portfolioData[portfolioData.length - 1];
            const currentReturnPct = normalizedPortfolio.length > 0
                ? (normalizedPortfolio[normalizedPortfolio.length - 1].change || 0)
                : 0;

            const startDate = new Date(lastPoint.date);
            let cumulativeValue = totalValueEUR;

            const monthlyRate = activeScenario === 'custom'
                ? (customRate / 100) / 12
                : SCENARIOS[activeScenario].rate / 12;

            for (let m = 1; m <= visionYears * 12; m++) {
                const fDate = new Date(startDate);
                fDate.setMonth(startDate.getMonth() + m);
                const dateKey = fDate.toISOString().split('T')[0];

                cumulativeValue = (cumulativeValue * (1 + monthlyRate)) + monthlyAdd;

                const growthFactor = cumulativeValue / totalValueEUR;
                const pctChangeSinceToday = (growthFactor - 1) * 100;
                const projectedPct = currentReturnPct + pctChangeSinceToday;

                dataMap.set(dateKey, {
                    date: dateKey,
                    portfolio: undefined,
                    projectedValue: projectedPct,
                    _actualValue: cumulativeValue
                });
            }
        }

        return Array.from(dataMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }, [portfolioData, visionYears, monthlyAdd, activeScenario, customRate, totalValueEUR]);

    // Y-axis ticks for vision mode
    const visionTicks = useMemo(() => {
        if (chartData.length === 0) return undefined;

        let maxVal = 0;
        chartData.forEach(d => {
            if (typeof d.projectedValue === 'number' && d.projectedValue > maxVal) maxVal = d.projectedValue;
        });

        if (maxVal <= 0) maxVal = 1;
        const count = 5;
        const roughStep = maxVal / count;
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalizedStep = roughStep / magnitude;

        let cleanStep;
        if (normalizedStep <= 1) cleanStep = 1;
        else if (normalizedStep <= 2) cleanStep = 2;
        else if (normalizedStep <= 5) cleanStep = 5;
        else cleanStep = 10;

        const step = cleanStep * magnitude;
        const ticks = [];
        for (let i = 0; i <= count; i++) {
            ticks.push(i * step);
        }
        return ticks;
    }, [chartData]);

    const formatXAxis = (tick: string) => new Date(tick).getFullYear().toString();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 0 16px 0',
                borderBottom: '1px solid var(--border)',
                marginBottom: '16px'
            }}>
                {/* Left: Title */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}>
                        <Target size={20} />
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Projected Value ({new Date().getFullYear() + visionYears})
                        </div>
                        <div style={{
                            fontSize: '1.8rem',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #10B981 0%, #34d399 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em'
                        }}>
                            {currencySym}{formatNumber(projectedEndValue, 0, 0)}
                        </div>
                    </div>
                </div>

                {/* Right: Current Value */}
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase'
                    }}>
                        Current
                    </div>
                    <div style={{
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)'
                    }}>
                        {currencySym}{formatNumber(displayedTotalValue, 0, 0)}
                    </div>
                </div>
            </div>

            {/* Chart + Controls */}
            <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
                {/* Chart */}
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    height: 'calc(100vh - 320px)',
                    minHeight: '280px',
                    maxHeight: '450px',
                    position: 'relative',
                    background: 'var(--surface)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    padding: '16px',
                    overflow: 'hidden'
                }}>
                    {isLoading && <ChartSkeleton />}

                    {isMounted && chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorVision" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />

                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatXAxis}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={60}
                                    dy={10}
                                />

                                <YAxis
                                    width={55}
                                    allowDecimals={false}
                                    ticks={visionTicks}
                                    domain={[0, 'dataMax']}
                                    tickFormatter={(val) => `${val}%`}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                />

                                <Tooltip
                                    content={<VisionTooltip currencySym={currencySym} />}
                                    cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />

                                {/* Historical line */}
                                <Area
                                    type="monotone"
                                    dataKey="portfolio"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fill="url(#colorHistory)"
                                    animationDuration={800}
                                />

                                {/* Projection line */}
                                <Area
                                    type="monotone"
                                    dataKey="projectedValue"
                                    stroke="#10B981"
                                    strokeWidth={3}
                                    fill="url(#colorVision)"
                                    animationDuration={1000}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Settings Panel */}
                <div style={{
                    width: '320px',
                    flexShrink: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    {/* Time Horizon */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#9CA3AF',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '10px'
                        }}>
                            Time Horizon: <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 800 }}>{visionYears} Years</span>
                        </label>
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
                                accentColor: '#10B981',
                                cursor: 'pointer'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600 }}>1Y</span>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600 }}>30Y</span>
                        </div>
                    </div>

                    {/* Monthly Add */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#9CA3AF',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '8px'
                        }}>
                            Monthly Contribution ({currencySym})
                        </label>
                        <input
                            type="number"
                            value={monthlyAdd || ''}
                            onChange={(e) => setMonthlyAdd(Number(e.target.value) || 0)}
                            placeholder="0"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Market Scenario */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#9CA3AF',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '10px'
                        }}>
                            Market Scenario
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map((key) => {
                                const s = SCENARIOS[key];
                                const Icon = s.icon;
                                const isActive = activeScenario === key;

                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveScenario(key)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '10px 6px',
                                            background: isActive ? s.color : 'var(--bg-primary)',
                                            border: `2px solid ${isActive ? s.color : 'var(--border)'}`,
                                            borderRadius: '10px',
                                            color: isActive ? '#fff' : 'var(--text-secondary)',
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Icon size={16} />
                                        <span>{s.label}</span>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                            {key === 'custom' ? `${customRate}%` : `${s.rate * 100}%`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom rate input */}
                        {activeScenario === 'custom' && (
                            <div style={{ marginTop: '12px' }}>
                                <input
                                    type="number"
                                    value={customRate}
                                    onChange={(e) => setCustomRate(Number(e.target.value))}
                                    placeholder="Annual return %"
                                    step="0.5"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid #F59E0B',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        color: '#F59E0B',
                                        outline: 'none',
                                        textAlign: 'center'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
