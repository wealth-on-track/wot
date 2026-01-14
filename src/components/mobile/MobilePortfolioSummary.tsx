"use client";

import { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { ASSET_COLORS } from "@/lib/constants";
import { Eye, EyeOff } from "lucide-react";
import type { AssetDisplay } from "@/lib/types";

interface MobilePortfolioSummaryProps {
    totalValueEUR: number;
    assets: AssetDisplay[];
    isPrivacyMode: boolean;
    onTogglePrivacy: () => void;
}

type Period = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

export function MobilePortfolioSummary({
    totalValueEUR,
    assets,
    isPrivacyMode,
    onTogglePrivacy
}: MobilePortfolioSummaryProps) {
    const { currency } = useCurrency();
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

    return (
        <div className="neo-card" style={{
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem'
        }}>
            {/* Left: Total Value + Change */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                    <div style={{
                        fontSize: '1.75rem',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1, // Improved line height
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        {isPrivacyMode
                            ? '****'
                            : `${convert(totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}${sym}`
                        }
                    </div>
                </div>

                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    flexWrap: 'nowrap',
                    whiteSpace: 'nowrap'
                }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total</span>
                    <span style={{ fontWeight: 800, color: totalReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(1)}%
                    </span>
                    <span style={{
                        fontWeight: 500,
                        opacity: 0.8,
                        color: totalReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                        {isPrivacyMode
                            ? '****'
                            : `${totalReturnEUR >= 0 ? '+' : ''}${sym}${convert(totalReturnEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
                        }
                    </span>
                </div>
            </div>

            {/* Right: Period Selector + Return */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                justifyContent: 'center', // Center vertically relative to the big number
                gap: '0.4rem'
            }}>
                {/* Period Selector */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    padding: '0.2rem',
                    display: 'flex',
                    gap: '0.1rem',
                    border: '1px solid var(--border)'
                }}>
                    {(["1D", "1W", "1M", "YTD", "1Y", "ALL"] as Period[]).map(period => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            style={{
                                background: selectedPeriod === period ? 'var(--accent)' : 'transparent',
                                color: selectedPeriod === period ? '#fff' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.25rem 0.4rem',
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
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                        {selectedPeriod === '1D' ? 'Today' : selectedPeriod === '1W' ? '1W' : selectedPeriod === '1M' ? '1M' : selectedPeriod === 'YTD' ? 'YTD' : 'All'}
                    </span>
                    <span style={{ fontWeight: 800, color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {periodReturnPct >= 0 ? '+' : ''}{periodReturnPct.toFixed(1)}%
                    </span>
                    <span style={{
                        fontWeight: 500, // Normal weight for amount
                        opacity: 0.8,
                        color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                        {isPrivacyMode
                            ? '****'
                            : `${periodReturnEUR >= 0 ? '+' : ''}${sym}${convert(periodReturnEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
                        }
                    </span>
                </div>
            </div>
        </div >
    );
}


// --- New Allocations Component ---
// Chevron imports removed

type AllocationView = "Portfolio" | "Type" | "Sector" | "Exchange" | "Platform" | "Currency" | "Country";

interface MobileHomeAllocationsProps {
    assets: AssetDisplay[];
    totalValueEUR: number;
    isPrivacyMode: boolean;
}

export function MobileHomeAllocations({ assets, totalValueEUR, isPrivacyMode }: MobileHomeAllocationsProps) {
    const { currency } = useCurrency();
    const [view, setView] = useState<AllocationView>("Type");

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
            else if (view === "Portfolio") key = asset.customGroup || 'My Portfolio'; // Map Portfolio -> Custom Group
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
    const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

    return (
        <div className="neo-card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* View Toggle */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                justifyContent: 'center'
            }}>
                {(["Portfolio", "Type", "Sector", "Exchange", "Platform", "Currency", "Country"] as AllocationView[]).map(v => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        style={{
                            flex: '1 0 22%', // 4 items per row approx
                            background: view === v ? 'var(--surface)' : 'var(--bg-secondary)',
                            border: view === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                            borderRadius: '6px',
                            color: view === v ? 'var(--accent)' : 'var(--text-secondary)',
                            padding: '0.3rem 0.2rem',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            boxShadow: view === v ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        }}
                    >
                        {v}
                    </button>
                ))}
            </div>

            {/* Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {chartData.map((item, index) => {
                    const percentage = totalValueEUR > 0 ? (item.value / totalValueEUR) * 100 : 0;
                    const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

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
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {item.name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {percentage.toFixed(0)}%
                                    </span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontVariantNumeric: 'tabular-nums'
                                    }}>
                                        {isPrivacyMode
                                            ? '****'
                                            : `${sym}${convert(item.value).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
                                        }
                                    </span>
                                </div>
                            </div>
                            {/* Progress Bar */}
                            <div style={{
                                width: '100%',
                                height: '6px',
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
    );
}
