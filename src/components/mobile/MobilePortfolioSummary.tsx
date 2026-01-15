import { useState, useEffect } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { ASSET_COLORS } from "@/lib/constants";
import { Eye, EyeOff, ChevronRight, ChevronLeft } from "lucide-react";
import type { AssetDisplay } from "@/lib/types";

interface MobilePortfolioSummaryProps {
    totalValueEUR: number;
    assets: AssetDisplay[];
    isPrivacyMode: boolean;
    onTogglePrivacy: () => void;
    defaultPeriod?: string;
    onPeriodChange?: (period: string) => void; // New prop to notify parent of period changes
}

type Period = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

export function MobilePortfolioSummary({
    totalValueEUR,
    assets,
    isPrivacyMode,
    onTogglePrivacy,
    defaultPeriod = "1D",
    onPeriodChange
}: MobilePortfolioSummaryProps) {
    const { currency } = useCurrency();
    const [selectedPeriod, setSelectedPeriod] = useState<Period>(defaultPeriod as Period);

    // Sync state if prop changes
    useEffect(() => {
        if (defaultPeriod) {
            setSelectedPeriod(defaultPeriod as Period);
        }
    }, [defaultPeriod]);

    // Notify parent when period changes
    const handlePeriodChange = (period: Period) => {
        setSelectedPeriod(period);
        if (onPeriodChange) {
            onPeriodChange(period);
        }
    };

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺" };

    const convert = (amount: number) => {
        if (currency === 'ORG') return amount; // EUR base
        return amount * (rates[currency] || 1);
    };
    const sym = currency === 'ORG' ? '€' : (symbols[currency] || "€");

    // Mock returns based on period
    const periodFactors: Record<Period, number> = {
        "1D": 0.015,
        "1W": 0.03,
        "1M": 0.05,
        "YTD": 0.08,
        "1Y": 0.12,
        "ALL": 0.15
    };

    // Recalculate based on selectedPeriod (dynamic)
    const periodReturnEUR = totalValueEUR * (periodFactors[selectedPeriod] || 0.01);
    const periodReturnPct = totalValueEUR > 0 ? (periodReturnEUR / totalValueEUR) * 100 : 0;

    return (
        <div className="neo-card" style={{
            padding: '1.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            {/* Main Portfolio Value - Centered & Large */}
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    marginBottom: '0.5rem'
                }}>
                    {isPrivacyMode
                        ? '****'
                        : `${convert(totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}${sym}`
                    }
                </div>

                {/* Period Return Stats */}
                <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {selectedPeriod === '1D' ? 'Today' : selectedPeriod === 'ALL' ? 'All Time' : selectedPeriod}
                    </span>
                    <span style={{
                        color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)',
                        fontSize: '1rem'
                    }}>
                        {periodReturnPct >= 0 ? '+' : ''}{periodReturnPct.toFixed(2)}%
                    </span>
                    <span style={{
                        color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)',
                        opacity: 0.8,
                        fontSize: '0.85rem'
                    }}>
                        {isPrivacyMode
                            ? '****'
                            : `(${periodReturnEUR >= 0 ? '+' : ''}${sym}${convert(periodReturnEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })})`
                        }
                    </span>
                </div>
            </div>

            {/* Period Selector - Outlined Buttons */}
            <div style={{
                display: 'flex',
                gap: '0.3rem',
                justifyContent: 'center',
                flexWrap: 'nowrap',
                overflow: 'hidden'
            }}>
                {(["1D", "1W", "1M", "YTD", "1Y", "ALL"] as Period[]).map(period => (
                    <button
                        key={period}
                        onClick={() => handlePeriodChange(period)}
                        style={{
                            background: selectedPeriod === period ? 'var(--accent)' : 'transparent',
                            color: selectedPeriod === period ? '#fff' : 'var(--text-muted)',
                            border: selectedPeriod === period ? 'none' : '1.5px solid var(--border)',
                            borderRadius: '6px',
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            letterSpacing: '0.02em',
                            minWidth: '0',
                            flex: '1 1 auto',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {period}
                    </button>
                ))}
            </div>
        </div>
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
    const [page, setPage] = useState(0);

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

    if (totalValueEUR === 0 || assets.length === 0) {
        return (
            <div className="neo-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Add assets to see allocations</p>
            </div>
        );
    }

    return (
        <div className="neo-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Paginated Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0.8rem',
                marginBottom: '0.2rem'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.2rem',
                    flex: 1
                }}>
                    {groups[page].map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0',
                                fontSize: '0.85rem',
                                fontWeight: view === v ? 800 : 500,
                                color: view === v ? 'var(--accent)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'color 0.2s',
                                position: 'relative'
                            }}
                        >
                            {v}
                            {view === v && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-0.95rem', // aligned with border-bottom of container
                                    left: 0,
                                    right: 0,
                                    height: '2px',
                                    background: 'var(--accent)',
                                    borderRadius: '2px 2px 0 0'
                                }} />
                            )}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handlePageToggle}
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-muted)'
                    }}
                >
                    {page === 0 ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
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
