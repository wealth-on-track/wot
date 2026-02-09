"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";

interface MobileVisionProps {
    totalValueEUR: number;
}

const vibrate = (ms: number = 10) => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        window.navigator.vibrate(ms);
    }
};

function CountUp({ value }: { value: number }) {
    const count = useMotionValue(value);
    const rounded = useTransform(count, latest => Math.round(latest));
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const controls = animate(count, value, { duration: 0.6, ease: "easeOut" });
        return controls.stop;
    }, [value, count]);

    useEffect(() => {
        const unsubscribe = rounded.on("change", v => setDisplayValue(v));
        return unsubscribe;
    }, [rounded]);

    return <span>€{displayValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</span>;
}

export function MobileVision({ totalValueEUR }: MobileVisionProps) {
    const [sliderStep, setSliderStep] = useState(2); // Default to 10Y
    const [monthlyAdd, setMonthlyAdd] = useState(1000);
    const [scenario, setScenario] = useState<'BEAR' | 'EXPECTED' | 'BULL'>('EXPECTED');

    const chartRef = useRef<HTMLDivElement>(null);
    const [scrubIndex, setScrubIndex] = useState<number | null>(null);

    const yearSteps = [1, 5, 10, 20, 30];
    const years = yearSteps[sliderStep];

    const getRate = () => {
        switch (scenario) {
            case 'BEAR': return 0.04;
            case 'EXPECTED': return 0.08;
            case 'BULL': return 0.12;
            default: return 0.08;
        }
    };

    const rate = getRate();
    const monthlyRate = rate / 12;

    const calculateFV = (y: number) => {
        const months = y * 12;
        const fvBase = totalValueEUR * Math.pow(1 + monthlyRate, months);
        const fvContrib = monthlyAdd * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
        return fvBase + fvContrib;
    };

    const projectedValue = calculateFV(years);

    const maxYears = 30;
    const points = useMemo(() => {
        const pts = [];
        for (let i = 0; i <= maxYears; i++) {
            pts.push(calculateFV(i));
        }
        return pts;
    }, [totalValueEUR, monthlyAdd, rate]);

    // SVG Config
    const width = 100;
    const height = 40;
    const maxVal = points[points.length - 1];

    const getPointCoords = (i: number, val: number) => {
        const x = (i / maxYears) * width;
        const y = height - ((val / maxVal) * height * 0.8) - 4;
        return { x, y };
    };

    const pathData = points.map((val, i) => {
        const { x, y } = getPointCoords(i, val);
        return `${x},${y}`;
    }).join(' ');

    const fillPath = `0,${height} ${pathData} ${width},${height}`;

    const activeIndex = scrubIndex !== null ? scrubIndex : years;
    const activeValue = points[activeIndex];
    const { x: activeX, y: activeY } = getPointCoords(activeIndex, activeValue);

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

        let x = clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));

        const percentage = x / rect.width;
        let index = Math.round(percentage * maxYears);
        index = Math.max(0, Math.min(index, maxYears));
        setScrubIndex(index);
    };

    const handleTouchEnd = () => setScrubIndex(null);

    const profit = (scrubIndex !== null ? activeValue : projectedValue) - totalValueEUR;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 140px)',
            overflow: 'hidden',
            padding: '0 16px'
        }}>
            {/* Header - Compact */}
            <div style={{
                textAlign: 'center',
                padding: '12px 0',
                marginBottom: '8px'
            }}>
                <div style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    marginBottom: '4px'
                }}>
                    {scrubIndex !== null ? `Year ${activeIndex}` : `${years} Year Projection`}
                </div>

                <div style={{
                    fontSize: '2.2rem',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                    letterSpacing: '-0.02em'
                }}>
                    <CountUp value={scrubIndex !== null ? activeValue : projectedValue} />
                </div>

                <div style={{
                    color: '#10b981',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    marginTop: '4px'
                }}>
                    +€{profit.toLocaleString('de-DE', { maximumFractionDigits: 0 })} profit
                </div>
            </div>

            {/* Interactive Chart */}
            <div
                ref={chartRef}
                onTouchStart={handleTouchMove}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchMove}
                onMouseMove={(e) => e.buttons === 1 && handleTouchMove(e)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                style={{
                    position: 'relative',
                    height: '120px',
                    marginBottom: '12px',
                    cursor: 'ew-resize',
                    userSelect: 'none',
                    touchAction: 'none'
                }}
            >
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                    <defs>
                        <linearGradient id="visionFillCompact" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[10, 20, 30].map(y => {
                        const gx = (y / maxYears) * width;
                        return (
                            <line key={y} x1={gx} y1={0} x2={gx} y2={height}
                                stroke="var(--border)" strokeWidth="0.15" strokeDasharray="1,1" />
                        );
                    })}

                    <polygon points={fillPath} fill="url(#visionFillCompact)" />
                    <polyline points={pathData} fill="none" stroke="var(--accent)" strokeWidth="0.6" strokeLinecap="round" />

                    {/* Active line */}
                    <line x1={activeX} y1={0} x2={activeX} y2={height} stroke="var(--text-muted)" strokeWidth="0.15" strokeDasharray="1,1" />
                    <circle cx={activeX} cy={activeY} r="1.5" fill="#fff" stroke="var(--accent)" strokeWidth="0.4" />
                </svg>

                {/* Tooltip */}
                {scrubIndex !== null && (
                    <div style={{
                        position: 'absolute',
                        left: `${activeX}%`,
                        top: '10px',
                        transform: 'translateX(-50%)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 10
                    }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            €{activeValue.toLocaleString('de-DE', { maximumFractionDigits: 0, notation: 'compact' as any })}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                {/* Monthly Input */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Monthly
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>€</span>
                        <input
                            type="text"
                            value={monthlyAdd.toLocaleString('de-DE')}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                                setMonthlyAdd(Number(raw) || 0);
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

                {/* Scenario */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '14px',
                    padding: '6px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    gap: '4px'
                }}>
                    {[
                        { id: 'BEAR', icon: TrendingDown, color: '#ef4444', rate: '4%' },
                        { id: 'EXPECTED', icon: Target, color: 'var(--accent)', rate: '8%' },
                        { id: 'BULL', icon: TrendingUp, color: '#10b981', rate: '12%' }
                    ].map(s => {
                        const isSelected = scenario === s.id;
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.id}
                                onClick={() => { vibrate(5); setScenario(s.id as any); }}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    padding: '8px 4px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: isSelected ? 'var(--bg-secondary)' : 'transparent',
                                    color: isSelected ? s.color : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Icon size={16} strokeWidth={2.5} />
                                {isSelected && (
                                    <span style={{ fontSize: '0.55rem', fontWeight: 700 }}>{s.rate}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Timeframe Slider */}
            <div style={{
                background: 'var(--surface)',
                borderRadius: '14px',
                padding: '14px 16px',
                border: '1px solid var(--border)',
                marginTop: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Timeframe
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent)' }}>
                        {years} Years
                    </span>
                </div>

                <input
                    type="range"
                    min="0"
                    max={yearSteps.length - 1}
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
                        background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(sliderStep / (yearSteps.length - 1)) * 100}%, var(--border) ${(sliderStep / (yearSteps.length - 1)) * 100}%, var(--border) 100%)`,
                        borderRadius: '3px',
                        cursor: 'pointer'
                    }}
                />

                {/* Year labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    {yearSteps.map((y, i) => (
                        <span
                            key={y}
                            onClick={() => { setSliderStep(i); vibrate(5); }}
                            style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: i === sliderStep ? 'var(--accent)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'color 0.2s'
                            }}
                        >
                            {y}Y
                        </span>
                    ))}
                </div>
            </div>

            <style jsx>{`
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    background: #fff;
                    border: 3px solid var(--accent);
                    cursor: pointer;
                    margin-top: -7px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                }
            `}</style>
        </div>
    );
}
