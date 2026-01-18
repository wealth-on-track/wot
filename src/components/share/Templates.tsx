import React from 'react';
import { Trophy, Globe, Zap, TrendingUp, Shield, Target, MapPin, Activity } from 'lucide-react';
import { formatValue } from './utils';

// --- Types ---
export interface ShareData {
    username?: string;
    totalValue?: number;
    currency?: string;
    // For Global/Sector/Currency
    distribution?: { name: string; value: number; color?: string; code?: string }[];
    // For Heavy Hitter
    favouriteAsset?: { name: string; symbol: string; changePercent: number; value: number; logoUrl?: string };
    // For Journey
    performance?: { date: string; value: number }[];
    // For Milestone
    goal?: { name: string; target: number; current: number; percent: number };
}

interface TemplateProps {
    data: ShareData;
    isMasked: boolean;
    showName: boolean;
    aspectRatio: 'story' | 'post'; // 9:16 or 1:1
}

// Fixed dimensions for render consistency
const DIMENSIONS = {
    story: { width: 400, height: 711 }, // Scaled down 1080x1920 ratio
    post: { width: 400, height: 400 }
};

// --- Helper Components ---
const Watermark = () => (
    <div style={{
        position: 'absolute', bottom: '20px', left: '0', right: '0',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
        opacity: 0.6
    }}>
        <div style={{ width: '16px', height: '16px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '4px' }} />
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>
            CREATED WITH WOT.MONEY
        </span>
    </div>
);

const UserBadge = ({ name, show }: { name?: string, show: boolean }) => {
    if (!show || !name) return null;
    return (
        <div style={{
            position: 'absolute', top: '24px', left: '24px',
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
            padding: '6px 12px', borderRadius: '20px',
            display: 'flex', alignItems: 'center', gap: '8px'
        }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                {name.charAt(0)}
            </div>
            <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600 }}>@{name}</span>
        </div>
    );
};

// --- Templates ---

// 1. The Global Strategist
export const GlobalStrategist: React.FC<TemplateProps> = ({ data, isMasked, showName, aspectRatio }) => {
    const { width, height } = DIMENSIONS[aspectRatio];
    const top3 = data.distribution?.slice(0, 3) || [];

    return (
        <div id="template-root" style={{
            width, height,
            background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#fff'
        }}>
            {/* Background Accent */}
            <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '300px', height: '300px', background: '#6366f1', opacity: 0.2, filter: 'blur(80px)', borderRadius: '50%' }} />

            <UserBadge name={data.username} show={showName} />

            <div style={{ padding: '40px', marginTop: '60px', flex: 1 }}>
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ background: 'rgba(99,102,241,0.2)', width: 'fit-content', padding: '8px 16px', borderRadius: '30px', marginBottom: '16px', border: '1px solid rgba(99,102,241,0.3)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Globe size={14} /> Global Strategist
                        </span>
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.1, marginBottom: '12px', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Limitless<br />Investor
                    </h1>
                    <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                        My capital is working across {data.distribution?.length || 0} different markets.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {top3.map((item, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '24px' }}>
                                    {/* Quick flag mapping fallback */}
                                    {item.code === 'US' ? '🇺🇸' : item.code === 'TR' ? '🇹🇷' : item.code === 'DE' ? '🇩🇪' : '🌍'}
                                </div>
                                <span style={{ fontWeight: 600 }}>{item.name}</span>
                            </div>
                            <span style={{ fontWeight: 800, color: '#818cf8' }}>
                                {isMasked ? '****' : formatValue(item.value, data.currency || 'EUR', isMasked)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <Watermark />
        </div>
    );
};

// 2. The Sector Master
export const SectorMaster: React.FC<TemplateProps> = ({ data, isMasked, showName, aspectRatio }) => {
    const { width, height } = DIMENSIONS[aspectRatio];
    const topSector = data.distribution?.[0];

    return (
        <div id="template-root" style={{
            width, height,
            background: 'linear-gradient(180deg, #111827 0%, #064e3b 100%)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#fff'
        }}>
            <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '400px', height: '400px', background: '#10b981', opacity: 0.15, filter: 'blur(100px)', borderRadius: '50%' }} />

            <UserBadge name={data.username} show={showName} />

            <div style={{ padding: '40px', marginTop: '60px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                    <div style={{ margin: '0 auto 20px', width: '80px', height: '80px', background: 'rgba(16,185,129,0.2)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <Zap size={40} color="#34d399" />
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
                        Future Focused
                    </h1>
                    <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                        Betting big on {topSector?.name || 'Innovation'}
                    </p>
                </div>

                <div style={{ display: 'flex', height: '200px', alignItems: 'flex-end', gap: '12px', justifyContent: 'center' }}>
                    {data.distribution?.slice(0, 4).map((item, i) => {
                        const maxVal = Math.max(...(data.distribution?.map(d => d.value) || [1]));
                        const heightPct = (item.value / maxVal) * 100;
                        return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <div style={{
                                    width: '100%', height: `${heightPct}%`,
                                    background: i === 0 ? '#34d399' : 'rgba(255,255,255,0.1)',
                                    borderRadius: '8px 8px 4px 4px',
                                    minHeight: '20px',
                                    transition: 'height 0.5s'
                                }} />
                                <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.name}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
            <Watermark />
        </div>
    );
};

// 3. The Currency Guard
export const CurrencyGuard: React.FC<TemplateProps> = ({ data, isMasked, showName, aspectRatio }) => {
    const { width, height } = DIMENSIONS[aspectRatio];

    return (
        <div id="template-root" style={{
            width, height,
            background: 'linear-gradient(135deg, #000000 0%, #1c1917 100%)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#fff'
        }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.1 }} />

            <UserBadge name={data.username} show={showName} />

            <div style={{ padding: '40px', marginTop: '40px', flex: 1 }}>
                <div style={{ borderLeft: '4px solid #f59e0b', paddingLeft: '20px', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f59e0b', margin: 0 }}>Hedged.</h1>
                    <p style={{ fontSize: '16px', color: '#a8a29e', margin: '4px 0 0 0' }}>Against Volatility.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {data.distribution?.map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>{item.name}</span>
                            <span style={{ fontSize: '18px', fontWeight: 400, color: '#d6d3d1' }}>
                                {isMasked ? '****' : formatValue(item.value, item.name, isMasked)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <Watermark />
        </div>
    );
};

// 4. The Heavy Hitter
export const HeavyHitter: React.FC<TemplateProps> = ({ data, isMasked, showName, aspectRatio }) => {
    const { width, height } = DIMENSIONS[aspectRatio];
    const asset = data.favouriteAsset;

    return (
        <div id="template-root" style={{
            width, height,
            background: 'linear-gradient(180deg, #4c1d95 0%, #2e1065 100%)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#fff', alignItems: 'center', justifyContent: 'center'
        }}>
            {/* Giant Logo Background */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                fontSize: '300px', fontWeight: 900, opacity: 0.05, whiteSpace: 'nowrap'
            }}>
                {asset?.symbol.slice(0, 3)}
            </div>

            <UserBadge name={data.username} show={showName} />

            <div style={{ textAlign: 'center', zIndex: 10, padding: '40px' }}>
                <div style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    background: '#fff', margin: '0 auto 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                    overflow: 'hidden'
                }}>
                    {asset?.logoUrl ? (
                        <img src={asset.logoUrl} alt={asset.symbol} style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                    ) : (
                        <span style={{ color: '#4c1d95', fontWeight: 900, fontSize: '24px' }}>{asset?.symbol.slice(0, 2)}</span>
                    )}
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#e9d5ff' }}>Star Performer</h2>
                <h1 style={{ fontSize: '42px', fontWeight: 900, margin: '0 0 16px 0', background: 'linear-gradient(to bottom, #fff, #d8b4fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {asset?.name}
                </h1>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '12px' }}>
                    <TrendingUp size={20} color="#34d399" />
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#34d399' }}>
                        +{asset?.changePercent.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '14px', color: '#e9d5ff' }}>last 30d</span>
                </div>
            </div>
            <Watermark />
        </div>
    );
};

// 5. The Journey
export const TheJourney: React.FC<TemplateProps> = ({ data, isMasked, showName, aspectRatio }) => {
    const { width, height } = DIMENSIONS[aspectRatio];
    // Simple SVG path generation for the chart
    const points = data.performance || [];
    let pathD = "";
    if (points.length > 1) {
        const minVal = Math.min(...points.map(p => p.value));
        const maxVal = Math.max(...points.map(p => p.value));
        const range = maxVal - minVal;

        pathD = points.map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            // Normalize y to be within middle 50% of screen
            const y = height - (((p.value - minVal) / range) * (height * 0.4) + (height * 0.3));
            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(" ");
    }

    const totalReturn = points.length > 0 ? ((points[points.length - 1].value - points[0].value) / points[0].value) * 100 : 0;

    return (
        <div id="template-root" style={{
            width, height,
            background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#fff'
        }}>
            <UserBadge name={data.username} show={showName} />

            <div style={{ padding: '40px', paddingTop: '80px', zIndex: 10 }}>
                <h1 style={{ fontSize: '48px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
                    {isMasked ? '+**%' : `+${totalReturn.toFixed(1)}%`}
                </h1>
                <p style={{ fontSize: '16px', color: '#93c5fd', fontWeight: 600, marginTop: '8px' }}>
                    All Time Growth
                </p>
            </div>

            {/* Chart Line */}
            <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
                <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d={`${pathD} L ${width},${height} L 0,${height} Z`} fill="url(#grad)" opacity="0.2" />
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0} />
                    </linearGradient>
                </defs>
            </svg>

            <Watermark />
        </div>
    );
};

// 6. The Milestone
export const TheMilestone: React.FC<TemplateProps> = ({ data, isMasked, showName, aspectRatio }) => {
    const { width, height } = DIMENSIONS[aspectRatio];
    const { name, target, current, percent } = data.goal || { name: 'Goal', target: 100, current: 0, percent: 0 };

    // Circular Progress Math
    const r = 80;
    const c = 2 * Math.PI * r;
    const offset = c - ((percent / 100) * c);

    return (
        <div id="template-root" style={{
            width, height,
            background: 'linear-gradient(180deg, #fff 0%, #f3f4f6 100%)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", sans-serif', color: '#111827',
            alignItems: 'center', justifyContent: 'center'
        }}>
            {/* Dark Mode Style Override essentially */}
            <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
            <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '300px', background: '#ec4899', opacity: 0.3, filter: 'blur(100px)' }} />

            <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                <h2 style={{ color: '#fbcfe8', fontWeight: 700, letterSpacing: '0.1em', fontSize: '14px', textTransform: 'uppercase', marginBottom: '30px' }}>
                    Target Locked
                </h2>

                <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="100" cy="100" r={r} stroke="#333" strokeWidth="12" fill="none" opacity="0.5" />
                        <circle cx="100" cy="100" r={r} stroke="#ec4899" strokeWidth="12" fill="none"
                            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                        />
                    </svg>
                    <div style={{ position: 'absolute', textAlign: 'center' }}>
                        <span style={{ fontSize: '42px', fontWeight: 900, color: '#fff' }}>{percent}%</span>
                    </div>
                </div>

                <h1 style={{ color: '#fff', marginTop: '30px', fontSize: '32px', fontWeight: 800 }}>{name}</h1>
                <p style={{ color: '#d1d5db', marginTop: '8px', fontSize: '16px' }}>
                    {isMasked ? '****' : formatValue(current, 'EUR', isMasked)} / {isMasked ? '****' : formatValue(target, 'EUR', isMasked)}
                </p>
            </div>

            <div style={{
                position: 'absolute', bottom: '20px', left: '0', right: '0',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                opacity: 0.6
            }}>
                <div style={{ width: '16px', height: '16px', background: 'linear-gradient(135deg, #ec4899, #db2777)', borderRadius: '4px' }} />
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>
                    CREATED WITH WOT.MONEY
                </span>
            </div>
        </div>
    );
};
