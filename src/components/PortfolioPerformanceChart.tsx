"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { LineChart as LineChartIcon, Eye, EyeOff } from 'lucide-react';
import { BENCHMARK_ASSETS, fetchBenchmarkData, normalizeToPercentage, BenchmarkDataPoint } from '@/lib/benchmarkApi';
import { formatEUR, formatNumber } from '@/lib/formatters';
import { useCurrency } from '@/context/CurrencyContext';
import { useLanguage } from '@/context/LanguageContext';
import { convertCurrency, getCurrencySymbol } from '@/lib/currency';

interface PortfolioPerformanceChartProps {
    username: string;
    totalValueEUR: number;
    onPeriodChange?: (period: string) => void;
    selectedBenchmarks: string[];
    isPortfolioVisible: boolean;
    onToggleBenchmark: (id: string) => void;
    onTogglePortfolio: () => void;
    controlsPosition?: 'top' | 'bottom';
    onSaveBenchmarks?: (benchmarks: string[]) => void;
}

type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

interface ChartDataPoint {
    date: string;
    portfolio: number;
    [key: string]: number | string;
}

export function PortfolioPerformanceChart({
    username,
    totalValueEUR,
    onPeriodChange,
    selectedBenchmarks,
    isPortfolioVisible,
    onToggleBenchmark,
    onTogglePortfolio,
    controlsPosition = 'top',
    onSaveBenchmarks
}: PortfolioPerformanceChartProps) {
    const { currency } = useCurrency();
    const { t } = useLanguage();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1Y');
    const [showCompareMenu, setShowCompareMenu] = useState(false);
    const [portfolioData, setPortfolioData] = useState<BenchmarkDataPoint[]>([]);
    const [benchmarkData, setBenchmarkData] = useState<Record<string, BenchmarkDataPoint[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isChartHovered, setIsChartHovered] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    const [portfolioStats, setPortfolioStats] = useState({
        value: totalValueEUR,
        change: 0,
        changePercent: 0,
    });

    // 1. Fetch Portfolio History
    useEffect(() => {
        const fetchPortfolioData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/portfolio/${username}/history?period=${selectedPeriod}`);
                if (response.ok) {
                    const data = await response.json();
                    setPortfolioData(data.data || []);

                    if (data.data && data.data.length > 0) {
                        const latest = data.data[data.data.length - 1];
                        const first = data.data[0];
                        const changePercent = ((latest.value - first.value) / first.value) * 100;
                        const change = totalValueEUR * (changePercent / 100);

                        setPortfolioStats({
                            value: totalValueEUR,
                            change,
                            changePercent,
                        });
                    } else {
                        // Fallback
                        setPortfolioStats({ value: totalValueEUR, change: 0, changePercent: 0 });
                    }
                }
            } catch (error) {
                console.error('Error fetching portfolio data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPortfolioData();
    }, [username, selectedPeriod, totalValueEUR]);

    // Currency Conversion
    const targetCurrency = currency === 'ORG' ? 'EUR' : currency;
    const currencySym = getCurrencySymbol(targetCurrency);
    const displayedTotalValue = convertCurrency(totalValueEUR, 'EUR', targetCurrency);
    // Note: portfolioStats.change is calculated in EUR above.
    const displayedChange = convertCurrency(portfolioStats.change, 'EUR', targetCurrency);
    const isPositive = portfolioStats.changePercent >= 0;

    // Helper to format currency
    const fmtCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    };

    // 2. Fetch Benchmark History
    useEffect(() => {
        const fetchBenchmarks = async () => {
            const newBenchmarkData: Record<string, BenchmarkDataPoint[]> = {};
            // Parallel fetch for speed
            await Promise.all(selectedBenchmarks.map(async (benchmarkId) => {
                const benchmark = BENCHMARK_ASSETS.find(b => b.id === benchmarkId);
                if (benchmark) {
                    try {
                        const data = await fetchBenchmarkData(benchmark.symbol, selectedPeriod);
                        newBenchmarkData[benchmarkId] = normalizeToPercentage(data);
                    } catch (e) { console.error(e); }
                }
            }));
            setBenchmarkData(newBenchmarkData);
        };

        if (selectedBenchmarks.length > 0) {
            fetchBenchmarks();
        } else {
            setBenchmarkData({});
        }
    }, [selectedBenchmarks, selectedPeriod]);

    // --- Zoom State ---
    const [zoomState, setZoomState] = useState<{ left: number; right: number }>({ left: 0, right: 100 });
    const [refAreaLeft, setRefAreaLeft] = useState("");
    const [refAreaRight, setRefAreaRight] = useState("");

    // Reset zoom on period change
    useEffect(() => {
        setZoomState({ left: 0, right: 100 });
    }, [selectedPeriod]);

    // 3. Prepare Chart Data (Merging & Normalizing)
    const chartData = useMemo(() => {
        const normalizedPortfolio = normalizeToPercentage(portfolioData);
        const dataMap = new Map<string, ChartDataPoint>();

        // Init with Portfolio Data
        normalizedPortfolio.forEach(point => {
            // Normalize Date to YYYY-MM-DD to ensure matching
            const dateKey = new Date(point.date).toISOString().split('T')[0];
            dataMap.set(dateKey, {
                date: point.date, // Keep full date for tooltip
                portfolio: point.change || 0,
            });
        });

        // Merge Benchmarks
        Object.entries(benchmarkData).forEach(([benchmarkId, data]) => {
            if (!data || data.length === 0) return;
            data.forEach(point => {
                const dateKey = new Date(point.date).toISOString().split('T')[0];
                const existing = dataMap.get(dateKey);
                if (existing) {
                    existing[benchmarkId] = point.change || 0;
                } else {
                    dataMap.set(dateKey, {
                        date: point.date,
                        portfolio: 0, // Assume 0 change if missing
                        [benchmarkId]: point.change || 0
                    });
                }
            });
        });

        return Array.from(dataMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }, [portfolioData, benchmarkData]);

    // --- Zoom Logic ---
    const zoomedData = useMemo(() => {
        if (chartData.length === 0) return [];
        const start = Math.floor((zoomState.left / 100) * chartData.length);
        const end = Math.ceil((zoomState.right / 100) * chartData.length);
        // Ensure at least 2 points
        const safeEnd = Math.max(start + 2, end);
        return chartData.slice(start, safeEnd);
    }, [chartData, zoomState]);

    const handleWheel = (e: any) => {
        // Prevent default only if hovering chart
        if (!isChartHovered) return;

        // e.deltaY > 0 -> Scroll Down -> Zoom Out
        // e.deltaY < 0 -> Scroll Up -> Zoom In
        const ZOOM_SPEED = 2; // Speed factor
        const delta = e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED;

        setZoomState(prev => {
            let newLeft = prev.left - delta;
            let newRight = prev.right + delta;

            // Constrain boundaries (0-100)
            if (newLeft < 0) newLeft = 0;
            if (newRight > 100) newRight = 100;

            // Constrain minimum zoom (e.g. 5% spread)
            if (newRight - newLeft < 5) return prev;

            return { left: newLeft, right: newRight };
        });
    };

    // --- Smart Y-Axis Domain ---
    const yDomain = useMemo(() => {
        if (zoomedData.length === 0) return ['auto', 'auto'];

        let min = Infinity;
        let max = -Infinity;

        zoomedData.forEach(p => {
            // Check Portfolio
            if (isPortfolioVisible) {
                const val = Number(p.portfolio);
                if (val < min) min = val;
                if (val > max) max = val;
            }
            // Check Benchmarks
            selectedBenchmarks.forEach(id => {
                const val = Number(p[id]);
                if (!isNaN(val)) {
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
            });
        });

        if (min === Infinity || max === -Infinity) return ['auto', 'auto'];

        // Add 10% padding
        const range = max - min;
        const padding = range * 0.1 || 1; // Default 1% padding if flat
        return [min - padding, max + padding];
    }, [zoomedData, isPortfolioVisible, selectedBenchmarks]);


    const handlePeriodChange = (period: TimePeriod) => {
        setSelectedPeriod(period);
        onPeriodChange?.(period);
    };

    // --- Formatters ---
    const formatXAxis = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "";

        if (selectedPeriod === '1D') return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (selectedPeriod === '1W' || selectedPeriod === '1M') return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        if (selectedPeriod === 'YTD' || selectedPeriod === '1Y') return date.toLocaleDateString('en-US', { month: 'short' });
        return date.getFullYear().toString();
    };

    const formatTooltipDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
        return `${day} ${month} ${year} - ${weekday}`;
    };

    // Shared Tooltip Content Renderer
    const renderTooltipContent = (payload: any[], label: string) => {
        // Sort payload by value (highest to lowest)
        const sortedPayload = [...payload].sort((a, b) => {
            const valA = Number(a.value) || 0;
            const valB = Number(b.value) || 0;
            return valB - valA; // Descending order (highest first)
        });

        return (
            <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                color: '#fff',
                minWidth: '200px'
            }}>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 500 }}>
                    {formatTooltipDate(label)}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {sortedPayload.map((entry: any) => {
                        const isPortfolio = entry.dataKey === 'portfolio';
                        const benchmark = BENCHMARK_ASSETS.find(b => b.id === entry.dataKey);
                        const name = isPortfolio ? 'My Portfolio' : (benchmark?.name || entry.dataKey);
                        const color = isPortfolio ? '#6366f1' : (benchmark?.color || entry.color);
                        const val = Number(entry.value);

                        return (
                            <div key={entry.dataKey || entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color }} />
                                    <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{name}</span>
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: val >= 0 ? '#4ade80' : '#f87171' }}>
                                    {val > 0 ? '+' : ''}{val.toFixed(2)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        return renderTooltipContent(payload, label);
    };

    const ChartControls = () => (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: controlsPosition === 'bottom' ? 'space-between' : 'flex-end', width: '100%' }}>
            {/* Compare Button */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowCompareMenu(!showCompareMenu)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.4rem 0.8rem',
                        background: selectedBenchmarks.length > 0 ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: selectedBenchmarks.length > 0 ? '#6366f1' : 'var(--text-secondary)',
                        fontSize: '0.8rem', fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <LineChartIcon size={16} />
                    <span>{t('benchmarks')}</span>
                    {selectedBenchmarks.length > 0 && (
                        <span style={{ background: '#6366f1', color: '#fff', fontSize: '0.65rem', padding: '0px 5px', borderRadius: '10px' }}>
                            {selectedBenchmarks.length}
                        </span>
                    )}
                </button>

                {/* Dropdown - Check position */}
                {showCompareMenu && (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowCompareMenu(false)} />
                        <div style={{
                            position: 'absolute', [controlsPosition === 'bottom' ? 'bottom' : 'top']: '120%', [controlsPosition === 'bottom' ? 'left' : 'right']: 0, width: '170px',
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '8px', zIndex: 50,
                            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)',
                            maxHeight: '300px', overflowY: 'auto'
                        }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>
                                Overlay
                            </div>
                            <div onClick={onTogglePortfolio} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderRadius: '6px', cursor: 'pointer', background: isPortfolioVisible ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>My Portfolio</span>
                                {isPortfolioVisible ? <Eye size={16} color="#6366f1" /> : <EyeOff size={16} color="#94a3b8" />}
                            </div>
                            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                            {BENCHMARK_ASSETS.map(b => (
                                <div key={b.id} onClick={() => onToggleBenchmark(b.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderRadius: '6px', cursor: 'pointer', background: selectedBenchmarks.includes(b.id) ? 'var(--bg-secondary)' : 'transparent' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.color }} />
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{b.name}</span>
                                    </div>
                                    {selectedBenchmarks.includes(b.id) && <Eye size={16} color={b.color} />}
                                </div>
                            ))}
                            {onSaveBenchmarks && (
                                <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '8px' }}>
                                    <button
                                        onClick={() => {
                                            onSaveBenchmarks(selectedBenchmarks);
                                            setShowCompareMenu(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            background: 'var(--accent)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Save Current Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Time Period Selector */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'var(--bg-secondary)',
                padding: '0.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border)'
            }}>
                {(['1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as TimePeriod[]).map((period) => (
                    <button
                        key={period}
                        onClick={() => handlePeriodChange(period)}
                        style={{
                            padding: '0.3rem 0.6rem',
                            background: selectedPeriod === period ? 'var(--surface)' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: selectedPeriod === period ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontSize: '0.75rem',
                            fontWeight: selectedPeriod === period ? 700 : 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: selectedPeriod === period ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        }}
                    >
                        {period}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="neo-card" style={{ padding: '1.5rem', height: controlsPosition === 'bottom' ? '420px' : '350px', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                    <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {currencySym}{fmtCurrency(displayedTotalValue)}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', transform: 'translateY(-2px)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                            {portfolioData.length > 0 ? (isPositive ? '▲' : '▼') : ''}{Math.abs(portfolioStats.changePercent).toFixed(2)}%
                        </span>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--danger)', opacity: 0.8 }}>
                            {portfolioData.length > 0 ? (isPositive ? '+' : '-') : ''}{currencySym}{fmtCurrency(Math.abs(displayedChange))}
                        </span>
                    </div>
                </div>

                {controlsPosition === 'top' && <ChartControls />}
            </div>

            {/* Chart Area */}
            <div
                style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative' }}
                onMouseEnter={() => setIsChartHovered(true)}
                onMouseLeave={() => setIsChartHovered(false)}
                onWheel={handleWheel}
            >
                {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={zoomedData}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="var(--text-secondary)" opacity={0.2} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatXAxis}
                                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={30}
                                dy={10}
                            />
                            <YAxis
                                tickFormatter={(val) => `${val}%`}
                                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                                domain={yDomain}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Benchmarks (Lines) */}
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
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                        connectNulls
                                        animationDuration={800}
                                        strokeOpacity={0.8}
                                    />
                                );
                            })}

                            {/* Portfolio (Area) - Render last to be on top */}
                            {isPortfolioVisible && (
                                <Area
                                    type="monotone"
                                    dataKey="portfolio"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorPortfolio)"
                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#6366f1' }}
                                    connectNulls
                                    animationDuration={1000}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {controlsPosition === 'bottom' && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <ChartControls />
                </div>
            )}
        </div>
    );
}
