import React from 'react';
import { Trophy, Globe, Zap, TrendingUp, Shield, Target, MapPin, Activity, TrendingDown } from 'lucide-react';
import { formatValue } from './utils';

// --- Types ---
export interface ShareData {
    username?: string;
    totalValue?: number;
    currency?: string;
    // For Distribution template
    distribution?: { name: string; value: number; color?: string; code?: string }[];
    // For Performance template
    performance?: { date: string; value: number }[];
    benchmarkPerformance?: { date: string; value: number }[];
    // For Goal template
    goal?: {
        name: string;
        target: number;
        current: number;
        progress: number;
        percent: number;
    };
}

interface TemplateProps {
    data: ShareData;
    isMasked: boolean;
    showName: boolean;
    aspectRatio: 'story' | 'post';
}

interface DistributionTemplateProps extends TemplateProps {
    breakdownType: 'portfolio' | 'type' | 'exchange' | 'currency' | 'country' | 'sector' | 'platform' | 'positions';
}

interface PerformanceTemplateProps extends TemplateProps {
    timePeriod: '1M' | '3M' | '6M' | '1Y' | 'ALL';
    benchmark: string;
}

// Fixed dimensions for render consistency
const DIMENSIONS = {
    story: { width: 400, height: 711 },
    post: { width: 400, height: 400 }
};

