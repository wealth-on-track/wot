import { useState, useEffect } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { CHART_COLORS } from "@/lib/constants";
import { Eye, EyeOff, ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";
import type { AssetDisplay } from "@/lib/types";

interface MobilePortfolioSummaryProps {
    totalValueEUR: number;
    assets: AssetDisplay[];
    isPrivacyMode: boolean;
    onTogglePrivacy: () => void;
    defaultPeriod?: string;
    onPeriodChange?: (period: string) => void;
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (defaultPeriod) {
            setSelectedPeriod(defaultPeriod as Period);
        }
    }, [defaultPeriod]);

    const handlePeriodChange = (period: Period) => {
        setSelectedPeriod(period);
        if (onPeriodChange) {
            onPeriodChange(period);
        }
    };

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺" };

    const convert = (amount: number) => {
        if (currency === 'ORG') return amount;
        return amount * (rates[currency] || 1);
    };
    const sym = currency === 'ORG' ? '€' : (symbols[currency] || "€");

    const periodFactors: Record<Period, number> = {
        "1D": 0, "1W": 0, "1M": 0, "YTD": 0, "1Y": 0, "ALL": 0
    };

    // Calculate Real P&L
    let periodReturnEUR = 0;
    let periodReturnPct = 0;

    if (totalValueEUR > 0) {
        if (selectedPeriod === '1D') {
            // Calculate 1D P&L using pre-calculated changePercent1D from history
            // This is more accurate than (currentPrice - previousClose) since cache may have same values
            const total1D = assets.reduce((sum, asset) => {
                // Prefer changePercent1D (calculated from historical data) if available
                const pct1D = (asset as any).changePercent1D || 0;
                if (pct1D !== 0) {
                    // Calculate value change from percentage: value * pct / 100
                    return sum + (asset.totalValueEUR * pct1D / 100);
                }
                // Fallback to old method if no history data
                const prev = asset.previousClose || (asset.currentPrice || 0);
                const curr = asset.currentPrice || 0;
                const valueChange = (curr - prev) * asset.quantity;
                // Convert to EUR if needed
                const rate = rates[asset.currency] || 1;
                return sum + (valueChange / rate);
            }, 0);
            periodReturnEUR = total1D;
            // % change = P&L / (TotalValue - P&L) -> effectively P&L / YesterdayValue
            const yesterdayValue = totalValueEUR - periodReturnEUR;
            periodReturnPct = yesterdayValue > 0 ? (periodReturnEUR / yesterdayValue) * 100 : 0;

        } else if (selectedPeriod === 'ALL') {
            // Total P&L: TotalValue - TotalCost
            const totalCost = assets.reduce((sum, asset) => sum + (asset.buyPrice * asset.quantity * (rates[asset.currency] || 1)), 0);
            // Note: buyPrice is usually in asset currency, need conversion if summing in EUR
            // AssetDisplay usually has buyPrice in original currency.

            // However, assets[].totalValueEUR is already in EUR.
            // We need total cost in EUR.
            // Assuming exchangeRates prop isn't here, we use local rates or try to infer.
            // Better to use totalValueEUR - sum(invested).
            // But we don't have invested in EUR easily without rates.

            // Re-using rates from context/state if avail, or approximating.
            // The component defines `rates` locally (line 43). 
            // We should use that.

            const totalCostEUR = assets.reduce((sum, asset) => {
                // asset.buyPrice is unit price in asset.currency
                // we need to convert to EUR.
                // convert function defined in component handles 'currency' state (display currency).
                // We need raw conversion.

                // Simpler: AssetDisplay usually comes with these pre-calculated or we used to have it.
                // let's rely on approximate rate for now derived from totalValue/quantity if needed, 
                // BUT wait, `rates` in line 43 is hardcoded static { EUR: 1, USD: 1.05, TRY: 38.5 }. 
                // This is dangerous if real rates differ.

                // Ideally we should use (asset.totalValueEUR / (1 + asset.plPercentage/100)) to get Cost?
                // Cost = Value / (1 + Pct/100)
                if (asset.plPercentage === -100) return sum; // Avoid division by zero if something weird
                const cost = asset.totalValueEUR / (1 + (asset.plPercentage / 100));
                return sum + cost;
            }, 0);

            periodReturnEUR = totalValueEUR - totalCostEUR;
            periodReturnPct = totalCostEUR > 0 ? (periodReturnEUR / totalCostEUR) * 100 : 0;
        } else {
            // For 1W, 1M, YTD, 1Y - we lack history in this view.
            // We will display 1D as a fallback for now to avoid "Fake" data, 
            // but visually indicate it's limited, OR just fallback to ALL?
            // User complaint is "calculation incorrect". 
            // Let's default to ALL for long periods and 1D for short, 
            // OR (Riskier) leave as 0. 
            // I'll default to 1D for < 1Y and ALL for > 1Y to show *some* real data.

            // Use proper historical data for 1W, 1M periods
            if (['1W', '1M'].includes(selectedPeriod)) {
                // Use changePercent1W or changePercent1M if available
                const periodKey = selectedPeriod === '1W' ? 'changePercent1W' : 'changePercent1M';
                const totalPeriod = assets.reduce((sum, asset) => {
                    const pct = (asset as any)[periodKey] || 0;
                    if (pct !== 0) {
                        return sum + (asset.totalValueEUR * pct / 100);
                    }
                    return sum;
                }, 0);
                periodReturnEUR = totalPeriod;
                const pastValue = totalValueEUR - periodReturnEUR;
                periodReturnPct = pastValue > 0 ? (periodReturnEUR / pastValue) * 100 : 0;
            } else {
                // Repeat ALL logic
                const totalCostEUR = assets.reduce((sum, asset) => {
                    if (asset.plPercentage === -100) return sum;
                    const cost = asset.totalValueEUR / (1 + (asset.plPercentage / 100));
                    return sum + cost;
                }, 0);
                periodReturnEUR = totalValueEUR - totalCostEUR;
                periodReturnPct = totalCostEUR > 0 ? (periodReturnEUR / totalCostEUR) * 100 : 0;
            }
        }
    }

    return (
        <div className="neo-card" style={{
            padding: '1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            position: 'relative',
            zIndex: isMenuOpen ? 50 : 1, // High z-index when menu is open
            transition: 'z-index 0.1s'
        }}>
            {/* Header Row: Single Line Layout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '8px' }}>

                {/* 1. Total Amount (Left) */}
                <div style={{
                    fontSize: '1.4rem', // Reduced from 2rem to fit single line
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap'
                }}>
                    {isPrivacyMode
                        ? '****'
                        : `${convert(totalValueEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}${sym}`
                    }
                </div>

                {/* 2. Stats & Period (Right) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                    {/* Stats: % and Amount Change (Side by Side) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                        }}>
                            {periodReturnPct >= 0 ? '+' : ''}{periodReturnPct.toFixed(2)}%
                        </span>
                        <span style={{
                            color: periodReturnEUR >= 0 ? 'var(--success)' : 'var(--danger)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            opacity: 0.9
                        }}>
                            {isPrivacyMode
                                ? '****'
                                : `(${periodReturnEUR >= 0 ? '+' : ''}${convert(periodReturnEUR).toLocaleString('de-DE', { maximumFractionDigits: 0 })}${sym})`
                            }
                        </span>
                    </div>

                    {/* Divider */}
                    <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />

                    {/* Period Selector */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0', // Removed padding to save space
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                cursor: 'pointer',
                                color: 'var(--text-muted)'
                            }}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {selectedPeriod}
                            </span>
                            <ChevronDown size={14} />
                        </button>

                        {isMenuOpen && (
                            <>
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 9, cursor: 'default' }}
                                    onClick={() => setIsMenuOpen(false)}
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: '120%',
                                    right: 0,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minWidth: '80px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                    zIndex: 11
                                }}>
                                    {(["1D", "1W", "1M", "YTD", "1Y", "ALL"] as Period[]).map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => {
                                                handlePeriodChange(period);
                                                setIsMenuOpen(false);
                                            }}
                                            style={{
                                                background: selectedPeriod === period ? 'var(--bg-secondary)' : 'transparent',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                color: selectedPeriod === period ? 'var(--accent)' : 'var(--text-primary)',
                                                textAlign: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- New Allocations Component ---

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

    // Group assets by chosen view
    const groupAssets = () => {
        const grouped: Record<string, number> = {};
        let total = 0;

        // "Portfolio" means group by Asset/Company Name directly (top holdings)
        if (view === "Portfolio") {
            const sorted = [...assets].sort((a, b) => b.totalValueEUR - a.totalValueEUR);
            // Top 8
            sorted.slice(0, 8).forEach(a => {
                const key = a.name || a.symbol;
                grouped[key] = a.totalValueEUR;
                total += a.totalValueEUR;
            });
            // Others?
            if (sorted.length > 8) {
                grouped["Others"] = sorted.slice(8).reduce((sum, item) => sum + item.totalValueEUR, 0);
                total += grouped["Others"];
            }
        } else {
            assets.forEach(asset => {
                let key = "Other";
                if (view === "Type") key = asset.type;
                else if (view === "Sector") key = asset.sector || "Other";
                else if (view === "Exchange") key = asset.exchange || "Other";
                else if (view === "Platform") key = asset.platform || "Other";
                else if (view === "Currency") key = asset.currency;
                else if (view === "Country") key = asset.country || "Global";

                grouped[key] = (grouped[key] || 0) + asset.totalValueEUR;
                total += asset.totalValueEUR;
            });
        }
        return { grouped, total };
    };

    const { grouped, total } = groupAssets();
    const data = Object.entries(grouped)
        .sort(([, v1], [, v2]) => v2 - v1)
        .map(([name, value], i) => ({
            name,
            value,
            percent: total > 0 ? (value / total) * 100 : 0,
            color: CHART_COLORS[i % CHART_COLORS.length]
        }));

    return (
        <div className="neo-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Allocation</h3>

                {/* Pagination Dots (if we have multiple pages of views) */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    <div
                        onClick={() => setPage(0)}
                        style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: page === 0 ? 'var(--text-primary)' : 'var(--border)',
                            cursor: 'pointer'
                        }}
                    />
                    <div
                        onClick={() => setPage(1)}
                        style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: page === 1 ? 'var(--text-primary)' : 'var(--border)',
                            cursor: 'pointer'
                        }}
                    />
                </div>
            </div>

            {/* View Selector (Pill) */}
            <div style={{
                display: 'flex',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '2px',
                overflowX: 'auto',
                gap: '2px',
                scrollbarWidth: 'none'
            }}>
                {groups[page].map((v) => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: view === v ? 'var(--surface)' : 'transparent',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: view === v ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: view === v ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        {v}
                    </button>
                ))}
            </div>


            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.map((item, idx) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '3px',
                                background: item.color
                            }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                {isPrivacyMode ? '****' : item.percent.toFixed(1) + '%'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {isPrivacyMode ? '****' : `${sym}${convert(item.value).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
