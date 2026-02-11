"use client";

import { useState, useMemo } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import type { AssetDisplay } from "@/lib/types";
import { ASSET_COLORS } from "@/lib/constants";
import { motion } from "framer-motion";

type AllocationView = "Type" | "Sector" | "Platform" | "Currency" | "Country";

interface MobileAllocationPieProps {
    assets: AssetDisplay[];
    totalValueEUR: number;
    isPrivacyMode: boolean;
    exchangeRates?: Record<string, number>;
}

const ALL_VIEWS: AllocationView[] = ["Type", "Sector", "Platform", "Currency", "Country"];

export function MobileAllocationPie({ assets, totalValueEUR, isPrivacyMode, exchangeRates }: MobileAllocationPieProps) {
    const { currency } = useCurrency();
    const [view, setView] = useState<AllocationView>("Type");
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    // Use server-provided exchange rates with fallbacks
    const rates: Record<string, number> = {
        EUR: 1,
        USD: exchangeRates?.['USD'] || 1.09,
        TRY: exchangeRates?.['TRY'] || 38.5,
        GBP: exchangeRates?.['GBP'] || 0.85
    };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", GBP: "£" };

    const convert = (amount: number) => {
        if (currency === 'ORG') return amount;
        return amount * (rates[currency] || 1);
    };
    const sym = currency === 'ORG' ? '€' : (symbols[currency] || "€");

    const vibrate = () => {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            window.navigator.vibrate(10);
        }
    };

    const handleViewChange = (newView: AllocationView) => {
        if (view !== newView) {
            vibrate();
            setView(newView);
            setActiveIndex(null);
        }
    };

    const handleSliceClick = (index: number) => {
        vibrate();
        setActiveIndex(prev => prev === index ? null : index);
    };

    // Group data
    const chartData = useMemo(() => {
        const data: { name: string; value: number; color?: string }[] = [];

        assets.forEach(asset => {
            let key = 'Other';
            if (view === "Type") key = asset.type;
            else if (view === "Sector") key = asset.sector || 'Unknown';
            else if (view === "Platform") key = asset.platform || 'Unknown';
            else if (view === "Currency") key = asset.currency || 'Unknown';
            else if (view === "Country") key = asset.country || 'Unknown';

            const existing = data.find(item => item.name === key);
            if (existing) {
                existing.value += asset.totalValueEUR;
            } else {
                data.push({
                    name: key,
                    value: asset.totalValueEUR,
                    color: view === "Type" ? (ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']) : undefined
                });
            }
        });

        return data.sort((a, b) => b.value - a.value).slice(0, 6); // Max 6 items
    }, [assets, view]);

    const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

    if (totalValueEUR === 0 || assets.length === 0) {
        return (
            <div style={{
                height: 'calc(100vh - 140px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
            }}>
                Add assets to see allocations
            </div>
        );
    }

    // Calculate segments
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90;

    const segments = chartData.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

        return { ...item, percentage, startAngle, endAngle, color, index };
    });

    // SVG Config - Smaller donut
    const size = 180;
    const center = size / 2;
    const radius = 70;
    const innerRadius = 50;

    const polarToCartesian = (angle: number, r: number) => {
        const angleInRadians = (angle * Math.PI) / 180;
        return {
            x: center + r * Math.cos(angleInRadians),
            y: center + r * Math.sin(angleInRadians)
        };
    };

    const createArc = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
        const start = polarToCartesian(startAngle, outerR);
        const end = polarToCartesian(endAngle, outerR);
        const innerStart = polarToCartesian(endAngle, innerR);
        const innerEnd = polarToCartesian(startAngle, innerR);
        const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

        return `
            M ${start.x} ${start.y}
            A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${end.x} ${end.y}
            L ${innerStart.x} ${innerStart.y}
            A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}
            Z
        `;
    };

    const activeSegment = activeIndex !== null ? segments[activeIndex] : null;
    const centerLabel = activeSegment ? activeSegment.name : view;
    const centerValue = activeSegment ? activeSegment.value : totalValueEUR;
    const centerPct = activeSegment ? activeSegment.percentage : 100;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 140px)',
            overflow: 'hidden',
            padding: '0 12px'
        }}>
            {/* View Selector - Compact Pills */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '12px',
                flexWrap: 'wrap'
            }}>
                {ALL_VIEWS.map(v => (
                    <button
                        key={v}
                        onClick={() => handleViewChange(v)}
                        style={{
                            background: view === v ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: view === v ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '16px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {v}
                    </button>
                ))}
            </div>

            {/* Donut Chart */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: '12px'
            }}>
                <div style={{ position: 'relative', width: size, height: size }}>
                    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                        {segments.map((segment, index) => {
                            const isActive = activeIndex === index;
                            const isDimmed = activeIndex !== null && !isActive;
                            const outerR = isActive ? radius + 6 : radius;
                            const innerR = isActive ? innerRadius + 2 : innerRadius;

                            return (
                                <motion.path
                                    key={segment.name}
                                    initial={{ opacity: 0 }}
                                    animate={{
                                        opacity: isDimmed ? 0.3 : 1,
                                        d: createArc(segment.startAngle, segment.endAngle, outerR, innerR)
                                    }}
                                    transition={{ duration: 0.2 }}
                                    fill={segment.color}
                                    stroke="var(--bg-main)"
                                    strokeWidth="3"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleSliceClick(index)}
                                />
                            );
                        })}
                    </svg>

                    {/* Center Label */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none'
                    }}>
                        <div style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '2px'
                        }}>
                            {centerLabel}
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            lineHeight: 1
                        }}>
                            {isPrivacyMode ? '••••' : `${sym}${convert(centerValue).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
                        </div>
                        {activeSegment && (
                            <div style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: activeSegment.color,
                                marginTop: '2px'
                            }}>
                                {centerPct.toFixed(1)}%
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Allocation List - In Card Container */}
            <div style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                padding: '12px'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}>
                    {segments.map((segment) => {
                        const isActive = activeIndex === segment.index;

                        return (
                            <div
                                key={segment.name}
                                onClick={() => handleSliceClick(segment.index)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 12px',
                                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                                    border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Left: Color dot + Name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: segment.color,
                                        flexShrink: 0
                                    }} />
                                    <span style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {segment.name}
                                    </span>
                                </div>

                                {/* Right: Percentage + Value */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        color: segment.color
                                    }}>
                                        {segment.percentage.toFixed(1)}%
                                    </span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        minWidth: '60px',
                                        textAlign: 'right'
                                    }}>
                                        {isPrivacyMode ? '••••' : `${sym}${convert(segment.value).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
