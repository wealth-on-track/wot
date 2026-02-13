"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useCurrency } from "@/context/CurrencyContext";
import type { AssetDisplay } from "@/lib/types";
import {
    TrendingUp,
    TrendingDown,
    ChevronDown,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    Briefcase,
    PieChart
} from "lucide-react";

interface MobileHomeTabProps {
    totalValueEUR: number;
    assets: AssetDisplay[];
    isPrivacyMode: boolean;
    defaultPeriod?: string;
    onPeriodChange?: (period: string) => void;
    onNavigateToPositions?: () => void;
    onNavigateToAllocation?: () => void;
    onEditAsset?: (asset: AssetDisplay) => void;
    exchangeRates?: Record<string, number>;
}

type Period = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

function AssetLogo({ asset, fallback, size = 20 }: { asset: AssetDisplay; fallback: React.ReactNode; size?: number }) {
    const [error, setError] = useState(false);
    const currencySymbols: Record<string, string> = { EUR: '€', USD: '$', TRY: '₺', GBP: '£' };
    const isCashAsset = asset.type === 'CASH';

    // For CASH assets, show currency symbol instead of logo
    if (isCashAsset) {
        return (
            <div style={{
                width: size,
                height: size,
                borderRadius: "50%",
                background: "var(--bg-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: size * 0.6
            }}>
                {currencySymbols[asset.symbol] || asset.symbol[0]}
            </div>
        );
    }

    const logoUrl = asset.logoUrl || `https://logo.clearbit.com/${asset.symbol.toLowerCase()}.com`;

    if (error) return <>{fallback}</>;

    return (
        <img
            src={logoUrl}
            alt={asset.symbol}
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                objectFit: "cover",
                background: "var(--bg-secondary)"
            }}
            onError={() => setError(true)}
        />
    );
}

