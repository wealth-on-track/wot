"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line
} from 'recharts';
import { BENCHMARK_ASSETS, normalizeToPercentage, BenchmarkDataPoint } from '@/lib/benchmarkApi';
import { useBenchmarkData, usePortfolioHistory } from '@/hooks/useBenchmarkData';
import { useCurrency } from '@/context/CurrencyContext';
import { convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { formatNumber } from '@/lib/formatters';
import { ChartBenchmarkSelector } from '../ChartBenchmarkSelector';

type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

interface PerformanceChartProps {
    username: string;
    totalValueEUR: number;
    selectedBenchmarks: string[];
    isPortfolioVisible: boolean;
    onToggleBenchmark: (id: string) => void;
    onTogglePortfolio: () => void;
    defaultRange?: string;
}

interface ChartDataPoint {
    date: string;
    portfolio?: number;
    [key: string]: number | string | undefined;
}

// Skeleton loader component
function ChartSkeleton() {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '20px'
        }}>
            {/* Animated bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%', paddingBottom: '40px' }}>
                {Array.from({ length: 30 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: `${30 + Math.sin(i * 0.5) * 40 + 30}%`,
                            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)',
                            borderRadius: '4px 4px 0 0',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            animationDelay: `${i * 0.05}s`
                        }}
                    />
                ))}
            </div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }
            `}</style>
        </div>
    );
}

// Performance stats tooltip
function PerformanceTooltip({ active, payload, label }: any) {
    if (!active || !payload || payload.length === 0) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
        return `${day} ${month} ${year} - ${weekday}`;
    };

    const sortedPayload = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));

    return (
        <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1)',
            minWidth: '200px',
            zIndex: 1000
        }}>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: 500 }}>
                {formatDate(label || '')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sortedPayload.map((entry: any) => {
                    const isPortfolio = entry.dataKey === 'portfolio';
                    const benchmark = BENCHMARK_ASSETS.find(b => b.id === entry.dataKey);
                    const name = isPortfolio ? 'My Portfolio' : (benchmark?.name || entry.dataKey);
                    const color = isPortfolio ? '#6366f1' : (benchmark?.color || entry.color);
                    const val = Number(entry.value);

                    return (
                        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color }} />
                                <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{name}</span>
                            </div>
                            <span style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: val >= 0 ? '#4ade80' : '#f87171',
                                fontVariantNumeric: 'tabular-nums'
                            }}>
                                {val > 0 ? '+' : ''}{val.toFixed(2)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function PerformanceChart({
    username,
    totalValueEUR,
    selectedBenchmarks,
    isPortfolioVisible,
    onToggleBenchmark,
    onTogglePortfolio,
    defaultRange = '1Y'
}: PerformanceChartProps) {
    const { currency } = useCurrency();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(defaultRange as TimePeriod);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    // Fetch data with React Query (cached)
    const { data: portfolioData = [], isLoading: portfolioLoading } = usePortfolioHistory(username, selectedPeriod);
    const { benchmarkData, isLoading: benchmarksLoading, isFetching } = useBenchmarkData({
        selectedBenchmarks,
        period: selectedPeriod
    });

    const isLoading = portfolioLoading || benchmarksLoading;

    // Currency conversion
    const targetCurrency = currency === 'ORG' ? 'EUR' : currency;
    const currencySym = getCurrencySymbol(targetCurrency);
    const displayedTotalValue = convertCurrency(totalValueEUR, 'EUR', targetCurrency);

    // Calculate stats from data
    const portfolioStats = useMemo(() => {
        if (!portfolioData || portfolioData.length === 0) {
            return { change: 0, changePercent: 0 };
        }
        const latest = portfolioData[portfolioData.length - 1];
        const first = portfolioData[0];
        const changePercent = ((latest.value - first.value) / first.value) * 100;
        const change = totalValueEUR * (changePercent / 100);
        return { change, changePercent };
    }, [portfolioData, totalValueEUR]);

    const displayedChange = convertCurrency(portfolioStats.change, 'EUR', targetCurrency);
    const isPositive = portfolioStats.changePercent >= 0;

    // Prepare chart data
    const chartData = useMemo(() => {
        const normalizedPortfolio = normalizeToPercentage(portfolioData);
        const dataMap = new Map<string, ChartDataPoint>();

        // Add portfolio data
        normalizedPortfolio.forEach(point => {
            const dateKey = selectedPeriod === '1D'
                ? new Date(point.date).toISOString()
                : new Date(point.date).toISOString().split('T')[0];

            dataMap.set(dateKey, {
                date: point.date,
                portfolio: point.change || 0
            });
        });

        // Merge benchmark data
        Object.entries(benchmarkData).forEach(([benchmarkId, data]) => {
            if (!data || data.length === 0) return;
            data.forEach(point => {
                const dateKey = selectedPeriod === '1D'
                    ? new Date(point.date).toISOString()
                    : new Date(point.date).toISOString().split('T')[0];

                const existing = dataMap.get(dateKey);
                if (existing) {
                    existing[benchmarkId] = point.change || 0;
                } else {
                    dataMap.set(dateKey, {
                        date: point.date,
                        [benchmarkId]: point.change || 0
                    });
                }
            });
        });

        return Array.from(dataMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }, [portfolioData, benchmarkData, selectedPeriod]);

    // Last point for stats panel
    const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;

    // Format X-axis based on period
    const formatXAxis = (tick: string) => {
        const date = new Date(tick);
        switch (selectedPeriod) {
            case '1D': return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            case '1W': return date.toLocaleDateString([], { weekday: 'short' });
            case '1M': return date.getDate().toString();
            case 'YTD':
            case '1Y': return date.toLocaleDateString([], { month: 'short' });
            case 'ALL': return date.getFullYear().toString();
            default: return date.toLocaleDateString();
        }
    };

    const periods: TimePeriod[] = ['1D', '1W', '1M', 'YTD', '1Y', 'ALL'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header: Stats + Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 0 16px 0',
                borderBottom: '1px solid var(--border)',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                {/* Left: Benchmark Selector */}
                <ChartBenchmarkSelector
                    selectedBenchmarks={selectedBenchmarks}
                    onToggleBenchmark={onToggleBenchmark}
                    isPortfolioVisible={isPortfolioVisible}
                    onTogglePortfolio={onTogglePortfolio}
                />

                {/* Right: Period Selector + Stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Stats */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                        <span style={{
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.02em'
                        }}>
                            {currencySym}{formatNumber(displayedTotalValue, 0, 0)}
                        </span>
                        <span style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: isPositive ? 'var(--success)' : 'var(--danger)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            {isPositive ? '▲' : '▼'} {Math.abs(portfolioStats.changePercent).toFixed(2)}%
                            <span style={{ opacity: 0.8, fontSize: '0.85rem' }}>
                                ({isPositive ? '+' : '-'}{currencySym}{formatNumber(Math.abs(displayedChange), 0, 0)})
                            </span>
                        </span>
                    </div>

                    {/* Period Selector */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'var(--bg-secondary)',
                        padding: '4px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)'
                    }}>
                        {periods.map((period) => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: selectedPeriod === period ? '#ffffff' : 'var(--text-muted)',
                                    background: selectedPeriod === period ? '#6366f1' : 'transparent',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                {/* Chart */}
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    height: 'calc(100vh - 280px)',
                    minHeight: '300px',
                    maxHeight: '500px',
                    position: 'relative',
                    background: 'var(--surface)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    padding: '16px',
                    overflow: 'hidden'
                }}>
                    {/* Loading skeleton */}
                    {isLoading && <ChartSkeleton />}

                    {/* No data state */}
                    {!isLoading && chartData.length === 0 && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No data available</span>
                        </div>
                    )}

                    {/* Fetching indicator (when updating) */}
                    {!isLoading && isFetching && (
                        <div style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            color: '#6366f1',
                            fontWeight: 600,
                            zIndex: 10
                        }}>
                            Updating...
                        </div>
                    )}

                    {isMounted && chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPortfolioPerf" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="rgba(0,0,0,0.05)" />

                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatXAxis}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={50}
                                    dy={10}
                                />

                                <YAxis
                                    width={50}
                                    allowDecimals={false}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(val) => `${val}%`}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                />

                                <Tooltip
                                    content={<PerformanceTooltip />}
                                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />

                                {/* Portfolio area */}
                                {isPortfolioVisible && (
                                    <Area
                                        type="monotone"
                                        dataKey="portfolio"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fill="url(#colorPortfolioPerf)"
                                        animationDuration={800}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                                    />
                                )}

                                {/* Benchmark lines */}
                                {selectedBenchmarks.map(id => {
                                    const b = BENCHMARK_ASSETS.find(a => a.id === id);
                                    return (
                                        <Line
                                            key={id}
                                            type="monotone"
                                            dataKey={id}
                                            stroke={b?.color}
                                            strokeWidth={2}
                                            dot={false}
                                            connectNulls
                                            animationDuration={800}
                                        />
                                    );
                                })}
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Stats Panel */}
                {lastPoint && (
                    <div style={{
                        width: '240px',
                        flexShrink: 0,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            marginBottom: '16px',
                            paddingBottom: '12px',
                            borderBottom: '1px solid var(--border)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {selectedPeriod} Performance
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                            {(() => {
                                const items: { name: string; value: number; color: string }[] = [];

                                if (isPortfolioVisible && lastPoint.portfolio !== undefined) {
                                    items.push({
                                        name: 'My Portfolio',
                                        value: Number(lastPoint.portfolio),
                                        color: '#6366f1'
                                    });
                                }

                                selectedBenchmarks.forEach(id => {
                                    const val = Number(lastPoint[id]);
                                    if (!isNaN(val)) {
                                        const b = BENCHMARK_ASSETS.find(a => a.id === id);
                                        items.push({
                                            name: b?.name || id,
                                            value: val,
                                            color: b?.color || '#ccc'
                                        });
                                    }
                                });

                                return items.sort((a, b) => b.value - a.value).map(item => (
                                    <div key={item.name} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '3px',
                                                background: item.color,
                                                flexShrink: 0
                                            }} />
                                            <span style={{
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                color: 'var(--text-primary)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            color: item.value >= 0 ? 'var(--success)' : 'var(--danger)',
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>
                                            {item.value > 0 ? '+' : ''}{item.value.toFixed(2)}%
                                        </span>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
