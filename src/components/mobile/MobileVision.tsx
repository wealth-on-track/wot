"use client";

import { useState, useRef, useEffect } from "react";
import { Maximize2, RotateCw } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";

interface MobileVisionProps {
    totalValueEUR: number;
}

export function MobileVision({ totalValueEUR }: MobileVisionProps) {
    const [years, setYears] = useState(0);
    const [isLandscape, setIsLandscape] = useState(false);

    // Check orientation
    useEffect(() => {
        const handleResize = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Init
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Projection Logic (Standard 8% market return)
    const rate = 0.08;
    const projectedValue = totalValueEUR * Math.pow(1 + rate, years);

    // Generate simple chart data points (0 to 40 years)
    const maxYears = 40;
    const points = [];
    for (let i = 0; i <= maxYears; i++) {
        points.push(totalValueEUR * Math.pow(1 + rate, i));
    }

    // SVG Path Generation
    const width = 100;
    const height = 50;
    const maxVal = points[points.length - 1];

    // Normalize points to SVG coordinates
    const pathData = points.map((val, i) => {
        const x = (i / maxYears) * width;
        const y = height - ((val / maxVal) * height);
        return `${x},${y}`;
    }).join(' ');

    const fillPath = `0,${height} ${pathData} ${width},${height}`;

    // Active Point on Chart based on slider
    const activeX = (years / maxYears) * width;
    const activeY = height - ((projectedValue / maxVal) * height);

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: isLandscape ? 'center' : 'flex-start',
            padding: isLandscape ? '2rem' : '1.5rem',
            background: 'var(--bg-main)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Header (Hidden in Landscape if needed, or styled differently) */}
            <div style={{
                textAlign: 'center',
                marginBottom: isLandscape ? '1rem' : '3rem',
                zIndex: 10,
                transition: 'all 0.3s'
            }}>
                <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: '0.5rem'
                }}>
                    PROJECTED WEALTH ({years} YRS)
                </div>
                <div style={{
                    fontSize: isLandscape ? '3rem' : '3.5rem',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                    letterSpacing: '-2px',
                    textShadow: '0 0 40px rgba(99, 102, 241, 0.3)'
                }}>
                    €{projectedValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </div>
                <div style={{
                    marginTop: '0.5rem',
                    color: 'var(--success)',
                    fontWeight: 700,
                    fontSize: '1rem',
                    opacity: years === 0 ? 0 : 1,
                    transition: 'opacity 0.3s'
                }}>
                    +€{(projectedValue - totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })} Profit
                </div>
            </div>

            {/* Chart Area */}
            <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                maxHeight: isLandscape ? '80vh' : '40vh',
                marginBottom: '2rem'
            }}>
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Gradient Defs */}
                    <defs>
                        <linearGradient id="visionWait" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area Fill */}
                    <polygon points={fillPath} fill="url(#visionWait)" />

                    {/* Line Stroke */}
                    <polyline points={pathData} fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeLinecap="round" />

                    {/* Active Indicator Line */}
                    <line x1={activeX} y1={0} x2={activeX} y2={height} stroke="rgba(255,255,255,0.2)" strokeWidth="0.2" strokeDasharray="1,1" />

                    {/* Active Dot */}
                    <circle cx={activeX} cy={activeY} r="1.5" fill="#fff" stroke="var(--accent)" strokeWidth="0.5">
                        <animate attributeName="r" values="1.5;2;1.5" dur="2s" repeatCount="indefinite" />
                    </circle>
                </svg>

                {/* Landscape Rotate Hint (Only in Portrait) */}
                {!isLandscape && (
                    <div style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        opacity: 0.3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem'
                    }}>
                        <RotateCw size={14} /> Full Screen
                    </div>
                )}
            </div>

            {/* Slider Control */}
            <div style={{
                position: 'relative',
                zIndex: 20,
                padding: '0 1rem',
                opacity: isLandscape ? 0 : 1, // Hide slider in landscape if we want 'pure' view, or keep it. User said "Fullscreen chart".
                pointerEvents: isLandscape ? 'none' : 'auto',
                transition: 'opacity 0.3s'
            }}>
                <input
                    type="range"
                    min="0" max={maxYears}
                    step="1"
                    value={years}
                    onChange={(e) => setYears(parseInt(e.target.value))}
                    style={{
                        width: '100%',
                        height: '40px', // Hit area
                        appearance: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        touchAction: 'none' // Prevent scroll while sliding
                    }}
                />

                {/* Custom Track Visuals would go here if not using default range styling, keeping standard for reliability first */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span style={{ color: 'var(--accent)' }}>TODAY</span>
                    <span>10Y</span>
                    <span>20Y</span>
                    <span>30Y</span>
                    <span>40Y</span>
                </div>
            </div>

            {/* Custom Styling for Range Input needed for "Premium" feel */}
            <style jsx>{`
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 24px;
                    width: 24px;
                    border-radius: 50%;
                    background: #fff;
                    cursor: pointer;
                    margin-top: -10px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 4px;
                    cursor: pointer;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                }
            `}</style>
        </div>
    );
}
