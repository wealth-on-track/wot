"use client";

import { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { ASSET_COLORS } from "@/lib/constants";

interface MobilePortfolioSummaryProps {
    totalValueEUR: number;
    assets: {
        symbol: string;
        totalValueEUR: number;
        type: string;
        sector?: string;
    }[];
}

type AllocationView = "Type" | "Sector";
type Period = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

export function MobilePortfolioSummary({ totalValueEUR, assets }: MobilePortfolioSummaryProps) {
    const { currency } = useCurrency();
    const [allocationView, setAllocationView] = useState<AllocationView>("Type");
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>("1D");

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺" };

    const convert = (amount: number) => {
        if (currency === 'ORG') return amount; // EUR base
        return amount * (rates[currency] || 1);
    };
    const sym = currency === 'ORG' ? '€' : (symbols[currency] || "€");

    // Mock returns based on period
    const totalReturnEUR = totalValueEUR * 0.12;
    const totalReturnPct = 12.0;

    const periodFactors: Record<Period, number> = {
        "1D": 0.015,
        "1W": 0.03,
        "1M": 0.05,
        "YTD": 0.08,
        "1Y": 0.12,
        "ALL": 0.15
    };
    const periodReturnEUR = totalValueEUR * periodFactors[selectedPeriod];
    const periodReturnPct = (periodReturnEUR / totalValueEUR) * 100;

    // Calculate allocation data
    const getChartData = () => {
        const data: { name: string; value: number; color?: string }[] = [];

        if (allocationView === "Type") {
            assets.forEach(asset => {
                const existing = data.find(item => item.name === asset.type);
                if (existing) {
                    existing.value += asset.totalValueEUR;
                } else {
                    data.push({
                        name: asset.type,
                        value: asset.totalValueEUR,
                        color: ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']
                    });
                }
            });
        } else {
            assets.forEach(asset => {
                const name = asset.sector || 'Unknown';
                const existing = data.find(item => item.name === name);
                if (existing) {
                    existing.value += asset.totalValueEUR;
                } else {
                    data.push({ name, value: asset.totalValueEUR });
                }
            });
        }

        return data.sort((a, b) => b.value - a.value);
    };

    const chartData = getChartData();
    const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

    return (
        <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            border: '1px solid var(--border)',
            overflow: 'hidden'
        }}>
            {/* Compact Balance Section */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '0.85rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)'
                }}
            >
                {/* Horizontal Symmetric Layout */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    {/* Left: Total Value + Change */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: '1.75rem',
                            fontWeight: 900,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.03em',
                            lineHeight: 1,
                            marginBottom: '0.35rem'
                        }}>
                            {convert(totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}{sym}
                        </div>
                        {/* Portfolio Total Change */}
                        <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Total</span>
                            <span style={{ color: totalReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(1)}%
                            </span>
                            <span style={{
                                opacity: 0.8,
                                color: totalReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)'
                            }}>
                                {totalReturnEUR >= 0 ? '+' : ''}{sym}{convert(totalReturnEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>

                    {/* Right: Period Selector + Return */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '0.35rem'
                    }}>
                        {/* Period Selector */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '6px',
                            padding: '0.2rem',
                            display: 'flex',
                            gap: '0.1rem',
                            border: '1px solid var(--border)'
                        }}>
                            {(["1D", "1W", "1M", "1Y"] as Period[]).map(period => (
                                <button
                                    key={period}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPeriod(period);
                                    }}
                                    style={{
                                        background: selectedPeriod === period ? 'var(--accent)' : 'transparent',
                                        color: selectedPeriod === period ? '#fff' : 'var(--text-muted)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '0.3rem 0.4rem',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        letterSpacing: '0.02em'
                                    }}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>

                        {/* Period Return */}
                        <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            textAlign: 'right',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                                {selectedPeriod === '1D' ? 'Today' : selectedPeriod === '1W' ? '1 Week' : selectedPeriod === '1M' ? '1 Month' : '1 Year'}
                            </span>
                            <span style={{ color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {periodReturnPct >= 0 ? '+' : ''}{periodReturnPct.toFixed(1)}%
                            </span>
                            <span style={{
                                opacity: 0.8,
                                color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)'
                            }}>
                                {periodReturnEUR >= 0 ? '+' : ''}{sym}{convert(periodReturnEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>

                    {/* Expand/Collapse Icon */}
                    <div style={{
                        fontSize: '1.2rem',
                        color: 'var(--text-muted)',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        flexShrink: 0
                    }}>
                        ↓
                    </div>
                </div>
            </div>

            {/* Allocation Section - Expandable */}
            {isExpanded && (
                <div style={{
                    padding: '0.85rem'
                }}>
                    {/* Toggle Type/Sector */}
                    <div style={{
                        display: 'flex',
                        gap: '0.3rem',
                        marginBottom: '0.85rem',
                        background: 'var(--bg-secondary)',
                        padding: '0.25rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)'
                    }}>
                        {(["Type", "Sector"] as AllocationView[]).map(view => (
                            <button
                                key={view}
                                onClick={() => setAllocationView(view)}
                                style={{
                                    flex: 1,
                                    background: allocationView === view ? 'var(--surface)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: allocationView === view ? 'var(--accent)' : 'var(--text-secondary)',
                                    padding: '0.4rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                }}
                            >
                                {view}
                            </button>
                        ))}
                    </div>

                    {/* Allocation Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {chartData.map((item, index) => {
                            const percentage = (item.value / totalValueEUR) * 100;
                            const color = (item as any).color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

                            return (
                                <div key={item.name}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '0.3rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <div style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '2px',
                                                background: color,
                                                boxShadow: `0 0 6px ${color}40`
                                            }} />
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)'
                                            }}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                color: 'var(--text-primary)'
                                            }}>
                                                {percentage.toFixed(0)}%
                                            </span>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                color: 'var(--text-muted)',
                                                fontWeight: 600
                                            }}>
                                                {sym}{convert(item.value).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div style={{
                                        width: '100%',
                                        height: '5px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '3px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${percentage}%`,
                                            height: '100%',
                                            background: color,
                                            borderRadius: '3px',
                                            transition: 'width 0.4s ease'
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
