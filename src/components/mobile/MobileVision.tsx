"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Maximize2, RotateCw, Edit3, TrendingUp, TrendingDown, Target } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";

interface MobileVisionProps {
    totalValueEUR: number;
}

// Helper for haptics
const vibrate = (ms: number = 10) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(ms);
    }
};

function CountUp({ value }: { value: number }) {
    const count = useMotionValue(value);
    const rounded = useTransform(count, latest => Math.round(latest));
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
        return controls.stop;
    }, [value]);

    useEffect(() => {
        const unsubscribe = rounded.on("change", v => setDisplayValue(v));
        return unsubscribe;
    }, [rounded]);

    return (
        <span>€{displayValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</span>
    );
}

export function MobileVision({ totalValueEUR }: MobileVisionProps) {
    const [sliderStep, setSliderStep] = useState(2); // Default to 10Y (index 2)
    const [monthlyAdd, setMonthlyAdd] = useState(1000);
    const [scenario, setScenario] = useState<'BEAR' | 'EXPECTED' | 'BULL'>('EXPECTED');
    const [customRate, setCustomRate] = useState<number | null>(null); // For custom override
    const [isLandscape, setIsLandscape] = useState(false);

    // Interactive Chart State
    const chartRef = useRef<HTMLDivElement>(null);
    const [scrubIndex, setScrubIndex] = useState<number | null>(null);

    // Discrete Years
    const yearSteps = [1, 5, 10, 20, 30];
    const years = yearSteps[sliderStep];

    // Check orientation
    useEffect(() => {
        const handleResize = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Init
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Projection Logic
    const getRate = () => {
        if (customRate !== null) return customRate / 100;
        switch (scenario) {
            case 'BEAR': return 0.04;
            case 'EXPECTED': return 0.08;
            case 'BULL': return 0.12;
            default: return 0.08;
        }
    };
    const rate = getRate();
    const monthlyRate = rate / 12; // Simple monthly

    const calculateFV = (y: number) => {
        // Compound interest with monthly contributions
        // FV = P * (1+r)^n + PMT * [ ((1+r)^n - 1) / r ]
        const months = y * 12;
        const fvBase = totalValueEUR * Math.pow(1 + monthlyRate, months);
        const fvContrib = monthlyAdd * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
        return fvBase + fvContrib;
    };

    const projectedValue = calculateFV(years);
    const profit = projectedValue - totalValueEUR;

    // Inflation adjusted purchasing power (assuming 3% inflation)
    const inflationRate = 0.03;
    const purchasingPower = projectedValue / Math.pow(1 + inflationRate, years);

    // Generate chart points (0 to max 30 years)
    const maxYears = 30;
    const points = useMemo(() => {
        const pts = [];
        for (let i = 0; i <= maxYears; i++) {
            pts.push(calculateFV(i));
        }
        return pts;
    }, [totalValueEUR, monthlyAdd, rate]); // Memoize heavy calc if needed, though simple math is fast

    // Milestones detection
    const milestones = [100000, 250000, 500000, 1000000, 2500000, 5000000];
    const milestonePoints = useMemo(() => {
        return milestones.map(m => {
            // Find roughly when we cross this milestone
            const index = points.findIndex(p => p >= m);
            if (index !== -1) return { value: m, year: index };
            return null;
        }).filter(Boolean) as { value: number, year: number }[];
    }, [points]);


    // SVG Rendering Config
    const width = 100;
    const height = 50;
    const maxVal = points[points.length - 1];

    // Path Generation
    const getPointCoords = (i: number, val: number) => {
        const x = (i / maxYears) * width;
        // Scale to 70% height to leave room for tooltips/padding
        const y = height - ((val / maxVal) * height * 0.7) - 10;
        return { x, y };
    };

    const pathData = points.map((val, i) => {
        const { x, y } = getPointCoords(i, val);
        return `${x},${y}`;
    }).join(' ');

    const fillPath = `0,${height} ${pathData} ${width},${height}`;

    // Active Point (Slider or Scrub)
    const activeIndex = scrubIndex !== null ? scrubIndex : years;
    const activeValue = points[activeIndex];
    const { x: activeX, y: activeY } = getPointCoords(activeIndex, activeValue);

    // Interaction Handlers
    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        handleTouchMove(e);
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

        let x = clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width)); // Clamp

        const percentage = x / rect.width;
        let index = Math.round(percentage * maxYears);
        index = Math.max(0, Math.min(index, maxYears)); // Hard clamp 0..30
        setScrubIndex(index);
    };

    const handleTouchEnd = () => {
        setScrubIndex(null);
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-main)',
            position: 'relative',
            overflowY: 'auto',
            paddingBottom: '80px' // Space for floating button
        }}>
            {/* Header: "Rich" Design */}
            <div style={{
                textAlign: 'center',
                padding: '16px 20px',
                background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-main) 100%)',
                borderBottom: '1px solid var(--border)',
                marginBottom: '12px'
            }}>
                <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    marginBottom: '4px',
                    opacity: 0.8
                }}>
                    Wealth Projection
                </div>

                {/* Main Number with CountUp */}
                <div style={{
                    fontSize: '3rem',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                    letterSpacing: '-2px',
                    marginBottom: '4px'
                }}>
                    <CountUp value={scrubIndex !== null ? activeValue : projectedValue} />
                </div>

                {/* Profit & Info */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                        color: '#10b981', // Neon Green
                        fontWeight: 800,
                        fontSize: '1rem',
                        textShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
                    }}>
                        +{((scrubIndex !== null ? activeValue : projectedValue) - totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })} Profit
                    </div>


                </div>
            </div>

            {/* Content Container */}
            <div style={{ padding: '0 20px' }}>

                {/* Interactive "Oracle" Chart */}
                <div
                    ref={chartRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleTouchStart}
                    onMouseMove={(e) => e.buttons === 1 && handleTouchMove(e)}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                    style={{
                        position: 'relative',
                        height: isLandscape ? '50vh' : '200px',
                        marginBottom: '20px',
                        cursor: 'ew-resize',
                        userSelect: 'none',
                        touchAction: 'none',
                        overflow: 'hidden' // Force contain
                    }}
                >
                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                        <defs>
                            <linearGradient id="visionFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                            </linearGradient>
                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Grid Lines */}
                        {[0, 10, 20, 30].map(y => {
                            const gx = (y / maxYears) * width;
                            return (
                                <line
                                    key={y}
                                    x1={gx} y1={0} x2={gx} y2={height}
                                    stroke="var(--border)" strokeWidth="0.1" strokeDasharray="2,2"
                                />
                            );
                        })}

                        {/* Chart Paths */}
                        <polygon points={fillPath} fill="url(#visionFill)" />
                        <polyline
                            points={pathData}
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="0.8"
                            strokeLinecap="round"
                            filter="url(#glow)"
                        />

                        {/* Milestones Dots */}
                        {/* Milestones Dots - Interactive */}
                        {milestonePoints.map((m, i) => {
                            const { x, y } = getPointCoords(m.year, m.value);
                            const isClose = scrubIndex !== null && Math.abs(scrubIndex - m.year) < 1; // Highlight if close
                            return (
                                <g key={i}>
                                    <circle
                                        cx={x} cy={y}
                                        r={isClose ? 2.5 : 0.8}
                                        fill={isClose ? "#10b981" : "var(--bg-main)"}
                                        stroke={isClose ? "#fff" : "var(--text-muted)"}
                                        strokeWidth={isClose ? 0.5 : 0.3}
                                        style={{ transition: 'all 0.2s ease' }}
                                    />
                                </g>
                            );
                        })}

                        {/* Active Line Indicator */}
                        <line x1={activeX} y1={0} x2={activeX} y2={height} stroke="var(--text-secondary)" strokeWidth="0.2" strokeDasharray="1,1" />

                        {/* Glowing Tip/Active Dot */}
                        <circle cx={activeX} cy={activeY} r="2" fill="#fff" stroke="var(--accent)" strokeWidth="0.5" filter="url(#glow)" />

                        {scrubIndex !== null && (
                            <foreignObject x="0" y="0" width="0" height="0" /> // Placeholder to keep React happy if needed, or just remove
                        )}
                    </svg>

                    {/* HTML Overlay Tooltip - Outside SVG for sharpness */}
                    {scrubIndex !== null && (
                        <div style={{
                            position: 'absolute',
                            left: `${activeX}%`, // activeX is 0-100 in SVG space which matches % here
                            top: `${(activeY / height) * 100}%`,
                            transform: activeY < 20 ? 'translate(-50%, 15px)' : 'translate(-50%, -130%)',
                            background: '#1f2937', // Dark gray/Black
                            color: '#ffffff',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8, marginBottom: '2px' }}>
                                Year {activeIndex}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                                €{activeValue.toLocaleString('de-DE', { maximumFractionDigits: 1, notation: "compact" })}
                            </div>

                            {/* Tiny Triangle Arrow */}
                            <div style={{
                                position: 'absolute',
                                left: '50%',
                                bottom: activeY < 20 ? '100%' : '-5px',
                                top: activeY < 20 ? '-5px' : 'auto',
                                transform: activeY < 20 ? 'translateX(-50%) rotate(180deg)' : 'translateX(-50%)',
                                width: '0',
                                height: '0',
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                borderTop: '5px solid #1f2937'
                            }} />
                        </div>
                    )}
                </div>

                {/* Control Panel: Horizontal Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '8px', marginBottom: '16px' }}>

                    {/* Monthly Add Card */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        padding: '8px 12px', // Compact padding
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                            Monthly
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>€</span>
                            <input
                                type="text"
                                value={monthlyAdd.toLocaleString('de-DE')}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                                    setMonthlyAdd(Number(raw));
                                }}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '1.1rem',
                                    fontWeight: 800,
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    padding: 0
                                }}
                            />
                        </div>
                    </div>

                    {/* Scenario Selector Card */}
                    {/* Scenario Selector Card */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        padding: '4px', // Minimal padding
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'stretch',
                        gap: '4px'
                    }}>
                        {[
                            { id: 'BEAR', icon: TrendingDown, color: '#ef4444', label: 'Bear', rate: '4%' },
                            { id: 'EXPECTED', icon: Target, color: 'var(--accent)', label: 'Exp.', rate: '8%' },
                            { id: 'BULL', icon: TrendingUp, color: '#10b981', label: 'Bull', rate: '12%' }
                        ].map(s => {
                            const isSelected = scenario === s.id;
                            const Icon = s.icon;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        vibrate(5);
                                        setScenario(s.id as any);
                                        setCustomRate(null);
                                    }}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: isSelected ? 'var(--bg-main)' : 'transparent',
                                        color: isSelected ? s.color : 'var(--text-muted)',
                                        boxShadow: isSelected ? `0 2px 8px rgba(0,0,0,0.05), inset 0 0 0 1px ${s.color}` : 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        padding: '6px 2px',
                                        gap: '4px'
                                    }}
                                >
                                    <Icon size={16} strokeWidth={2.5} style={{ opacity: isSelected ? 1 : 0.5 }} />
                                    {isSelected && (
                                        <div style={{ fontSize: '0.6rem', fontWeight: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                                            <span>{s.label}</span>
                                            <span style={{ fontSize: '0.55rem', opacity: 0.8 }}>{s.rate}</span>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Haptic Slider (Timeframe) */}
                <div style={{ position: 'relative', padding: '0 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Timeframe</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--accent)' }}>{years} Years</span>
                    </div>

                    <input
                        type="range"
                        min="0" max={yearSteps.length - 1}
                        step="1"
                        value={sliderStep}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val !== sliderStep) vibrate(10);
                            setSliderStep(val);
                        }}
                        style={{
                            width: '100%',
                            height: '6px',
                            appearance: 'none',
                            // Dynamic Linear Gradient to show progress
                            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(sliderStep / (yearSteps.length - 1)) * 100}%, var(--border) ${(sliderStep / (yearSteps.length - 1)) * 100}%, var(--border) 100%)`,
                            borderRadius: '3px',
                            cursor: 'pointer',
                        }}
                    />

                    {/* Custom Tick Labels */}
                    {/* Custom Tick Labels */}
                    <div style={{
                        position: 'relative',
                        marginTop: '8px',
                        height: '30px',
                        width: '100%'
                    }}>
                        {yearSteps.map((y, i) => {
                            const p = i / (yearSteps.length - 1);
                            // Calculate position to match slider thumb center (thumb width 24px)
                            const offset = 12 - (p * 24);

                            return (
                                <div
                                    key={y}
                                    onClick={() => { setSliderStep(i); vibrate(5); }}
                                    style={{
                                        position: 'absolute',
                                        left: `calc(${p * 100}% + ${offset}px)`,
                                        transform: 'translateX(-50%)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '2px',
                                        cursor: 'pointer',
                                        opacity: i === sliderStep ? 1 : 0.5,
                                        top: 0,
                                        transition: 'opacity 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: '1px',
                                        height: '6px',
                                        background: 'var(--text-primary)'
                                    }} />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>{y}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            <style jsx>{`
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 24px;
                    width: 24px;
                    border-radius: 50%;
                    background: #fff;
                    border: 4px solid var(--accent);
                    cursor: pointer;
                    margin-top: -9px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    transition: transform 0.1s;
                }
                input[type=range]:active::-webkit-slider-thumb {
                    transform: scale(1.2);
                }
            `}</style>
        </div>
    );
}
