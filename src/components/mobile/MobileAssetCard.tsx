"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AssetDisplay } from "@/lib/types";

interface MobileAssetCardProps {
    asset: AssetDisplay;
    currency: string;
    onEdit: (asset: AssetDisplay) => void;
    isPrivacyMode?: boolean;
    timeHorizon?: string;
}

export function MobileAssetCard({ asset, currency, onEdit, isPrivacyMode, timeHorizon = 'ALL' }: MobileAssetCardProps) {
    const [expanded, setExpanded] = useState(false);

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺" };

    const convert = (amount: number, from: string) => {
        if (currency === 'ORG') return amount;
        const fromRate = rates[from] || 1;
        const toRate = rates[currency] || 1;
        return (amount / fromRate) * toRate;
    };

    const displayCurrency = currency === 'ORG' ? (asset.currency || 'EUR') : currency;
    const displaySymbol = symbols[displayCurrency] || displayCurrency;

    const currentPrice = asset.currentPrice || asset.buyPrice;
    const totalValue = convert(currentPrice * asset.quantity, asset.currency || 'EUR');
    const totalCost = convert(asset.buyPrice * asset.quantity, asset.currency || 'EUR');

    // P&L calculation based on time horizon (mock for now)
    const plFactors: Record<string, number> = {
        '1D': 0.2,
        '1W': 0.4,
        '1M': 0.6,
        'YTD': 0.8,
        '1Y': 0.9,
        'ALL': 1.0
    };
    const factor = plFactors[timeHorizon] || 1.0;
    const pl = (totalValue - totalCost) * factor;
    const plPct = totalCost > 0 ? (pl / totalCost) * 100 : 0;
    const isPositive = pl >= 0;

    // Get logo URL
    const logoUrl = asset.logoUrl || `https://logo.clearbit.com/${asset.symbol.toLowerCase()}.com`;

    return (
        <div style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'background 0.2s'
        }}
            onClick={() => setExpanded(!expanded)}
        >
            {/* Compact Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '38px 1fr 60px 65px 55px',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 12px'
            }}>
                {/* Logo */}
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    flexShrink: 0
                }}>
                    {asset.logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={asset.symbol}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.textContent = asset.symbol.substring(0, 1);
                            }}
                        />
                    ) : (
                        asset.symbol.substring(0, 1)
                    )}
                </div>

                {/* Name & Symbol */}
                <div style={{ minWidth: 0 }}>
                    <div style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2
                    }}>
                        {asset.name}
                    </div>
                    <div style={{
                        fontSize: '0.65rem',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        marginTop: '2px'
                    }}>
                        {asset.symbol}
                    </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        lineHeight: 1
                    }}>
                        {symbols[asset.currency || 'EUR']}{currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Value */}
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1
                    }}>
                        {isPrivacyMode ? '****' : `${displaySymbol}${totalValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
                    </div>
                </div>

                {/* P&L Badge */}
                <div style={{ textAlign: 'right' }}>
                    {asset.type !== 'CASH' && (
                        <div style={{
                            background: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isPositive ? '#10b981' : '#ef4444',
                            padding: '3px 5px',
                            borderRadius: '5px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            display: 'inline-block',
                            minWidth: '48px',
                            textAlign: 'center',
                            lineHeight: 1
                        }}>
                            {isPositive ? '+' : ''}{plPct.toFixed(1)}%
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div style={{
                    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
                    borderTop: '1px solid var(--border)',
                    padding: '16px',
                    animation: 'fadeIn 0.2s ease-out'
                }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Stats Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginBottom: '12px'
                    }}>
                        {/* Holdings */}
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>
                                HOLDINGS
                            </div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                {asset.quantity.toLocaleString()}
                            </div>
                        </div>

                        {/* Avg Cost */}
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>
                                AVG COST
                            </div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                {asset.buyPrice.toLocaleString()} {asset.currency}
                            </div>
                        </div>

                        {/* Total Cost */}
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>
                                TOTAL COST
                            </div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                {totalCost.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {displaySymbol}
                            </div>
                        </div>

                        {/* Total Value */}
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>
                                TOTAL VALUE
                            </div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                {totalValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {displaySymbol}
                            </div>
                        </div>
                    </div>

                    {/* P&L Breakdown */}
                    <div style={{
                        background: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        marginBottom: '12px'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>
                                    P&L ({timeHorizon})
                                </div>
                                <div style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 900,
                                    color: isPositive ? '#10b981' : '#ef4444'
                                }}>
                                    {isPositive ? '+' : ''}{pl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {displaySymbol}
                                </div>
                            </div>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: 900,
                                color: isPositive ? '#10b981' : '#ef4444'
                            }}>
                                {isPositive ? '+' : ''}{plPct.toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    {/* Edit Button */}
                    <button
                        onClick={() => onEdit(asset)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: '10px',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}
                        onMouseDown={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseUp={(e) => e.currentTarget.style.opacity = '1'}
                    >
                        Edit Position
                    </button>
                </div>
            )}
        </div>
    );
}
