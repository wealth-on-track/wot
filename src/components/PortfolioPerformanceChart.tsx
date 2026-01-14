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
import { LineChart as LineChartIcon, Eye, EyeOff, ChevronDown } from 'lucide-react';
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
    defaultRange?: string;
    showHistoryList?: boolean; // New prop
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
    onSaveBenchmarks,
    defaultRange,
    showHistoryList = false
}: PortfolioPerformanceChartProps) {
    const { currency } = useCurrency();
    const { t } = useLanguage();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>((defaultRange as TimePeriod) || '1Y');

    // Update range if preference changes
    useEffect(() => {
        if (defaultRange) setSelectedPeriod(defaultRange as TimePeriod);
    }, [defaultRange]);

    const [showCompareMenu, setShowCompareMenu] = useState(false);
    const [showTimeMenu, setShowTimeMenu] = useState(false); // Added state for Time Menu
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
                        // Ensure data is sorted by date (ascending) before normalization
                        const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        newBenchmarkData[benchmarkId] = normalizeToPercentage(sortedData);
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

    const BenchmarkSelector = () => (
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
                        position: 'absolute', top: '115%', left: 0, width: '170px',
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

                    </div>
                </>
            )}
        </div>
    );

    const TimePeriodSelector = () => (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowTimeMenu(!showTimeMenu)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.8rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem', fontWeight: 600,
                    cursor: 'pointer',
                    minWidth: '80px',
                    justifyContent: 'space-between'
                }}
            >
                <span>{selectedPeriod}</span>
                <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {showTimeMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowTimeMenu(false)} />
                    <div style={{
                        position: 'absolute', top: '115%', right: 0, width: '100px',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: '8px', padding: '4px', zIndex: 50,
                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)'
                    }}>
                        {(['1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as const).map((period) => (
                            <div
                                key={period}
                                onClick={() => {
                                    handlePeriodChange(period);
                                    setShowTimeMenu(false);
                                }}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: selectedPeriod === period ? 700 : 500,
                                    color: selectedPeriod === period ? 'var(--accent)' : 'var(--text-primary)',
                                    background: selectedPeriod === period ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    marginBottom: '2px'
                                }}
                            >
                                {period}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );

    // --- MOBILE LAYOUT (Separate Cards) ---
    if (controlsPosition === 'bottom') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: 'auto', width: '100%' }}>

                {/* 1. Amount Card */}
                <div className="neo-card" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {currencySym}{fmtCurrency(displayedTotalValue)}
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                                {portfolioData.length > 0 ? (isPositive ? '▲' : '▼') : ''}{Math.abs(portfolioStats.changePercent).toFixed(2)}%
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--danger)', opacity: 0.9 }}>
                                ({isPositive ? '+' : '-'}{currencySym}{fmtCurrency(Math.abs(displayedChange))})
                            </span>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {selectedPeriod} Return
                        </span>
                    </div>
                </div>

                {/* 2. Chart Card */}
                <div className="neo-card" style={{ padding: '0.5rem 0.5rem 0.2rem 0.5rem', display: 'flex', flexDirection: 'column' }}>
                    {/* Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', padding: '0 0.5rem', zIndex: 10 }}>
                        <BenchmarkSelector />
                        <TimePeriodSelector />
                    </div>
                    {/* Chart */}
                    <div style={{ width: '100%', height: '195px', position: 'relative' }}
                        onMouseEnter={() => setIsChartHovered(true)}
                        onMouseLeave={() => setIsChartHovered(false)}
                        onWheel={handleWheel}
                    >
                        {isMounted && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={zoomedData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPortfolioMobile" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="var(--text-secondary)" opacity={0.15} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatXAxis}
                                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                        axisLine={false}
                                        tickLine={false}
                                        minTickGap={30}
                                        dy={10}
                                        height={32}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => `${Math.round(val)}%`}
                                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                        width={40}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    {selectedBenchmarks.map(id => {
                                        const b = BENCHMARK_ASSETS.find(a => a.id === id);
                                        return <Line key={id} type="monotone" dataKey={id} stroke={b?.color} strokeWidth={2} dot={false} connectNulls animationDuration={800} />;
                                    })}
                                    {isPortfolioVisible && (
                                        <Area type="monotone" dataKey="portfolio" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPortfolioMobile)" connectNulls animationDuration={1000} />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* 3. Summary Card */}
                {zoomedData.length > 0 && (
                    <div className="neo-card" style={{ padding: '0.5rem 0.8rem' }}>
                        {(() => {
                            const lastPoint = zoomedData[zoomedData.length - 1];
                            const comparisons = [];
                            if (isPortfolioVisible) comparisons.push({ name: 'My Portfolio', value: Number(lastPoint.portfolio), color: '#6366f1' });
                            selectedBenchmarks.forEach(id => {
                                const val = Number(lastPoint[id]);
                                if (!isNaN(val)) comparisons.push({ name: BENCHMARK_ASSETS.find(a => a.id === id)?.name || id, value: val, color: BENCHMARK_ASSETS.find(a => a.id === id)?.color || '#ccc' });
                            });
                            comparisons.sort((a, b) => b.value - a.value);

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.2rem' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Performance ({selectedPeriod})</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-muted)' }}>{formatTooltipDate(lastPoint.date)}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                        {comparisons.map((item) => (
                                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed var(--border)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                                                </div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: item.value >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                    {item.value > 0 ? '+' : ''}{item.value.toFixed(2)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        );
    }

    // --- DESKTOP LAYOUT ---
    return (
        <div className="neo-card" style={{ padding: '1.25rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
            {/* Header: Single Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                {/* Left: Amount & Returns */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
                        {currencySym}{fmtCurrency(displayedTotalValue)}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {selectedPeriod} Return:
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                            {portfolioData.length > 0 ? (isPositive ? '▲' : '▼') : ''}{Math.abs(portfolioStats.changePercent).toFixed(2)}%
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--danger)', opacity: 0.8 }}>
                            ({isPositive ? '+' : '-'}{currencySym}{fmtCurrency(Math.abs(displayedChange))})
                        </span>
                    </div>
                </div>

                {/* Right: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <BenchmarkSelector />
                    <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        {(['1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => handlePeriodChange(period)}
                                style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    fontWeight: selectedPeriod === period ? 700 : 600,
                                    color: selectedPeriod === period ? '#fff' : 'var(--text-muted)',
                                    background: selectedPeriod === period ? 'var(--accent)' : 'transparent',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Chart Area */}
            {/* IMPORTANT: Fixed height to ensure visibility when parent is height: auto */}
            <div
                style={{ width: '100%', height: '220px', position: 'relative', marginBottom: '1rem' }}
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
                                domain={['auto', 'auto']}
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

            {/* 4. Performance Summary Card (Bottom) */}
            {showHistoryList && zoomedData.length > 0 && (
                <div style={{
                    marginTop: 'auto',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {(() => {
                        const lastPoint = zoomedData[zoomedData.length - 1];
                        const dateLabel = formatTooltipDate(lastPoint.date);

                        // Prepare comparison data
                        const comparisons = [];

                        // 1. Portfolio
                        if (isPortfolioVisible) {
                            comparisons.push({
                                name: 'My Portfolio',
                                value: Number(lastPoint.portfolio),
                                color: '#6366f1'
                            });
                        }

                        // 2. Benchmarks
                        selectedBenchmarks.forEach(id => {
                            const val = Number(lastPoint[id]);
                            if (!isNaN(val)) {
                                const b = BENCHMARK_ASSETS.find(a => a.id === id);
                                comparisons.push({
                                    name: b?.name || id,
                                    value: val,
                                    color: b?.color || '#ccc'
                                });
                            }
                        });

                        // Sort descending by value
                        comparisons.sort((a, b) => b.value - a.value);

                        return (
                            <>
                                <h3 style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    marginBottom: '1rem',
                                    borderBottom: '1px solid var(--border)',
                                    paddingBottom: '0.75rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span>Current Standing</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{dateLabel}</span>
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    {comparisons.map((item) => (
                                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color }} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.95rem',
                                                fontWeight: 800,
                                                color: item.value >= 0 ? 'var(--success)' : 'var(--danger)',
                                                fontVariantNumeric: 'tabular-nums'
                                            }}>
                                                {item.value > 0 ? '+' : ''}{item.value.toFixed(2)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
