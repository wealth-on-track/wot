"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import type { AssetDisplay } from "@/lib/types";
import { ASSET_COLORS } from "@/lib/constants";

type AllocationView = "Portfolio" | "Type" | "Sector" | "Exchange" | "Platform" | "Currency" | "Country";

interface MobileAllocationPieProps {
    assets: AssetDisplay[];
    totalValueEUR: number;
    isPrivacyMode: boolean;
}

export function MobileAllocationPie({ assets, totalValueEUR, isPrivacyMode }: MobileAllocationPieProps) {
    const { currency } = useCurrency();
    const [view, setView] = useState<AllocationView>("Type");
    const [page, setPage] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const groups: AllocationView[][] = [
        ["Portfolio", "Type", "Sector", "Exchange"],
        ["Platform", "Currency", "Country"]
    ];

    const handlePageToggle = () => {
        setPage(prev => prev === 0 ? 1 : 0);
    };

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺" };

    const convert = (amount: number) => {
        if (currency === 'ORG') return amount;
        return amount * (rates[currency] || 1);
    };
    const sym = currency === 'ORG' ? '€' : (symbols[currency] || "€");

    const getChartData = () => {
        const data: { name: string; value: number; color?: string }[] = [];

        assets.forEach(asset => {
            let key = 'Other';
            if (view === "Type") key = asset.type;
            else if (view === "Sector") key = asset.sector || 'Unknown';
            else if (view === "Exchange") key = asset.exchange || 'Unknown';
            else if (view === "Portfolio") key = asset.customGroup || 'My Portfolio';
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

        return data.sort((a, b) => b.value - a.value);
    };

    const chartData = getChartData();
    const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6', '#f97316'];

    if (totalValueEUR === 0 || assets.length === 0) {
        return (
            <div className="neo-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Add assets to see allocations</p>
            </div>
        );
    }

    // Calculate pie chart segments
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90; // Start from top

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

    // SVG Pie Chart
    const size = 280;
    const center = size / 2;
    const radius = 100;
    const innerRadius = 60; // Donut chart

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

    return (
        <div style={{
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
            borderRadius: '24px',
            padding: '1.5rem',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flex: 1,
                    overflowX: 'auto',
                    scrollbarWidth: 'none'
                }}>
                    {groups[page].map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            style={{
                                background: view === v ? 'var(--accent)' : 'transparent',
                                border: view === v ? 'none' : '1px solid var(--border)',
                                padding: '0.5rem 1rem',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: view === v ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                boxShadow: view === v ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                            }}
                        >
                            {v}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handlePageToggle}
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        marginLeft: '0.5rem'
                    }}
                >
                    {page === 0 ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Pie Chart */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem'
            }}>
                <div style={{ position: 'relative' }}>
                    <svg width={size} height={size} style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
                        {segments.map((segment, index) => (
                            <g key={index}>
                                <path
                                    d={createArc(
                                        segment.startAngle,
                                        segment.endAngle,
                                        hoveredIndex === index ? radius + 5 : radius,
                                        innerRadius
                                    )}
                                    fill={segment.color}
                                    stroke="var(--bg-primary)"
                                    strokeWidth="2"
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.5
                                    }}
                                    onMouseEnter={() => setHoveredIndex(index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                />
                            </g>
                        ))}
                    </svg>

                    {/* Center Label */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Total
                        </div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 900,
                            color: 'var(--text-primary)',
                            lineHeight: 1
                        }}>
                            {isPrivacyMode ? '****' : `${sym}${convert(totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.75rem',
                    width: '100%'
                }}>
                    {segments.map((segment, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                background: hoveredIndex === index ? 'var(--bg-secondary)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px',
                                background: segment.color,
                                boxShadow: `0 0 8px ${segment.color}60`,
                                flexShrink: 0
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {segment.name}
                                </div>
                                <div style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: 600
                                }}>
                                    {segment.percentage.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
