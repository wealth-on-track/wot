"use client";

import { useState, useMemo } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import type { AssetDisplay } from "@/lib/types";
import { ASSET_COLORS } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";

type AllocationView = "Portfolio" | "Type" | "Sector" | "Platform" | "Currency" | "Country" | "Exchange";

interface MobileAllocationPieProps {
    assets: AssetDisplay[];
    totalValueEUR: number;
    isPrivacyMode: boolean;
}

const ALL_VIEWS: AllocationView[] = ["Portfolio", "Type", "Sector", "Platform", "Currency", "Country", "Exchange"];

export function MobileAllocationPie({ assets, totalValueEUR, isPrivacyMode }: MobileAllocationPieProps) {
    const { currency } = useCurrency();
    const [view, setView] = useState<AllocationView>("Type");
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺" };

    const convert = (amount: number) => {
        if (currency === 'ORG') return amount;
        return amount * (rates[currency] || 1);
    };
    const sym = currency === 'ORG' ? '€' : (symbols[currency] || "€");

    // Haptic Feedback Helper
    const vibrate = () => {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            window.navigator.vibrate(10);
        }
    };

    const handleViewChange = (newView: AllocationView) => {
        if (view !== newView) {
            vibrate();
            setView(newView);
            setActiveIndex(null); // Reset selection
        }
    };

    const handleSliceClick = (index: number) => {
        vibrate();
        setActiveIndex(prev => prev === index ? null : index);
    };

    // 1. Prepare Data Grouping
    const chartData = useMemo(() => {
        const data: { name: string; value: number; color?: string, assets: AssetDisplay[] }[] = [];

        assets.forEach(asset => {
            let key = 'Other';
            if (view === "Type") key = asset.type;
            else if (view === "Sector") key = asset.sector || 'Unknown';
            else if (view === "Exchange") key = asset.exchange || 'Unknown';
            else if (view === "Portfolio") key = asset.name || 'Unknown';
            else if (view === "Platform") key = asset.platform || 'Unknown';
            else if (view === "Currency") key = asset.currency || 'Unknown';
            else if (view === "Country") key = asset.country || 'Unknown';

            const existing = data.find(item => item.name === key);
            if (existing) {
                existing.value += asset.totalValueEUR;
                existing.assets.push(asset);
            } else {
                data.push({
                    name: key,
                    value: asset.totalValueEUR,
                    color: view === "Type" ? (ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']) : undefined,
                    assets: [asset]
                });
            }
        });

        // Sorting
        let sorted = data.sort((a, b) => b.value - a.value);

        // For Portfolio View, limit to top 8 + Others
        if (view === "Portfolio" && sorted.length > 8) {
            const top = sorted.slice(0, 8);
            const others = sorted.slice(8);
            const othersValue = others.reduce((sum, item) => sum + item.value, 0);
            const othersAssets = others.flatMap(item => item.assets);

            sorted = [...top, { name: 'Others', value: othersValue, assets: othersAssets }];
        }

        return sorted;
    }, [assets, view]);

    const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6', '#f97316'];

    if (totalValueEUR === 0 || assets.length === 0) {
        return (
            <div className="neo-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Add assets to see allocations</p>
            </div>
        );
    }

    // 2. Calculate Segments
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90;

    const segments = chartData.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

        return {
            ...item,
            percentage,
            startAngle,
            endAngle,
            color,
            index
        };
    });

    // 3. SVG Helpers
    const size = 260;
    const center = size / 2;
    const radius = 90; // Reduced slightly
    const innerRadius = 65; // Thicker donut for better visibility

    const polarToCartesian = (angle: number, r: number) => {
        const angleInRadians = (angle * Math.PI) / 180;
        return {
            x: center + r * Math.cos(angleInRadians),
            y: center + r * Math.sin(angleInRadians)
        };
    };

    const createArc = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
        // Ensure angle difference is not handled poorly for small slices
        // SVG Arcs need specific handling for 360 degrees, but usually we have segments < 360
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

    // 4. Center Label Logic
    const activeSegment = activeIndex !== null ? segments[activeIndex] : null;
    const centerLabel = activeSegment ? activeSegment.name : "Total Portfolio";
    const centerValue = activeSegment ? activeSegment.value : totalValueEUR;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>

            {/* 1. Wrapped Segmented Control Navigation */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '8px',
                padding: '0 8px'
            }}>
                {ALL_VIEWS.map(v => (
                    <button
                        key={v}
                        onClick={() => handleViewChange(v)}
                        style={{
                            background: view === v ? 'var(--text-primary)' : 'var(--bg-secondary)',
                            color: view === v ? 'var(--bg-primary)' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            transform: view === v ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: view === v ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                        }}
                    >
                        {v}
                    </button>
                ))}
            </div>

            {/* 2. Interactive Donut Chart */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                position: 'relative',
                marginTop: '1rem',
                marginBottom: '1rem'
            }}>
                <div style={{ position: 'relative', width: size, height: size }}>
                    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                        <AnimatePresence>
                            {segments.map((segment, index) => {
                                const isActive = activeIndex === index;
                                const isDimmed = activeIndex !== null && !isActive;

                                // Pop-out effect radius
                                const outerR = isActive ? radius + 8 : radius;
                                const innerR = isActive ? innerRadius + 2 : innerRadius;

                                return (
                                    <motion.path
                                        key={segment.name}
                                        initial={{ opacity: 0 }}
                                        animate={{
                                            opacity: isDimmed ? 0.3 : 1,
                                            d: createArc(segment.startAngle, segment.endAngle, outerR, innerR)
                                        }}
                                        transition={{ duration: 0.3, type: 'spring' }}
                                        d={createArc(segment.startAngle, segment.endAngle, radius, innerRadius)}
                                        fill={segment.color}
                                        stroke="var(--bg-primary)"
                                        strokeWidth="4" // Thicker stroke for separation
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleSliceClick(index)}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </svg>

                    {/* Center Label */}
                    <motion.div
                        initial={false}
                        animate={{
                            x: "-50%", // Use motion props for translation to handle transform correctly
                            y: "-50%",
                            scale: activeIndex !== null ? 1.05 : 1
                        }}
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            textAlign: 'center',
                            pointerEvents: 'none',
                            width: 'auto', // Allow it to size naturally
                            maxWidth: '180px' // Check wrapping
                        }}
                    >
                        <motion.div
                            key={centerLabel} // Triggers animation on change
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                marginBottom: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {centerLabel}
                        </motion.div>
                        <motion.div
                            key={centerValue}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{
                                fontSize: '1.4rem',
                                fontWeight: 800,
                                color: 'var(--text-primary)',
                                lineHeight: 1,
                                letterSpacing: '-0.02em'
                            }}
                        >
                            {isPrivacyMode ? '****' : `${sym}${convert(centerValue).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
                        </motion.div>
                    </motion.div>
                </div>
            </div>

            {/* 3. The Ultimate List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {segments.map((segment) => {
                    const isActive = activeIndex === segment.index;

                    return (
                        <div
                            key={segment.name}
                            onClick={() => handleSliceClick(segment.index)}
                            style={{
                                background: 'var(--surface)',
                                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                                borderRadius: '16px',
                                padding: '12px 16px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            {/* Main Row */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Left: Dot & Name */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: segment.color,
                                            boxShadow: `0 0 8px ${segment.color}80`
                                        }} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {segment.name}
                                        </span>
                                    </div>

                                    {/* Right: Percent & Value */}
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {segment.percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Progress Bar (Underline Style) */}
                                <div style={{ width: '100%', display: 'flex' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${segment.percentage}%` }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        style={{
                                            height: '3px',
                                            background: segment.color,
                                            borderRadius: '2px'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Sub-Assets Accordion */}
                            <AnimatePresence>
                                {isActive && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ height: '1px', background: 'var(--border)', marginBottom: '4px' }} />

                                            {segment.assets
                                                .sort((a, b) => b.totalValueEUR - a.totalValueEUR)
                                                .slice(0, 5) // Show top 5
                                                .map(asset => (
                                                    <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>•</span>
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{asset.symbol}</span>
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            {isPrivacyMode ? '****' : `${sym}${convert(asset.totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
                                                        </span>
                                                    </div>
                                                ))}

                                            {segment.assets.length > 5 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
                                                    + {segment.assets.length - 5} others
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
