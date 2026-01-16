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
import { LineChart as LineChartIcon, Eye, EyeOff, ChevronDown, TrendingDown, Activity, TrendingUp, Settings, Edit2 } from 'lucide-react';
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
    showHistoryList?: boolean;
    showPortfolioValue?: boolean; // New prop to control portfolio value display
    showPeriodSelector?: boolean; // New prop to control period selector display
}

type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

interface ChartDataPoint {
    date: string;
    portfolio?: number;
    projectedValue?: number; // For Vision Mode
    impactValue?: number; // For Vision Impact Mode (_actualValue + impact growth)
    _impactActualValue?: number; // Raw value for tooltip
    [key: string]: number | string | undefined;
}

const SCENARIOS = {
    bear: { label: 'Bear', rate: 0.04, color: '#f87171' },
    expected: { label: 'Expected', rate: 0.10, color: '#6366f1' },
    bull: { label: 'Bull', rate: 0.20, color: '#10b981' }
};

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
    showHistoryList = false,
    showPortfolioValue = true,
    showPeriodSelector = true
}: PortfolioPerformanceChartProps) {
    const { currency } = useCurrency();
    const { t } = useLanguage();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>((defaultRange as TimePeriod) || '1Y');

    // Vision Mode State
    const [isVisionMode, setIsVisionMode] = useState(false);
    const [visionYears, setVisionYears] = useState(10); // Default 10 years
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [activeScenario, setActiveScenario] = useState<keyof typeof SCENARIOS | 'custom'>('expected');
    const [customRate, setCustomRate] = useState(15); // Default custom rate 15%
    const [isCustomInputActive, setIsCustomInputActive] = useState(false);
    const [tempCustomRate, setTempCustomRate] = useState('15');

    // UI State for Period Dropdown
    const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);

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

    // --- Impact State ---
    const [simulatedImpact, setSimulatedImpact] = useState<number>(0);
    const [tempImpact, setTempImpact] = useState<string>('0');
    const [isImpactActive, setIsImpactActive] = useState(false);
    const [isImpactPanelOpen, setIsImpactPanelOpen] = useState(false);

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
        // Base Data Map
        const dataMap = new Map<string, ChartDataPoint>();

        // Init with Portfolio Data (History)
        normalizedPortfolio.forEach(point => {
            const dateKey = new Date(point.date).toISOString().split('T')[0];
            dataMap.set(dateKey, {
                date: point.date,
                portfolio: point.change || 0,
            });
        });

        // If Vision Mode: Calculate & Append Projections
        if (isVisionMode && portfolioData.length > 0) {
            const lastPoint = portfolioData[portfolioData.length - 1]; // Use raw raw value for projection base, percent for chart?
            // Actually, we are plotting PERCENTAGE change in the main chart.
            // For Vision, users want to see VALUE usually, but switching Y-Axis context is tricky.
            // Let's project percentages based on CAGR for visual continuity, 
            // BUT display VALUES in Tooltip/Overlay.

            // Current cumulative return %
            const currentReturnPct = normalizedPortfolio.length > 0 ? (normalizedPortfolio[normalizedPortfolio.length - 1].change || 0) : 0;

            // We need a stable base date
            const startDate = new Date(lastPoint.date);

            // Generate monthly points
            let cumulativeValue = totalValueEUR; // Start with current actual value
            let totalInvested = totalValueEUR; // Approximation

            let monthlyRate = 0;
            if (activeScenario === 'custom') {
                monthlyRate = (customRate / 100) / 12;
            } else {
                monthlyRate = SCENARIOS[activeScenario].rate / 12;
            }

            // ---------------------------
            // IMPACT CALCULATION (Ghost Line)
            // ---------------------------
            let cumulativeImpactValue = totalValueEUR + simulatedImpact;

            for (let m = 1; m <= visionYears * 12; m++) {
                // Future Date
                const fDate = new Date(startDate);
                fDate.setMonth(startDate.getMonth() + m);
                const dateKey = fDate.toISOString().split('T')[0];

                // 1. Calculate Standard Projection (Main Line)
                cumulativeValue = (cumulativeValue * (1 + monthlyRate)) + monthlyContribution;
                totalInvested += monthlyContribution;

                // 2. Calculate Impact Projection (Ghost Line)
                // Assumption: The 'Impact' is a one-time lump sum added NOW. 
                // So it compounds along with the rest of the portfolio.
                cumulativeImpactValue = (cumulativeImpactValue * (1 + monthlyRate)) + monthlyContribution;

                // Growth since "Today" (Base vs Impact)
                const growthFactorSinceToday = cumulativeValue / totalValueEUR;
                const pctChangeSinceToday = (growthFactorSinceToday - 1) * 100;

                // Impact Growth Factor (Relative to ORIGINAL base to maintain scale?)
                // If we plot % change, we should plot relative to the SAME base (totalValueEUR) 
                // so the ghost line appears higher.
                const impactGrowthFactor = cumulativeImpactValue / totalValueEUR;
                const impactPctChange = (impactGrowthFactor - 1) * 100;

                // Total Chart % = Current History % + Future Growth %
                const projectedPct = currentReturnPct + pctChangeSinceToday;
                const impactPct = currentReturnPct + impactPctChange;

                dataMap.set(dateKey, {
                    date: dateKey,
                    portfolio: undefined, // Hide "History" line
                    projectedValue: projectedPct,
                    _actualValue: cumulativeValue,
                    impactValue: simulatedImpact !== 0 ? impactPct : undefined,
                    _impactActualValue: cumulativeImpactValue
                });
            }
        } else {
            // Merge Benchmarks (Only in History Mode to avoid noise)
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
                            portfolio: 0,
                            [benchmarkId]: point.change || 0
                        });
                    }
                });
            });
        }

        return Array.from(dataMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }, [portfolioData, benchmarkData, isVisionMode, visionYears, monthlyContribution, activeScenario, totalValueEUR, customRate, simulatedImpact]);

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
    const formatXAxis = (tick: string) => {
        const date = new Date(tick);
        if (isVisionMode) {
            return date.getFullYear().toString();
        }
        switch (selectedPeriod) {
            case '1D': return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            case '1W': return date.toLocaleDateString([], { weekday: 'short' });
            case '1M': return date.getDate().toString();
            case 'YTD': case '1Y': return date.toLocaleDateString([], { month: 'short' });
            case 'ALL': return date.getFullYear().toString();
            default: return date.toLocaleDateString();
        }
    };

    // --- HEADER ANIMATION STYLE ---
    const headerStyle: React.CSSProperties = isVisionMode && chartData.length > 0 ? {
        fontSize: '2rem',
        fontWeight: 800,
        background: 'linear-gradient(to right, #10b981, #34d399)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        margin: 0,
        filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))',
        animation: 'pulse-green 3s infinite ease-in-out'
    } : {
        fontSize: '1.8rem',
        fontWeight: 800,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        margin: 0
    };


    const formatTooltipDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        // Check if future
        if (date > new Date()) {
            return `${month} ${year} (Vision)`;
        }
        const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
        return `${day} ${month} ${year} - ${weekday}`;
    };

    // Shared Tooltip Content Renderer
    const renderTooltipContent = (payload: any[], label: string) => {
        // --- VISION MODE TOOLTIP ---
        if (isVisionMode) {
            const dataPoint = payload[0]?.payload;
            const projectedVal = dataPoint?._actualValue || 0;
            const impactVal = dataPoint?._impactActualValue || 0;
            const impactDiff = impactVal - projectedVal;

            // Lifestyle / Freedom Calc
            // Assumptions: 
            // 1 Day Freedom (Basic Living Cost) = ~50 EUR (1500/mo)
            // 1 Year Rent = 12,000 EUR
            // 1 Lambo = 300,000 EUR
            const freedomDays = Math.floor(projectedVal / 50);
            const rentYears = (projectedVal / 12000).toFixed(1);

            return (
                <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    color: '#fff',
                    minWidth: '220px'
                }}>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                        {formatTooltipDate(label)}
                    </p>

                    {/* Main Projection */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Estimated Value</span>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>
                            {currencySym}{fmtCurrency(projectedVal)}
                        </span>
                    </div>

                    {/* Impact / Ghost Line */}
                    {simulatedImpact !== 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#fbbf24' }}>With Impact</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24' }}>
                                {currencySym}{fmtCurrency(impactVal)}
                            </span>
                        </div>
                    )}

                    {/* Impact Delta */}
                    {simulatedImpact !== 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', background: 'rgba(251, 191, 36, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>Effect</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fbbf24' }}>
                                +{currencySym}{fmtCurrency(impactDiff)}
                            </span>
                        </div>
                    )}

                    {/* Lifestyle Box */}
                    <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                            Lifestyle Power
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                                <span>🏠</span> <strong>{rentYears} Years</strong> of Rent
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                                <span>🏄</span> <strong>{freedomDays} Days</strong> of Freedom
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // --- STANDARD HISTORY MODE TOOLTIP ---
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

    if (controlsPosition === 'bottom') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: 'auto', width: '100%' }}>

                {/* 1. Amount Card - Only show if showPortfolioValue is true */}
                {showPortfolioValue && (
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
                )}

                {/* 2. Chart Card */}
                <div className="neo-card" style={{ padding: '0.5rem 0.5rem 0.2rem 0.5rem', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 20, overflow: 'visible' }}>
                    {/* Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', padding: '0 0.5rem', zIndex: 10 }}>
                        <BenchmarkSelector />
                        {showPeriodSelector && <TimePeriodSelector />}
                    </div>
                    {/* Chart */}
                    <div style={{ width: '100%', height: '160px', position: 'relative' }} // Reduced height
                        onMouseEnter={() => setIsChartHovered(true)}
                        onMouseLeave={() => setIsChartHovered(false)}
                        onWheel={handleWheel}
                    >
                        {isLoading && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(2px)', zIndex: 20
                            }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Loading...</span>
                            </div>
                        )}
                        {!isLoading && portfolioData.length === 0 && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(1px)', zIndex: 20
                            }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No data available</span>
                            </div>
                        )}
                        {isMounted && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={zoomedData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPortfolioMobile" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="var(--text-secondary)" opacity={0.1} /> {/* Lighter grid */}
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatXAxis}
                                        tick={{ fontSize: 10, fill: '#9ca3af' }} // More gray
                                        axisLine={false}
                                        tickLine={false}
                                        minTickGap={30}
                                        dy={10}
                                        height={32}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => `${Math.round(val)}%`}
                                        tick={{ fontSize: 10, fill: '#9ca3af' }} // More gray
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                        width={40}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} /> {/* Better cursor for scrubbing */}
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
                    <div className="neo-card" style={{ padding: '0.8rem' }}>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', paddingBottom: '0.2rem', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Performance ({selectedPeriod})</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-muted)' }}>{formatTooltipDate(lastPoint.date)}</span>
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '8px 16px' // Row gap 8px, Col gap 16px
                                    }}>
                                        {comparisons.map((item) => (
                                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
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
        <div className="neo-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <style>{`
                @keyframes pulse-green {
                    0%, 100% { filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.3)); transform: scale(1); }
                    50% { filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.5)); transform: scale(1.02); }
                }
            `}</style>
            {/* Header: Single Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                {/* Left: Amount & Returns */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div>
                        {isVisionMode && chartData.length > 0 ? (
                            // Vision Mode: Show Projected Value
                            (() => {
                                const lastPt = chartData[chartData.length - 1];
                                const projectedVal = lastPt._actualValue || totalValueEUR;
                                return (
                                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0, textShadow: '0 0 20px rgba(99, 102, 241, 0.3)' }}>
                                        {currencySym}{fmtCurrency(Number(projectedVal))}
                                    </h2>
                                );
                            })()
                        ) : (
                            // Normal Mode
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
                                {currencySym}{fmtCurrency(displayedTotalValue)}
                            </h2>
                        )}
                        {isVisionMode && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                                Estimated Value in {new Date().getFullYear() + visionYears}
                            </span>
                        )}
                    </div>

                    {!isVisionMode && (
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
                    )}
                </div>

                {/* Right: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>

                    {/* Vision Toggle */}
                    <button
                        onClick={() => setIsVisionMode(!isVisionMode)}
                        style={{
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            border: isVisionMode ? '1px solid #7c3aed' : '1px solid rgba(139, 92, 246, 0.3)',
                            background: isVisionMode ? '#8b5cf6' : 'rgba(139, 92, 246, 0.08)',
                            color: isVisionMode ? '#fff' : '#8b5cf6',
                            fontSize: '0.8rem', fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: isVisionMode ? '0 0 15px rgba(139, 92, 246, 0.5)' : 'none',
                            textShadow: isVisionMode ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
                        }}
                    >
                        {isVisionMode ? <Eye size={16} /> : <EyeOff size={16} />}
                        <span>WOT VISION</span>
                    </button>

                    {/* Impact Toggle (only in Vision Mode) */}
                    {isVisionMode && (
                        <button
                            onClick={() => setIsImpactPanelOpen(!isImpactPanelOpen)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '8px',
                                border: isImpactPanelOpen ? '1px solid #fbbf24' : '1px solid rgba(251, 191, 36, 0.3)',
                                background: isImpactPanelOpen ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.05)',
                                color: '#fbbf24',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Settings size={14} />
                            <span>WOT BOOST</span>
                        </button>
                    )}

                    {!isVisionMode && <BenchmarkSelector />}

                    {/* Compact Time Period Dropdown - Only show if showPeriodSelector is true */}
                    {!isVisionMode && showPeriodSelector && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    minWidth: '70px', justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {selectedPeriod}
                                <ChevronDown size={14} style={{ transform: isPeriodMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                            </button>

                            {/* Dropdown Menu */}
                            {isPeriodMenuOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '110%',
                                    right: 0,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    padding: '4px',
                                    display: 'flex', flexDirection: 'column', gap: '2px',
                                    zIndex: 50,
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                    minWidth: '80px',
                                    animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                    backdropFilter: 'blur(10px)'
                                }}>
                                    {(['1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as const).map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => {
                                                handlePeriodChange(period);
                                                setIsPeriodMenuOpen(false);
                                            }}
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                fontSize: '0.75rem',
                                                fontWeight: selectedPeriod === period ? 700 : 500,
                                                color: selectedPeriod === period ? '#fff' : 'var(--text-primary)',
                                                background: selectedPeriod === period ? 'var(--accent)' : 'transparent',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.1s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (selectedPeriod !== period) e.currentTarget.style.background = 'var(--surface-hover)';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedPeriod !== period) e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
                {isLoading && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(2px)', zIndex: 20
                    }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Loading...</span>
                    </div>
                )}
                {!isLoading && portfolioData.length === 0 && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(1px)', zIndex: 20
                    }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No data available</span>
                    </div>
                )}
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
                                <linearGradient id="colorVision" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
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

                            {/* Portfolio (Area) - Render last to be on top? No, usually Lines on top of Area */}
                            {isPortfolioVisible && (
                                <>
                                    <Area
                                        type="monotone"
                                        dataKey={isVisionMode ? "projectedValue" : "portfolio"}
                                        stroke={isVisionMode ? "#10b981" : "#6366f1"}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill={isVisionMode ? "url(#colorVision)" : "url(#colorPortfolio)"}
                                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: isVisionMode ? '#10b981' : '#6366f1' }}
                                        connectNulls
                                        animationDuration={1000}
                                    />
                                    {/* Vision Mode: Ghost Line (Impact) */}
                                    {isVisionMode && simulatedImpact !== 0 && (
                                        <Line
                                            type="monotone"
                                            dataKey="impactValue"
                                            stroke="#fbbf24"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            activeDot={{ r: 5, strokeWidth: 0, fill: '#fbbf24' }}
                                            animationDuration={1000}
                                            style={{ filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.5))' }}
                                        />
                                    )}
                                </>
                            )}

                            {/* Vision Projection (Dashed/Glowing) */}
                            {isVisionMode && (
                                <Area
                                    type="monotone"
                                    dataKey="projectedValue"
                                    stroke="var(--accent)"
                                    strokeWidth={3}
                                    strokeDasharray="5 5"
                                    fillOpacity={1}
                                    fill="url(#colorVision)"
                                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2, fill: '#10b981' }}
                                    connectNulls
                                    animationDuration={1500}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* 4. Performance Summary Card (Bottom) */}
            {showHistoryList && zoomedData.length > 0 && !isVisionMode && (
                <div style={{
                    marginTop: '0.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {(() => {
                        const lastPoint = zoomedData[zoomedData.length - 1];

                        // Dynamic period label
                        const periodLabel = selectedPeriod === '1D' ? 'Today' :
                            selectedPeriod === 'ALL' ? 'All Time' :
                                selectedPeriod;

                        // Prepare comparison data
                        const comparisons: any[] = [];

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
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Performance</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{periodLabel} Return</span>
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

            {/* 5. Vision Controls (Overlay at Bottom) */}
            {isVisionMode && (
                <div style={{
                    marginTop: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    padding: '1rem',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1.4fr', gap: '1.5rem', alignItems: 'start' }}>

                        {/* 1. Time Horizon Slider */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', height: '1rem', display: 'flex', alignItems: 'center' }}>
                                Time Horizon: <span style={{ color: 'var(--text-primary)', marginLeft: '4px' }}>{visionYears} Years</span>
                            </label>
                            {/* Control Container for Alignment */}
                            <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="range"
                                    min="1" max="30"
                                    value={visionYears}
                                    onChange={(e) => setVisionYears(Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        accentColor: 'var(--accent)',
                                        height: '6px',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '-8px' }}>
                                <span>1Y</span>
                                <span>30Y</span>
                            </div>
                        </div>

                        {/* 2. Monthly Contribution */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', height: '1rem', display: 'flex', alignItems: 'center' }}>
                                Monthly Add ({currencySym})
                            </label>
                            {/* Control Container for Alignment */}
                            <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="number"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                    style={{
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '6px',
                                        padding: '0 0.5rem',
                                        height: '100%',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        width: '100%'
                                    }}
                                />
                            </div>
                        </div>

                        {/* 3. Market Scenario */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '1rem' }}>
                                <span>Market Scenario</span>
                                {activeScenario === 'custom' ? (
                                    <span
                                        style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                                        onClick={() => {
                                            if (!isCustomInputActive) {
                                                setTempCustomRate(customRate.toString());
                                                setIsCustomInputActive(true);
                                            }
                                        }}
                                    >
                                        ({isCustomInputActive ? (
                                            <input
                                                type="text"
                                                value={tempCustomRate}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    // Allow only numbers
                                                    if (/^\d*$/.test(val)) {
                                                        setTempCustomRate(val);
                                                        // Update chart immediately if value is valid
                                                        const num = Number(val);
                                                        if (!isNaN(num)) {
                                                            setCustomRate(num);
                                                        }
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const num = Number(tempCustomRate);
                                                        setCustomRate(isNaN(num) ? 0 : num);
                                                        setIsCustomInputActive(false);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    const num = Number(tempCustomRate);
                                                    setCustomRate(isNaN(num) ? 0 : num);
                                                    setIsCustomInputActive(false);
                                                }}
                                                // Focus the input when mounted
                                                ref={(input) => { if (input) input.focus(); }}
                                                style={{
                                                    width: '28px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    borderBottom: '1px dashed #8b5cf6',
                                                    color: '#8b5cf6',
                                                    textAlign: 'center',
                                                    fontWeight: 700,
                                                    padding: 0,
                                                    fontSize: '0.75rem',
                                                    outline: 'none',
                                                    appearance: 'textfield',
                                                    MozAppearance: 'textfield'
                                                }}
                                            />
                                        ) : (
                                            <span>{customRate}</span>
                                        )}%)
                                    </span>
                                ) : (
                                    <span style={{ color: activeScenario === 'bear' ? '#f87171' : activeScenario === 'bull' ? '#10b981' : '#6366f1' }}>
                                        ({(SCENARIOS[activeScenario as keyof typeof SCENARIOS]?.rate * 100)}%)
                                    </span>
                                )}
                            </label>
                            {/* Control Container for Alignment */}
                            <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', width: '100%', height: '100%' }}>
                                    {/* Preset Scenarios */}
                                    {(Object.entries(SCENARIOS) as [keyof typeof SCENARIOS, any][]).map(([key, data]) => {
                                        const isActive = activeScenario === key;
                                        let Icon = Activity;
                                        if (key === 'bear') Icon = TrendingDown;
                                        if (key === 'bull') Icon = TrendingUp;

                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setActiveScenario(key as any)}
                                                style={{
                                                    flex: 1,
                                                    padding: '0',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    borderRadius: '6px',
                                                    border: isActive ? 'none' : '1px solid var(--border)',
                                                    cursor: 'pointer',
                                                    background: isActive ? data.color : 'var(--surface)',
                                                    color: isActive ? '#fff' : 'var(--text-muted)',
                                                    transition: 'all 0.2s',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                                                    minWidth: '0',
                                                    height: '100%'
                                                }}
                                                title={`${data.label} (${data.rate * 100}%)`}
                                            >
                                                <Icon size={14} />
                                                <span style={{ fontSize: '0.65rem' }}>{data.label}</span>
                                            </button>
                                        );
                                    })}

                                    {/* Custom Button */}
                                    <button
                                        onClick={() => setActiveScenario('custom')}
                                        style={{
                                            flex: 1,
                                            padding: '0',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            borderRadius: '6px',
                                            border: activeScenario === 'custom' ? 'none' : '1px solid var(--border)',
                                            cursor: 'pointer',
                                            background: activeScenario === 'custom' ? '#8b5cf6' : 'var(--surface)',
                                            color: activeScenario === 'custom' ? '#fff' : 'var(--text-muted)',
                                            transition: 'all 0.2s',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                                            minWidth: '0',
                                            height: '100%'
                                        }}
                                        title="Custom Rate"
                                    >
                                        <Edit2 size={14} />
                                        <span style={{ fontSize: '0.65rem' }}>Custom</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* 4. WOT Impact (Ghost Line) - Collapsible */}
                    {isImpactPanelOpen && (
                        <div style={{
                            marginTop: '1rem',
                            paddingTop: '1rem',
                            borderTop: '1px dashed rgba(251, 191, 36, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            background: 'rgba(251, 191, 36, 0.03)',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(251, 191, 36, 0.15)'
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <div style={{ width: '4px', height: '16px', borderRadius: '2px', background: '#fbbf24' }}></div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    WOT Magic Line
                                </label>
                            </div>

                            {/* Description */}
                            <p style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                lineHeight: 1.5,
                                margin: 0,
                                fontWeight: 500
                            }}>
                                Discover the future power of every penny you don't spend today. Enter an amount and watch the golden line reveal the extra momentum it adds to your portfolio. Start building your future wealth today!
                            </p>

                            {/* Amount Input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <label style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    minWidth: '60px'
                                }}>
                                    Opportunity Cost
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                                    <span style={{ position: 'absolute', left: '0.75rem', fontSize: '0.85rem', color: '#fbbf24', fontWeight: 700 }}>{currencySym}</span>
                                    <input
                                        type="text"
                                        value={isImpactActive
                                            ? (tempImpact === '' ? '' : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(tempImpact) || 0))
                                            : simulatedImpact === 0 ? '' : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(simulatedImpact)}
                                        placeholder="50.000"
                                        onFocus={() => {
                                            setTempImpact('');
                                            setIsImpactActive(true);
                                        }}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setTempImpact(val);
                                            // Update immediately for instant chart update
                                            const num = parseFloat(val);
                                            setSimulatedImpact(isNaN(num) || val === '' ? 0 : num);
                                        }}
                                        onBlur={() => {
                                            const num = parseFloat(tempImpact);
                                            setSimulatedImpact(isNaN(num) || tempImpact === '' ? 0 : num);
                                            setIsImpactActive(false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const num = parseFloat(tempImpact);
                                                setSimulatedImpact(isNaN(num) || tempImpact === '' ? 0 : num);
                                                setIsImpactActive(false);
                                            }
                                        }}
                                        style={{
                                            background: 'rgba(251, 191, 36, 0.1)',
                                            border: '1px solid rgba(251, 191, 36, 0.4)',
                                            borderRadius: '6px',
                                            padding: '0.5rem 0.75rem 0.5rem 2rem',
                                            color: '#fbbf24',
                                            fontSize: '0.95rem',
                                            fontWeight: 700,
                                            width: '100%',
                                            outline: 'none',
                                            textAlign: 'left'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
