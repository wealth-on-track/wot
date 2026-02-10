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
}

type Period = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

function AssetLogo({ asset, fallback, size = 20 }: { asset: AssetDisplay; fallback: React.ReactNode; size?: number }) {
    const [error, setError] = useState(false);
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
    onEditAsset
}: MobileHomeTabProps) {
    const { currency } = useCurrency();
    const [selectedPeriod, setSelectedPeriod] = useState<Period>(defaultPeriod as Period);
    const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);

    useEffect(() => {
        if (defaultPeriod) {
            setSelectedPeriod(defaultPeriod as Period);
        }
    }, [defaultPeriod]);

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5, GBP: 0.86 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", GBP: "£" };

    const convert = (amount: number) => {
        if (currency === "ORG") return amount;
        return amount * (rates[currency] || 1);
    };
    const sym = currency === "ORG" ? "€" : symbols[currency] || "€";

    // Calculate P&L
    const { periodReturnEUR, periodReturnPct } = useMemo(() => {
        let returnEUR = 0;
        let returnPct = 0;

        if (totalValueEUR > 0) {
            if (selectedPeriod === "1D" || selectedPeriod === "1W" || selectedPeriod === "1M") {
                // Calculate 1D return properly in EUR for each asset
                const total1D = assets.reduce((sum, asset) => {
                    // Skip CASH and BES - they don't have daily changes
                    if (asset.type === 'CASH' || asset.type === 'BES') return sum;

                    const prev = asset.previousClose || 0;
                    const curr = asset.currentPrice || 0;

                    // Calculate daily change percentage from prices
                    const dailyChangePct = prev > 0 ? ((curr - prev) / prev) : 0;

                    // Apply percentage to EUR value of position
                    const dailyChangeEUR = dailyChangePct * asset.totalValueEUR;

                    return sum + dailyChangeEUR;
                }, 0);
                returnEUR = total1D;
                const yesterdayValue = totalValueEUR - returnEUR;
                returnPct = yesterdayValue > 0 ? (returnEUR / yesterdayValue) * 100 : 0;
            } else {
                const totalCostEUR = assets.reduce((sum, asset) => {
                    if (asset.plPercentage === -100) return sum;
                    const cost = asset.totalValueEUR / (1 + asset.plPercentage / 100);
                    return sum + cost;
                }, 0);
                returnEUR = totalValueEUR - totalCostEUR;
                returnPct = totalCostEUR > 0 ? (returnEUR / totalCostEUR) * 100 : 0;
            }
        }

        return { periodReturnEUR: returnEUR, periodReturnPct: returnPct };
    }, [assets, totalValueEUR, selectedPeriod]);

    // Stats - include BES assets even if quantity is 0 (value comes from metadata)
    const openPositions = assets.filter((a) => a.quantity > 0.000001 || a.type === 'BES');
    const nonCashAssets = openPositions.filter((a) => a.type !== "CASH");
    const sortedByPL = [...nonCashAssets].sort((a, b) => b.plPercentage - a.plPercentage);
    const bestPerformer = sortedByPL[0];
    const worstPerformer = sortedByPL[sortedByPL.length - 1];

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
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
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
                                    style={{ position: "fixed", inset: 0, zIndex: 99 }}
                                    onClick={() => setIsPeriodMenuOpen(false)}
                                />
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "calc(100% + 6px)",
                                        right: 0,
                                        background: "var(--surface)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "12px",
                                        padding: "6px",
                                        minWidth: "80px",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                                        zIndex: 100
                                    }}
                                >
                                    {(["1D", "1W", "1M", "YTD", "1Y", "ALL"] as Period[]).map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => handlePeriodChange(period)}
                                            style={{
                                                width: "100%",
                                                background: selectedPeriod === period ? "var(--accent)" : "transparent",
                                                border: "none",
                                                borderRadius: "8px",
                                                padding: "8px 10px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                color: selectedPeriod === period ? "#fff" : "var(--text-primary)",
                                                textAlign: "center",
                                                cursor: "pointer"
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

                    {/* Right: P&L */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "2px"
                    }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                background: periodReturnEUR >= 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                                padding: "4px 8px",
                                borderRadius: "8px"
                            }}
                        >
                            {periodReturnEUR >= 0 ? (
                                <ArrowUpRight size={14} color="#10b981" strokeWidth={2.5} />
                            ) : (
                                <ArrowDownRight size={14} color="#ef4444" strokeWidth={2.5} />
                            )}
                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: periodReturnEUR >= 0 ? "#10b981" : "#ef4444" }}>
                                {periodReturnPct >= 0 ? "+" : ""}{periodReturnPct.toFixed(2)}%
                            </span>
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: periodReturnEUR >= 0 ? "#10b981" : "#ef4444", opacity: 0.85 }}>
                            {isPrivacyMode ? "••••" : `${periodReturnEUR >= 0 ? "+" : ""}${formatValue(periodReturnEUR, true)}`}
                        </span>
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

            {/* ===================== TOP MOVERS ===================== */}
            {nonCashAssets.length > 1 && bestPerformer && worstPerformer && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{ display: "flex", gap: "10px" }}
                >
                    {/* Best */}
                    <div
                        onClick={() => onEditAsset?.(bestPerformer)}
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "12px 14px",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "14px",
                            cursor: "pointer"
                        }}
                    >
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: "rgba(16, 185, 129, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                            }}
                        >
                            <AssetLogo asset={bestPerformer} fallback={<TrendingUp size={18} color="#10b981" />} size={22} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {bestPerformer.symbol}
                            </div>
                            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#10b981" }}>
                                +{bestPerformer.plPercentage.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Worst */}
                    <div
                        onClick={() => onEditAsset?.(worstPerformer)}
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "12px 14px",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "14px",
                            cursor: "pointer"
                        }}
                    >
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: "rgba(239, 68, 68, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                            }}
                        >
                            <AssetLogo asset={worstPerformer} fallback={<TrendingDown size={18} color="#ef4444" />} size={22} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {worstPerformer.symbol}
                            </div>
                            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#ef4444" }}>
                                {worstPerformer.plPercentage.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

        </div>
    );
}