export function MobileHomeTab({
    totalValueEUR,
    assets,
    isPrivacyMode,
    defaultPeriod = "1D",
    onPeriodChange,
    onNavigateToPositions,
    onNavigateToAllocation,
    onEditAsset,
    exchangeRates
}: MobileHomeTabProps) {
    const { currency } = useCurrency();
    const [selectedPeriod, setSelectedPeriod] = useState<Period>(defaultPeriod as Period);
    const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

    useEffect(() => {
        if (defaultPeriod) {
            setSelectedPeriod(defaultPeriod as Period);
        }
    }, [defaultPeriod]);

    // Use server-provided exchange rates with fallbacks
    const rates: Record<string, number> = {
        EUR: 1,
        USD: exchangeRates?.['USD'] || 1.09,
        TRY: exchangeRates?.['TRY'] || 38.5,
        GBP: exchangeRates?.['GBP'] || 0.85
    };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", GBP: "£" };

    const convert = (amount: number) => {
        if (currency === "ORG") return amount;
        return amount * (rates[currency] || 1);
    };
    const sym = currency === "ORG" ? "€" : symbols[currency] || "€";

    // Helper to get period-specific change percentage for an asset
    // Uses server-calculated historical percentages from AssetPriceHistory
    const getAssetChangePct = (asset: AssetDisplay, period: Period): number => {
        if (asset.type === 'CASH' || asset.type === 'BES') return 0;

        switch (period) {
            case "1D":
                // Use server-calculated changePercent1D from historical data
                // NOT previousClose vs currentPrice (those are often identical in cache)
                return asset.changePercent1D || 0;
            case "1W":
                return asset.changePercent1W || 0;
            case "1M":
                return asset.changePercent1M || 0;
            case "YTD":
                return asset.changePercentYTD || 0;
            case "1Y":
                return asset.changePercent1Y || 0;
            case "ALL":
                return asset.plPercentage || 0;
            default:
                return 0;
        }
    };

    // Calculate P&L based on selected period using server-provided historical data
    const { periodReturnEUR, periodReturnPct } = useMemo(() => {
        let returnEUR = 0;
        let returnPct = 0;

        if (totalValueEUR <= 0) return { periodReturnEUR: 0, periodReturnPct: 0 };

        // Calculate total return in EUR by applying each asset's period change to its EUR value
        const totalChangeEUR = assets.reduce((sum, asset) => {
            if (asset.type === 'CASH' || asset.type === 'BES') return sum;

            const changePct = getAssetChangePct(asset, selectedPeriod);
            // Convert percentage to EUR amount based on current value
            // For period returns: if asset changed X%, the EUR change is (X/100) * currentValueEUR
            // But we need to account for the fact that currentValue already includes the gain
            // So: previousValue = currentValue / (1 + changePct/100)
            // changeEUR = currentValue - previousValue
            if (changePct === 0) return sum;

            const previousValue = asset.totalValueEUR / (1 + changePct / 100);
            const changeEUR = asset.totalValueEUR - previousValue;

            return sum + changeEUR;
        }, 0);

        returnEUR = totalChangeEUR;
        const previousTotalValue = totalValueEUR - returnEUR;
        returnPct = previousTotalValue > 0 ? (returnEUR / previousTotalValue) * 100 : 0;

        return { periodReturnEUR: returnEUR, periodReturnPct: returnPct };
    }, [assets, totalValueEUR, selectedPeriod]);

    // Stats - include BES assets even if quantity is 0 (value comes from metadata)
    const openPositions = assets.filter((a) => a.quantity > 0.000001 || a.type === 'BES');
    const nonCashAssets = openPositions.filter((a) => a.type !== "CASH");

    // Sort by period-specific change percentage - get top 5 best and worst (no duplicate symbols)
    const { sortedByPL, topPerformers, bottomPerformers } = useMemo(() => {
        // First, deduplicate by symbol (keep first occurrence which has highest value after sort)
        const sorted = [...nonCashAssets].sort((a, b) =>
            getAssetChangePct(b, selectedPeriod) - getAssetChangePct(a, selectedPeriod)
        );

        // Get unique symbols for top performers
        const seenSymbols = new Set<string>();
        const top5: typeof sorted = [];
        for (const asset of sorted) {
            if (!seenSymbols.has(asset.symbol) && top5.length < 5) {
                seenSymbols.add(asset.symbol);
                top5.push(asset);
            }
        }

        // Get unique symbols for bottom performers (from the end, excluding top5 symbols)
        const bottom5: typeof sorted = [];
        for (let i = sorted.length - 1; i >= 0 && bottom5.length < 5; i--) {
            const asset = sorted[i];
            if (!seenSymbols.has(asset.symbol)) {
                seenSymbols.add(asset.symbol);
                bottom5.push(asset);
            }
        }

        return {
            sortedByPL: sorted,
            topPerformers: top5,
            bottomPerformers: bottom5
        };
    }, [nonCashAssets, selectedPeriod]);

    // Asset types count
    const uniqueTypes = new Set(assets.map((a) => a.type)).size;

    const handlePeriodChange = (period: Period) => {
        setSelectedPeriod(period);
        onPeriodChange?.(period);
        setIsPeriodMenuOpen(false);
    };

    const formatValue = (value: number, compact = false) => {
        const converted = convert(value);
        if (compact && Math.abs(converted) >= 1000) {
            return `${(converted / 1000).toFixed(1)}K${sym}`;
        }
        return `${converted.toLocaleString("de-DE", { maximumFractionDigits: 0 })}${sym}`;
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            height: "calc(100vh - 140px)", // Header + Bottom Nav
            overflow: "hidden"
        }}>
            {/* ===================== HERO CARD ===================== */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    background: "linear-gradient(135deg, var(--surface) 0%, var(--bg-secondary) 100%)",
                    borderRadius: "20px",
                    padding: "20px 18px",
                    position: "relative",
                    overflow: "hidden",
                    border: "1px solid var(--border)"
                }}
            >
                {/* Decorative orb */}
                <div
                    style={{
                        position: "absolute",
                        top: "-40px",
                        right: "-40px",
                        width: "120px",
                        height: "120px",
                        background: periodReturnEUR >= 0
                            ? "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)"
                            : "radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, transparent 70%)",
                        borderRadius: "50%"
                    }}
                />

                {/* Top row: Label + Period */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Portfolio Value
                    </span>
                    <div style={{ position: "relative" }} id="period-dropdown-anchor">
                        <button
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                setIsPeriodMenuOpen(!isPeriodMenuOpen);
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                borderRadius: "16px",
                                padding: "4px 10px",
                                cursor: "pointer",
                                color: "var(--text-primary)"
                            }}
                        >
                            <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>{selectedPeriod}</span>
                            <ChevronDown size={12} style={{ transform: isPeriodMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </button>

                        {isPeriodMenuOpen && (
                            <>
                                <div
                                    style={{ position: "fixed", inset: 0, zIndex: 999 }}
                                    onClick={() => setIsPeriodMenuOpen(false)}
                                />
                                <div
                                    style={{
                                        position: "fixed",
                                        top: dropdownPosition.top,
                                        right: dropdownPosition.right,
                                        background: "var(--surface)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "8px",
                                        padding: "3px",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                                        zIndex: 1000
                                    }}
                                >
                                    {(["1D", "1W", "1M", "YTD", "1Y", "ALL"] as Period[]).map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => handlePeriodChange(period)}
                                            style={{
                                                display: "block",
                                                width: "100%",
                                                background: selectedPeriod === period ? "var(--accent)" : "transparent",
                                                border: "none",
                                                borderRadius: "5px",
                                                padding: "4px 14px",
                                                fontSize: "0.65rem",
                                                fontWeight: 600,
                                                color: selectedPeriod === period ? "#fff" : "var(--text-primary)",
                                                cursor: "pointer",
                                                textAlign: "center"
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

                {/* Main value row: Value on left, P&L on right */}
                <div style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    {/* Left: Portfolio Value */}
                    <div
                        style={{
                            fontSize: "2rem",
                            fontWeight: 900,
                            color: "var(--text-primary)",
                            letterSpacing: "-0.03em",
                            lineHeight: 1
                        }}
                    >
                        {isPrivacyMode ? "••••••" : formatValue(totalValueEUR)}
                    </div>

                    {/* Right: P&L - separate badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                        {/* Percentage badge */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                background: periodReturnEUR >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                padding: "5px 8px",
                                borderRadius: "8px",
                                height: "28px"
                            }}
                        >
                            {periodReturnEUR >= 0 ? (
                                <ArrowUpRight size={12} color="#10b981" strokeWidth={2.5} />
                            ) : (
                                <ArrowDownRight size={12} color="#ef4444" strokeWidth={2.5} />
                            )}
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: periodReturnEUR >= 0 ? "#10b981" : "#ef4444" }}>
                                {periodReturnPct >= 0 ? "+" : ""}{periodReturnPct.toFixed(0)}%
                            </span>
                        </div>
                        {/* Amount badge */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                background: periodReturnEUR >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                padding: "5px 8px",
                                borderRadius: "8px",
                                height: "28px"
                            }}
                        >
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: periodReturnEUR >= 0 ? "#10b981" : "#ef4444" }}>
                                {isPrivacyMode ? "••••" : `${periodReturnEUR >= 0 ? "+" : ""}${formatValue(periodReturnEUR, true)}`}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ===================== STATS ROW ===================== */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {/* Positions */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    onClick={onNavigateToPositions}
                    style={{
                        background: "var(--surface)",
                        borderRadius: "14px",
                        padding: "14px 12px",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        textAlign: "center"
                    }}
                >
                    <Briefcase size={18} color="#6366f1" style={{ marginBottom: "6px" }} />
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
                        {openPositions.length}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Positions
                    </div>
                </motion.div>

                {/* Types */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={onNavigateToAllocation}
                    style={{
                        background: "var(--surface)",
                        borderRadius: "14px",
                        padding: "14px 12px",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        textAlign: "center"
                    }}
                >
                    <PieChart size={18} color="#8b5cf6" style={{ marginBottom: "6px" }} />
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
                        {uniqueTypes}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Asset Types
                    </div>
                </motion.div>

                {/* Today */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{
                        background: "var(--surface)",
                        borderRadius: "14px",
                        padding: "14px 12px",
                        border: "1px solid var(--border)",
                        textAlign: "center"
                    }}
                >
                    <BarChart3 size={18} color="#10b981" style={{ marginBottom: "6px" }} />
                    <div style={{
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        color: periodReturnEUR >= 0 ? "#10b981" : "#ef4444"
                    }}>
                        {isPrivacyMode ? "••" : `${periodReturnPct >= 0 ? "+" : ""}${periodReturnPct.toFixed(1)}%`}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        {selectedPeriod} Return
                    </div>
                </motion.div>
            </div>

            {/* ===================== TOP MOVERS - Top 5 Best & Worst ===================== */}
            {nonCashAssets.length > 1 && topPerformers.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{ display: "flex", gap: "10px" }}
                >
                    {/* Top 5 Best */}
                    <div
                        style={{
                            flex: 1,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "14px",
                            padding: "12px"
                        }}
                    >
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "10px"
                        }}>
                            <TrendingUp size={14} color="#10b981" />
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Top {selectedPeriod}
                            </span>
                        </div>
                        {topPerformers.map((asset, index) => {
                            const pct = getAssetChangePct(asset, selectedPeriod);
                            const isPositive = pct >= 0;
                            return (
                                <div
                                    key={`top-${asset.id || asset.symbol}-${index}`}
                                    onClick={() => onEditAsset?.(asset)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "6px 0",
                                        cursor: "pointer",
                                        borderTop: index > 0 ? "1px solid var(--border)" : "none"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <AssetLogo asset={asset} fallback={<div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--bg-secondary)" }} />} size={20} />
                                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                            {asset.symbol}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: isPositive ? "#10b981" : "#ef4444" }}>
                                        {isPositive ? "+" : ""}{pct.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Top 5 Worst */}
                    <div
                        style={{
                            flex: 1,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "14px",
                            padding: "12px"
                        }}
                    >
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "10px"
                        }}>
                            <TrendingDown size={14} color="#ef4444" />
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Bottom {selectedPeriod}
                            </span>
                        </div>
                        {bottomPerformers.map((asset, index) => {
                            const pct = getAssetChangePct(asset, selectedPeriod);
                            const isPositive = pct >= 0;
                            return (
                                <div
                                    key={`bottom-${asset.id || asset.symbol}-${index}`}
                                    onClick={() => onEditAsset?.(asset)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "6px 0",
                                        cursor: "pointer",
                                        borderTop: index > 0 ? "1px solid var(--border)" : "none"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <AssetLogo asset={asset} fallback={<div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--bg-secondary)" }} />} size={20} />
                                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                            {asset.symbol}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: isPositive ? "#10b981" : "#ef4444" }}>
                                        {isPositive ? "+" : ""}{pct.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

        </div>
    );
}
