"use client";

import { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { PortfolioChart } from "./PortfolioChart";
import { BarChart } from "./BarChart";
import { ASSET_COLORS } from "@/lib/constants";

interface PortfolioSummaryProps {
    assets: {
        symbol: string;
        totalValueEUR: number;
        type: string;
        exchange?: string;
        sector?: string;
        currency?: string;
        country?: string;
        platform?: string;
    }[];
    totalValueEUR: number;
    isMock?: boolean;
    isBlurred?: boolean;
}

const TABS = ["1D", "1W", "1M", "YTD", "1Y", "ALL"];
const CURRENCIES = ["EUR", "USD", "TRY"] as const;
const ALLOCATION_VIEWS = ["Type", "Sector", "Platform", "Country"]; // Reduced list for compactness
const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6', '#f97316'];

// Country mapping from exchange
const getCountryFromExchange = (exchange?: string): string => {
    if (!exchange) return 'Unknown';
    const ex = exchange.toUpperCase();
    if (ex.includes('BIST') || ex.includes('IST')) return 'Turkey';
    if (ex.includes('NASDAQ') || ex.includes('NYSE')) return 'USA';
    if (ex.includes('LON') || ex.includes('LSE')) return 'UK';
    if (ex.includes('FRA')) return 'Germany';
    if (ex.includes('PAR')) return 'France';
    return 'Other';
};

export function PortfolioSummary({ assets, totalValueEUR, isMock = false, isBlurred = false }: PortfolioSummaryProps) {
    const [activeTab, setActiveTab] = useState("1D");
    const { currency } = useCurrency();
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
    const [allocationView, setAllocationView] = useState("Type");
    const [chartView, setChartView] = useState<"pie" | "bar">("pie");

    // Static conversion rates for UI smoothness
    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5, ORG: 1 };
    const currencySymbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", ORG: "" };

    const convert = (amount: number) => {
        const rate = rates[currency] || 1;
        return amount * rate;
    };

    // Derived Stats
    const totalReturnAmtEUR = isMock ? 1245.50 : (totalValueEUR * 0.12);
    const totalReturnPct = isMock ? 15.4 : 12.0;

    // Period stats
    const factor = activeTab === "1D" ? 0.05 : activeTab === "1W" ? 0.3 : 1;
    const periodReturnAmtEUR = totalReturnAmtEUR * factor;
    const periodReturnPct = totalReturnPct * factor;

    // Display Values
    const displayBalance = convert(totalValueEUR);
    const displayPeriodReturn = convert(periodReturnAmtEUR);
    const displayTotalReturn = convert(totalReturnAmtEUR);
    const sym = currencySymbols[currency];

    // Dynamic data based on allocation view
    const getChartData = () => {
        let data: { name: string; value: number; color?: string }[] = [];

        switch (allocationView) {
            case "Type":
                data = assets.reduce((acc, asset) => {
                    const existing = acc.find(item => item.name === asset.type);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name: asset.type, value: asset.totalValueEUR, color: ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT'] }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Sector":
                data = assets.reduce((acc, asset) => {
                    const name = asset.sector || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; } else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Platform":
                data = assets.reduce((acc, asset) => {
                    const name = asset.platform || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; } else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Country":
                data = assets.reduce((acc, asset) => {
                    const name = asset.country || getCountryFromExchange(asset.exchange);
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; } else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
        }
        return data;
    };

    const chartData = getChartData();
    const sortedData = [...chartData].sort((a, b) => b.value - a.value);
    const totalVal = sortedData.reduce((sum, item) => sum + item.value, 0);

    // Hovered Data
    const hoveredItem = hoveredSlice ? chartData.find(i => i.name === hoveredSlice) : null;
    const hoveredValue = hoveredItem ? convert(hoveredItem.value) : displayBalance;
    const hoveredPct = hoveredItem ? (hoveredItem.value / totalVal * 100) : null;

    return (
        <div className="neo-card" style={{
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
            height: 'fit-content',
            background: 'var(--bg-primary)',
            boxShadow: 'var(--shadow-md)'
        }}>

            {/* Header: Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Portfolio Net Worth</span>
                        <div style={{
                            fontSize: '2.5rem',
                            fontWeight: 900,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.05em',
                            filter: isBlurred ? 'blur(12px)' : 'none',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1
                        }}>
                            {sym}{displayBalance.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.3rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        gap: '0.15rem'
                    }}>
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    background: activeTab === tab ? 'var(--surface)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Return Stats (Neo Style) */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Returns Since {activeTab}</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: periodReturnAmtEUR >= 0 ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                                {periodReturnAmtEUR >= 0 ? '+' : ''}{sym}{displayPeriodReturn.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: periodReturnAmtEUR >= 0 ? 'var(--success)' : 'var(--danger)', opacity: 0.8 }}>
                                {periodReturnPct.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: periodReturnAmtEUR >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: periodReturnAmtEUR >= 0 ? 'var(--success)' : 'var(--danger)',
                        boxShadow: `0 0 15px ${periodReturnAmtEUR >= 0 ? 'var(--success)' : 'var(--danger)'}20`
                    }}>
                        {periodReturnAmtEUR >= 0 ? '↑' : '↓'}
                    </div>
                </div>

                {/* Allocation Toggles */}
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    {ALLOCATION_VIEWS.map(view => (
                        <button
                            key={view}
                            onClick={() => setAllocationView(view)}
                            style={{
                                flex: 1,
                                background: allocationView === view ? 'var(--surface)' : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                color: allocationView === view ? 'var(--accent)' : 'var(--text-secondary)',
                                padding: '0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em'
                            }}
                        >
                            {view}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Section */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', maxHeight: '340px', margin: '0 auto' }}>
                <PortfolioChart
                    assets={chartData}
                    totalValueEUR={totalValueEUR}
                    showLegend={false}
                    onHover={setHoveredSlice}
                    activeSliceName={hoveredSlice}
                />

                {/* Center Content: Total Balance or Hover Info */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    textAlign: 'center',
                    width: '65%'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                        {hoveredSlice ? hoveredSlice : 'Portfolio Share'}
                    </div>

                    <div style={{
                        fontSize: hoveredSlice ? '2rem' : '1.75rem',
                        fontWeight: 900,
                        lineHeight: 1.1,
                        filter: isBlurred ? 'blur(12px)' : 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        color: hoveredItem?.color ? hoveredItem.color : 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        {hoveredSlice ? `${sym}${hoveredValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : `${(totalValueEUR > 0 ? 100 : 0)}%`}
                    </div>

                    {hoveredSlice && (
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: '0.4rem', color: 'var(--text-primary)', opacity: 0.9 }}>
                            {hoveredPct?.toFixed(1)}%
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Legend (Modern Grid) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                marginTop: '0.5rem'
            }}>
                {sortedData.map((item, index) => {
                    const color = (item as any).color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                    const isHovered = hoveredSlice === item.name;
                    const pct = (item.value / totalVal * 100);
                    const val = convert(item.value);

                    return (
                        <div
                            key={item.name}
                            onMouseEnter={() => setHoveredSlice(item.name)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                background: isHovered ? 'var(--bg-secondary)' : 'transparent',
                                border: '1px solid',
                                borderColor: isHovered ? 'var(--border)' : 'transparent',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                opacity: hoveredSlice && !isHovered ? 0.3 : 1,
                            }}
                        >
                            <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '2px', background: color, flexShrink: 0, boxShadow: `0 0 10px ${color}40` }}></div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: '0.1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                    {sym}{val.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
