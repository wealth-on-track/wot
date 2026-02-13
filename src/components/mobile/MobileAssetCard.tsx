"use client";

import { memo, useState, useMemo, useCallback } from "react";
import type { AssetDisplay } from "@/lib/types";
import {
    motion,
    useMotionValue,
    useTransform,
    useAnimationControls,
    PanInfo,
    AnimatePresence
} from "framer-motion";
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MobileAssetCardProps {
    asset: AssetDisplay;
    currency: string;
    onEdit: (asset: AssetDisplay) => void;
    onDelete?: (asset: AssetDisplay) => void;
    isPrivacyMode?: boolean;
    totalPortfolioValue?: number;
    isCompactMode?: boolean;
    isTopList?: boolean;
    timeHorizon?: '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';
    highlightId?: string | null;
    isDndDragging?: boolean;
    exchangeRates?: Record<string, number>;
}

export const MobileAssetCard = memo(function MobileAssetCard({
    asset,
    currency,
    onEdit,
    onDelete,
    isPrivacyMode,
    totalPortfolioValue = 0,
    isCompactMode = false,
    isTopList = false,
    timeHorizon = '1D', // Default to 1D if not passed
    highlightId,
    isDndDragging = false,
    exchangeRates
}: MobileAssetCardProps) {
    // --- State & Motion ---
    const x = useMotionValue(0);
    const controls = useAnimationControls();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [swipeState, setSwipeState] = useState<'closed' | 'left' | 'right'>('closed');

    const isHighlighted = highlightId === asset.symbol;

    // Swipe limits
    const SWIPE_MAX = 80; // Maximum swipe distance
    const SWIPE_THRESHOLD = 40; // Threshold to snap open

    // Background button opacity based on drag
    const leftOpacity = useTransform(x, [0, SWIPE_MAX], [0, 1]);
    const rightOpacity = useTransform(x, [-SWIPE_MAX, 0], [1, 0]);

    // Background button scale for nice feedback
    const leftScale = useTransform(x, [0, SWIPE_MAX], [0.5, 1]);
    const rightScale = useTransform(x, [-SWIPE_MAX, 0], [1, 0.5]);

    // --- Currency Conversion (use server-provided rates) ---
    const rates: Record<string, number> = {
        EUR: 1,
        USD: exchangeRates?.['USD'] || 1.09,
        TRY: exchangeRates?.['TRY'] || 38.5,
        GBP: exchangeRates?.['GBP'] || 0.85
    };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", GBP: "£" };

    const convert = (amount: number, from: string) => {
        if (currency === 'ORG') return amount;
        const fromRate = rates[from] || 1;
        const toRate = rates[currency] || 1;
        return (amount / fromRate) * toRate;
    };

    // When user selects EUR (or any specific currency), always show that currency
    // Only use original currency when 'ORG' is selected
    const displayCurrency = currency === 'ORG' ? (asset.currency || 'EUR') : currency;
    const displaySymbol = currency === 'ORG' ? (symbols[asset.currency] || asset.currency) : (symbols[currency] || '€');

    // For Value/P&L column, ALWAYS use the user's selected currency (EUR if EUR is selected)
    // Never show ORG currency in this column
    const displaySymbolValuePL = symbols[currency] || '€';

    // --- Values & Calcs ---
    const currentPrice = asset.currentPrice || asset.buyPrice || 0;
    const totalCost = asset.buyPrice * asset.quantity;

    // Use server-calculated EUR values directly (real exchange rates)
    // Only convert from EUR to other display currencies if needed
    const displayTotalValue = currency === 'EUR'
        ? asset.totalValueEUR
        : convert(asset.totalValueEUR, 'EUR');

    // Use server-calculated totalCostEUR directly (no derivation needed)
    // Fallback to totalValueEUR if not available (shouldn't happen)
    const serverTotalCostEUR = asset.totalCostEUR ?? asset.totalValueEUR;
    const displayTotalCost = currency === 'EUR'
        ? serverTotalCostEUR
        : convert(serverTotalCostEUR, 'EUR');

    // These are used in the expandable panel and should show in original currency for reference
    const displayBuyPrice = asset.buyPrice;
    const displayCurrentPrice = currentPrice;

    // Smart Format Helper
    const smartFmt = (val: number) => {
        // If value >= 100, no decimals. Else 2 decimals.
        // Matches user rule: "2 digits use (small numbers), 3 digits don't (large numbers)"
        const digits = val >= 100 ? 0 : 2;
        return val.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    // Calculate P&L based on Time Horizon
    // Use server-calculated historical percentages from AssetHistory
    const pnlData = useMemo(() => {
        // Get pre-calculated percentages from server (based on historical data)
        const p_1d = (asset as any).changePercent1D || 0;
        const p_1w = (asset as any).changePercent1W || 0;
        const p_1m = (asset as any).changePercent1M || 0;
        const p_ytd = (asset as any).changePercentYTD || 0;
        const p_1y = (asset as any).changePercent1Y || 0;
        const totalPLPct = asset.plPercentage || 0;

        let pct = 0;

        switch (timeHorizon) {
            case '1D':
                pct = p_1d;
                break;
            case '1W':
                pct = p_1w;
                break;
            case '1M':
                pct = p_1m;
                break;
            case 'YTD':
                pct = p_ytd || totalPLPct; // Fallback to total if no YTD data
                break;
            case '1Y':
                pct = p_1y || totalPLPct; // Fallback to total if no 1Y data
                break;
            case 'ALL':
                pct = totalPLPct;
                break;
            default:
                pct = p_1d;
        }

        return { pct, isPositive: pct >= 0 };
    }, [timeHorizon, asset]);

    const changePct = pnlData.pct;
    const isPositive = pnlData.isPositive;

    const navVibrate = () => {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            window.navigator.vibrate(10);
        }
    };

    const handleDragEnd = (event: any, info: PanInfo) => {
        setIsDragging(false);
        const offset = info.offset.x;

        // If already open and dragging back toward center
        if (swipeState === 'right' && offset < -20) {
            // Close it
            controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
            setSwipeState('closed');
            return;
        }
        if (swipeState === 'left' && offset > 20) {
            // Close it
            controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
            setSwipeState('closed');
            return;
        }

        // Snap to open position if threshold passed
        if (offset > SWIPE_THRESHOLD) {
            navVibrate();
            controls.start({ x: SWIPE_MAX, transition: { type: "spring", stiffness: 500, damping: 30 } });
            setSwipeState('right');
        } else if (offset < -SWIPE_THRESHOLD) {
            navVibrate();
            controls.start({ x: -SWIPE_MAX, transition: { type: "spring", stiffness: 500, damping: 30 } });
            setSwipeState('left');
        } else {
            // Snap back to closed
            controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
            setSwipeState('closed');
        }
    };

    const handleEditClick = () => {
        navVibrate();
        controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
        setSwipeState('closed');
        onEdit(asset);
    };

    const handleDeleteClick = () => {
        navVibrate();
        controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
        setSwipeState('closed');
        if (onDelete) {
            onDelete(asset);
        }
    };

    // Weight Calculation (kept for logic if needed elsewhere, but removed from UI)
    const weight = (totalPortfolioValue > 0 && asset.totalValueEUR)
        ? (asset.totalValueEUR / totalPortfolioValue) * 100
        : 0;

    // For CASH assets, use currency symbol instead of trying to fetch logo
    const currencySymbols: Record<string, string> = { EUR: '€', USD: '$', TRY: '₺', GBP: '£' };
    const isCashAsset = asset.type === 'CASH';
    const logoUrl = asset.logoUrl || (isCashAsset ? null : `https://logo.clearbit.com/${asset.symbol.toLowerCase()}.com`);

    return (
        <div style={{ position: 'relative', overflow: 'hidden', marginBottom: '0' }}>

            {/* Background Actions Layer - Fixed position, revealed by card swipe */}
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: '16px',
                zIndex: 0,
                overflow: 'hidden'
            }}>
                {/* Left side - Edit (green) - shown when swiping RIGHT */}
                <div
                    onClick={swipeState === 'right' ? handleEditClick : undefined}
                    style={{
                        width: SWIPE_MAX + 20,
                        height: '100%',
                        background: 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingLeft: '20px',
                        cursor: swipeState === 'right' ? 'pointer' : 'default'
                    }}
                >
                    <motion.div style={{ opacity: leftOpacity, scale: leftScale, color: '#fff' }}>
                        <Edit2 size={22} strokeWidth={2.5} />
                    </motion.div>
                </div>

                {/* Right side - Delete (red) - shown when swiping LEFT */}
                <div
                    onClick={swipeState === 'left' ? handleDeleteClick : undefined}
                    style={{
                        width: SWIPE_MAX + 20,
                        height: '100%',
                        background: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingRight: '20px',
                        cursor: swipeState === 'left' ? 'pointer' : 'default'
                    }}
                >
                    <motion.div style={{ opacity: rightOpacity, scale: rightScale, color: '#fff' }}>
                        <Trash2 size={22} strokeWidth={2.5} />
                    </motion.div>
                </div>
            </div>

            {/* Foreground Card - Draggable with constraints */}
            <motion.div
                drag={isExpanded || isDndDragging ? false : "x"}
                dragConstraints={{ left: -SWIPE_MAX, right: SWIPE_MAX }}
                dragElastic={0.1}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                animate={controls}
                onClick={() => !isDragging && !isDndDragging && setIsExpanded(!isExpanded)}
                initial={false}
                style={{
                    x: isDndDragging ? 0 : x,
                    padding: isCompactMode ? '8px 10px' : '12px 14px',
                    borderRadius: '16px',
                    border: isDndDragging ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: isDndDragging ? 'var(--accent-muted, rgba(99, 102, 241, 0.15))' : (isExpanded ? 'var(--bg-secondary)' : 'var(--surface)'),
                    position: 'relative',
                    zIndex: 10,
                    cursor: isDndDragging ? 'grabbing' : 'pointer',
                    touchAction: 'pan-y',
                    boxShadow: isDndDragging ? '0 8px 32px rgba(99, 102, 241, 0.3)' : 'none',
                    transform: isDndDragging ? 'scale(1.02)' : undefined
                }}
                whileTap={!isDragging && !isDndDragging ? { scale: 0.995 } : undefined}
            >
                {/* Highlight animation overlay */}
                {isHighlighted && (
                    <motion.div
                        style={{
                            position: 'absolute',
                            inset: -1,
                            borderRadius: '16px',
                            pointerEvents: 'none',
                            zIndex: 100
                        }}
                        animate={{
                            boxShadow: [
                                "0 0 0 0px rgba(99, 102, 241, 0)",
                                "0 0 0 4px rgba(99, 102, 241, 0.4)",
                                "0 0 0 0px rgba(99, 102, 241, 0)",
                                "0 0 0 4px rgba(99, 102, 241, 0.4)",
                                "0 0 0 0px rgba(99, 102, 241, 0)"
                            ]
                        }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                    />
                )}

                {/* Main Content Row: 3 Columns */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>

                    {/* COL 1: Logo */}
                    <div style={{
                        width: isCompactMode ? '32px' : '42px',
                        height: isCompactMode ? '32px' : '42px',
                        borderRadius: '12px', // Slightly rounder
                        background: 'var(--bg-secondary)',
                        overflow: 'hidden',
                        border: '1px solid rgba(0,0,0,0.05)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {isCashAsset ? (
                            // CASH: Show currency symbol
                            <span style={{ fontWeight: 800, fontSize: isCompactMode ? '1.1rem' : '1.3rem' }}>
                                {currencySymbols[asset.symbol] || asset.symbol[0]}
                            </span>
                        ) : asset.logoUrl ? (
                            <img
                                src={logoUrl!}
                                alt={asset.symbol}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.textContent = asset.symbol.slice(0, 1);
                                }}
                            />
                        ) : (
                            <span style={{ fontWeight: 800, fontSize: asset.type === 'BES' ? '0.65rem' : (isCompactMode ? '0.8rem' : '1rem') }}>
                                {asset.type === 'BES' ? 'BES' : asset.symbol[0]}
                            </span>
                        )}
                    </div>

                    {/* COL 2: Name & Ticker */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                        {/* Row 1: Asset Name */}
                        <div style={{
                            fontSize: isCompactMode ? '0.85rem' : '0.9rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            lineHeight: 1.2
                        }}>
                            {asset.type === 'BES' ? 'BES' : (asset.name || asset.symbol)}
                        </div>

                        {/* Row 2: Ticker Symbol */}
                        {asset.type !== 'BES' && (
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                fontWeight: 500,
                            }}>
                                {asset.symbol}
                            </div>
                        )}
                    </div>

                    {/* COL 3: Price / Cost (Original Currency) - Stacked */}
                    {asset.type !== 'CASH' && (
                        <div style={{
                            textAlign: 'right',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '2px',
                            minWidth: '70px',
                            marginRight: '16px' // Bigger gap before Value/P&L
                        }}>
                            {asset.type === 'BES' ? (
                                <>
                                    <span style={{
                                        color: 'var(--text-muted)',
                                        fontWeight: 700,
                                        fontSize: '0.8rem'
                                    }}>
                                        -
                                    </span>
                                    <span style={{
                                        color: 'var(--text-muted)',
                                        fontWeight: 500,
                                        fontSize: '0.7rem'
                                    }}>
                                        -
                                    </span>
                                </>
                            ) : (() => {
                                const origSym = symbols[asset.currency] || asset.currency;
                                const p = asset.currentPrice || 0;
                                const c = asset.buyPrice || 0;
                                return (
                                    <>
                                        <span style={{
                                            color: 'var(--text-primary)',
                                            fontWeight: 700,
                                            fontSize: '0.8rem'
                                        }}>
                                            {origSym}{smartFmt(p)}
                                        </span>
                                        <span style={{
                                            color: 'var(--text-muted)',
                                            fontWeight: 500,
                                            fontSize: '0.7rem'
                                        }}>
                                            {origSym}{smartFmt(c)}
                                        </span>
                                    </>
                                );
                            })()}
                        </div>
                    )}


                    {/* COL 4: Value & P&L (User's Selected Currency - EUR if selected) */}
                    <div style={{
                        textAlign: 'right',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '2px',
                        minWidth: '80px' // Fixed width for alignment
                    }}>

                        {/* Total Value */}
                        <div style={{
                            fontSize: isCompactMode ? '0.9rem' : '1rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.02em',
                            lineHeight: 1.2
                        }}>
                            {isPrivacyMode ? '****' : `${displaySymbolValuePL}${smartFmt(displayTotalValue)}`}
                        </div>

                        {/* P&L Line: Amount • % */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            color: (asset.type === 'BES' || asset.type === 'CASH') ? 'var(--text-muted)' : (isPositive ? 'var(--success)' : 'var(--danger)'),
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                        }}>
                            {(asset.type === 'BES' || asset.type === 'CASH') ? (
                                <span>-</span>
                            ) : isCompactMode ? (
                                // Compact: Just %
                                <span>{isPositive ? '+' : ''}{Math.abs(changePct).toFixed(0)}%</span>
                            ) : (
                                // Normal: Amount • %
                                <>
                                    <span>
                                        {isPrivacyMode ? '****' : `${displaySymbolValuePL}${smartFmt(displayTotalValue - displayTotalCost)}`}
                                    </span>
                                    <span style={{ opacity: 0.5, fontSize: '0.6rem' }}>●</span>
                                    <span>
                                        {isPositive ? '+' : ''}{changePct.toFixed(1)}%
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* EXPANDABLE PANEL (Quick Stats) */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div style={{
                                borderTop: '1px dashed var(--border)',
                                marginTop: '12px',
                                paddingTop: '12px',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr 40px',
                                gap: '8px',
                                alignItems: 'center'
                            }}>
                                {/* Holdings (Larger space, Left Align) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>HOLDINGS</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                        {asset.type === 'CASH' ? '' : asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                    </span>
                                </div>

                                {/* Avg Cost (Center Align for Balance) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVG COST</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                        {isPrivacyMode ? '****' : `${displaySymbol}${smartFmt(displayBuyPrice)}`}
                                    </span>
                                </div>

                                {/* Total Cost (Right Align) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end', textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL COST</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                            {isPrivacyMode ? '****' : `${displaySymbol}${smartFmt(displayTotalCost)}`}
                                        </span>
                                    </div>
                                </div>

                                {/* Quick Edit Shortcut */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(asset);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '0',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    <Edit2 size={18} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
});