// --- Helper Components ---
const Watermark = () => (
    <div style={{
        position: 'absolute', top: '20px', right: '20px',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px',
        opacity: 0.6
    }}>
        <span style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>
            CREATED WITH WOT.MONEY
        </span>
        <div style={{ width: '14px', height: '14px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '4px' }} />
    </div>
);

const UserBadge = ({ name, show }: { name?: string, show: boolean }) => {
    if (!show || !name) return null;
    return (
        <div style={{
            position: 'absolute', top: '24px', left: '24px',
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
            padding: '6px 12px', borderRadius: '20px',
            display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10
        }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
                {name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600 }}>@{name}</span>
        </div>
    );
};

// Get icon for breakdown type
const getBreakdownIcon = (type: string) => {
    const icons: Record<string, any> = {
        portfolio: Trophy,
        type: Zap,
        exchange: Globe,
        currency: Activity,
        country: MapPin,
        sector: Zap,
        platform: Globe,
        positions: Target
    };
    return icons[type] || Trophy;
};

// Get color scheme for breakdown type
const getColorScheme = (type: string) => {
    const schemes: Record<string, { primary: string, secondary: string, accent: string }> = {
        portfolio: { primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8' },
        type: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa' },
        exchange: { primary: '#ec4899', secondary: '#db2777', accent: '#f472b6' },
        currency: { primary: '#f59e0b', secondary: '#d97706', accent: '#fbbf24' },
        country: { primary: '#10b981', secondary: '#059669', accent: '#34d399' },
        sector: { primary: '#06b6d4', secondary: '#0891b2', accent: '#22d3ee' },
        platform: { primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8' },
        positions: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa' }
    };
    return schemes[type] || schemes.portfolio;
};

// --- Distribution Template ---
export const DistributionTemplate: React.FC<DistributionTemplateProps> = ({
    data, isMasked, showName, aspectRatio, breakdownType
}) => {
    const { width, height } = DIMENSIONS[aspectRatio];
    const items = data.distribution?.slice(0, 5) || [];
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const colors = getColorScheme(breakdownType);
    const Icon = getBreakdownIcon(breakdownType);

    // Calculate percentages
    const itemsWithPercent = items.map(item => ({
        ...item,
        percent: total > 0 ? (item.value / total) * 100 : 0
    }));

    return (
        <div id="template-root" style={{
            width, height,
            background: `linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)`,
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#fff'
        }}>
            {/* Background Accent */}
            <div style={{
                position: 'absolute', top: '-20%', right: '-20%',
                width: '300px', height: '300px',
                background: colors.primary, opacity: 0.2,
                filter: 'blur(80px)', borderRadius: '50%'
            }} />

            <UserBadge name={data.username} show={showName} />

            <div style={{ padding: '40px', marginTop: '60px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{
                        background: `rgba(99,102,241,0.2)`,
                        width: 'fit-content',
                        padding: '8px 16px',
                        borderRadius: '30px',
                        marginBottom: '16px',
                        border: `1px solid ${colors.accent}40`
                    }}>
                        <span style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: colors.accent,
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <Icon size={14} /> {breakdownType}
                        </span>
                    </div>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        marginBottom: '12px',
                        background: 'linear-gradient(to right, #fff, #94a3b8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        My Portfolio<br />Breakdown
                    </h1>
                    <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                        Diversified across {items.length} {breakdownType === 'positions' ? 'top positions' : `${breakdownType}s`}
                    </p>
                </div>

                {/* Distribution Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    {itemsWithPercent.map((item, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.05)',
                            padding: '14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Progress bar background */}
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${item.percent}%`,
                                background: `linear-gradient(90deg, ${colors.primary}40, ${colors.primary}20)`,
                                transition: 'width 0.5s ease-out'
                            }} />

                            {/* Content */}
                            <div style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: item.color || colors.accent
                                    }} />
                                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontWeight: 800, color: colors.accent, fontSize: '14px' }}>
                                        {isMasked ? '****' : formatValue(item.value, data.currency || 'EUR', isMasked)}
                                    </span>
                                    <span style={{
                                        fontSize: '12px',
                                        color: '#94a3b8',
                                        fontWeight: 600,
                                        minWidth: '45px',
                                        textAlign: 'right'
                                    }}>
                                        {item.percent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: `linear-gradient(135deg, ${colors.primary}30, ${colors.secondary}20)`,
                    borderRadius: '12px',
                    border: `1px solid ${colors.accent}40`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Total Value</span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                        {isMasked ? '****' : formatValue(data.totalValue || 0, data.currency || 'EUR', isMasked)}
                    </span>
                </div>
            </div>
            <Watermark />
        </div>
    );
};

// --- Performance Template ---
export const PerformanceTemplate: React.FC<PerformanceTemplateProps> = ({
    data, isMasked, showName, aspectRatio, timePeriod, benchmark
}) => {
    const { width, height } = DIMENSIONS[aspectRatio];

    // Get data based on time period
    const getDataForPeriod = (fullData: { date: string; value: number }[] | undefined) => {
        if (!fullData || fullData.length === 0) return [];

        const periodMap: Record<string, number> = {
            '1M': 30,
            '3M': 90,
            '6M': 180,
            '1Y': 365,
            'ALL': fullData.length
        };

        const days = periodMap[timePeriod] || 30;
        return fullData.slice(-days);
    };

    const portfolioData = getDataForPeriod(data.performance);
    const benchmarkData = getDataForPeriod(data.benchmarkPerformance);

    // Calculate returns
    const calculateReturn = (dataPoints: { date: string; value: number }[]) => {
        if (dataPoints.length < 2) return 0;
        const first = dataPoints[0].value;
        const last = dataPoints[dataPoints.length - 1].value;
        return ((last - first) / first) * 100;
    };

    const portfolioReturn = calculateReturn(portfolioData);
    const benchmarkReturn = calculateReturn(benchmarkData);
    const outperformance = portfolioReturn - benchmarkReturn;

    // Generate SVG path
    const generatePath = (points: { date: string; value: number }[], color: string) => {
        if (points.length < 2) return '';

        const minVal = Math.min(...points.map(p => p.value));
        const maxVal = Math.max(...points.map(p => p.value));
        const range = maxVal - minVal || 1;

        const chartHeight = height * 0.35;
        const chartTop = height * 0.45;

        const pathD = points.map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            const y = chartTop + chartHeight - (((p.value - minVal) / range) * chartHeight);
            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(' ');

        return pathD;
    };

    const portfolioPath = generatePath(portfolioData, '#6366f1');
    const benchmarkPath = generatePath(benchmarkData, '#94a3b8');

    return (
        <div id="template-root" style={{
            width, height,
            background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#fff'
        }}>
            <UserBadge name={data.username} show={showName} />

            {/* Header */}
            <div style={{ padding: '40px', paddingTop: '80px', zIndex: 10 }}>
                <div style={{
                    background: 'rgba(99,102,241,0.2)',
                    width: 'fit-content',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    marginBottom: '12px',
                    border: '1px solid rgba(99,102,241,0.3)'
                }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                        {timePeriod} Performance
                    </span>
                </div>

                <h1 style={{
                    fontSize: '48px',
                    fontWeight: 900,
                    margin: 0,
                    letterSpacing: '-0.02em',
                    color: portfolioReturn >= 0 ? '#34d399' : '#f87171'
                }}>
                    {isMasked ? '+**%' : `${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(1)}%`}
                </h1>
                <p style={{ fontSize: '14px', color: '#93c5fd', fontWeight: 600, marginTop: '4px' }}>
                    Portfolio Return
                </p>
            </div>

            {/* Chart */}
            <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
                {/* Benchmark line */}
                <path
                    d={benchmarkPath}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.5"
                />

                {/* Portfolio line */}
                <path
                    d={portfolioPath}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Gradient fill under portfolio line */}
                <path
                    d={`${portfolioPath} L ${width},${height} L 0,${height} Z`}
                    fill="url(#portfolioGrad)"
                    opacity="0.2"
                />

                <defs>
                    <linearGradient id="portfolioGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Comparison Stats */}
            <div style={{
                position: 'absolute',
                bottom: '60px',
                left: '40px',
                right: '40px',
                zIndex: 10
            }}>
                <div style={{
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                    }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>vs {benchmark}</span>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: outperformance >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'
                        }}>
                            {outperformance >= 0 ? <TrendingUp size={14} color="#34d399" /> : <TrendingDown size={14} color="#f87171" />}
                            <span style={{
                                fontSize: '14px',
                                fontWeight: 800,
                                color: outperformance >= 0 ? '#34d399' : '#f87171'
                            }}>
                                {outperformance >= 0 ? '+' : ''}{outperformance.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <div style={{ width: '12px', height: '3px', background: '#6366f1', borderRadius: '2px' }} />
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Portfolio</span>
                            </div>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                                {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(1)}%
                            </span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <div style={{ width: '12px', height: '2px', background: '#94a3b8', borderRadius: '2px', opacity: 0.5 }} />
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{benchmark}</span>
                            </div>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: '#94a3b8' }}>
                                {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <Watermark />
        </div>
    );
};
