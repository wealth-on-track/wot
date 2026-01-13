"use client";

import { useCurrency } from "@/context/CurrencyContext";
import type { AssetDisplay } from "@/lib/types";

interface MobileAssetListProps {
    assets: AssetDisplay[];
    onEdit: (asset: AssetDisplay) => void;
    isCompact?: boolean;
    maxDisplay?: number;
    onViewAll?: () => void;
    onOpenSettings?: () => void;
    visibleFields?: {
        portfolio: boolean;
        platform: boolean;
        quantity: boolean;
        cost: boolean;
        currentPrice: boolean;
    };
    isPrivacyMode?: boolean;
}

export function MobileAssetList({
    assets,
    onEdit,
    isCompact = false,
    maxDisplay,
    onViewAll,
    onOpenSettings,
    visibleFields = {
        portfolio: true,
        platform: true,
        quantity: true,
        cost: true,
        currentPrice: true
    },
    isPrivacyMode = false
}: MobileAssetListProps) {
    const { currency } = useCurrency();

    const rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 38.5 };
    const symbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺" };

    const convertToUserCurrency = (amount: number, fromCurrency: string) => {
        if (currency === 'ORG') return amount;
        const fromRate = rates[fromCurrency] || 1;
        const toRate = rates[currency] || 1;
        return (amount / fromRate) * toRate;
    };

    const displayAssets = maxDisplay ? assets.slice(0, maxDisplay) : assets;
    const hasMore = maxDisplay && assets.length > maxDisplay;

    if (assets.length === 0) {
        return (
            <div style={{
                background: 'var(--bg-primary)',
                borderRadius: '1rem',
                border: '1px solid var(--border)',
                padding: '2rem 1rem',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📊</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No positions yet</div>
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            border: '1px solid var(--border)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '0.65rem 0.85rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                }}>
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Positions
                    </div>
                    {onViewAll && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewAll();
                            }}
                            style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: 'var(--accent)',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            (View All)
                        </div>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <div style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        background: 'var(--bg-secondary)',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px'
                    }}>
                        {assets.length}
                    </div>
                    {onOpenSettings && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenSettings();
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0.2rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s',
                                WebkitTapHighlightColor: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--accent)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                        >
                            ⚙️
                        </button>
                    )}
                </div>
            </div>

            {/* Asset List - Ultra Compact */}
            <div>
                {displayAssets.map((asset, index) => {
                    const plPercentage = asset.plPercentage || 0;
                    const isPositive = plPercentage >= 0;
                    const currentPrice = asset.currentPrice || asset.buyPrice;

                    // Determine display currency
                    const assetOriginalCurrency = asset.currency || 'EUR';
                    const displayCurrency = currency === 'ORG' ? assetOriginalCurrency : currency;
                    const displaySymbol = symbols[displayCurrency] || displayCurrency;

                    // Convert prices if needed
                    const displayBuyPrice = convertToUserCurrency(asset.buyPrice, assetOriginalCurrency);
                    const displayCurrentPrice = convertToUserCurrency(currentPrice, assetOriginalCurrency);
                    const displayTotalValue = displayCurrentPrice * asset.quantity;
                    const displayPlAmount = displayTotalValue - (displayBuyPrice * asset.quantity);

                    return (
                        <div
                            key={asset.id}
                            onClick={() => onEdit(asset)}
                            style={{
                                padding: '0.6rem 0.85rem',
                                borderBottom: index < displayAssets.length - 1 ? '1px solid var(--border)' : 'none',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                                WebkitTapHighlightColor: 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                                minHeight: '44px'
                            }}
                            onTouchStart={(e) => {
                                e.currentTarget.style.background = 'var(--bg-secondary)';
                            }}
                            onTouchEnd={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            {/* Left: Asset Info */}
                            <div style={{
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem'
                            }}>
                                {/* Asset Name */}
                                <div
                                    title={(asset as any).originalName || asset.name || asset.symbol}
                                    style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        color: 'var(--text-primary)',
                                        lineHeight: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        cursor: 'default'
                                    }}>
                                    {asset.name || asset.symbol}
                                </div>

                                {/* For CASH: show nothing, For others: show quantity, cost, price based on visibleFields */}
                                {asset.type === 'CASH' ? null : (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        lineHeight: 1,
                                        color: 'var(--text-secondary)',
                                        flexWrap: 'wrap'
                                    }}>
                                        {visibleFields.portfolio && asset.customGroup && (
                                            <>
                                                <span>{asset.customGroup}</span>
                                                <span style={{ color: 'var(--border)' }}>|</span>
                                            </>
                                        )}
                                        {visibleFields.platform && asset.platform && (
                                            <>
                                                <span>{asset.platform}</span>
                                                <span style={{ color: 'var(--border)' }}>|</span>
                                            </>
                                        )}
                                        {visibleFields.quantity && (
                                            <>
                                                <span>x{asset.quantity.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</span>
                                                <span style={{ color: 'var(--border)' }}>|</span>
                                            </>
                                        )}
                                        {visibleFields.cost && (
                                            <>
                                                <span>C:{displayBuyPrice.toLocaleString('de-DE', { maximumFractionDigits: 2 })}{displaySymbol}</span>
                                                {visibleFields.currentPrice && <span style={{ color: 'var(--border)' }}>|</span>}
                                            </>
                                        )}
                                        {visibleFields.currentPrice && (
                                            <span>P:{displayCurrentPrice.toLocaleString('de-DE', { maximumFractionDigits: 2 })}{displaySymbol}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right: Value only (with P/L for non-CASH) */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: '0.25rem',
                                flexShrink: 0
                            }}>
                                {/* Total Value */}
                                <div style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 900,
                                    color: 'var(--text-primary)',
                                    lineHeight: 1,
                                    fontVariantNumeric: 'tabular-nums'
                                }}>
                                    {isPrivacyMode
                                        ? '****'
                                        : `${displayTotalValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}${displaySymbol}`
                                    }
                                </div>

                                {/* P/L % + Amount (only for non-CASH) */}
                                {asset.type !== 'CASH' && (
                                    <div style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: isPositive ? 'var(--success)' : 'var(--danger)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        lineHeight: 1
                                    }}>
                                        <span>{isPositive ? '▲' : '▼'}{Math.abs(plPercentage).toFixed(1)}%</span>
                                        <span style={{ opacity: 0.8 }}>
                                            {isPrivacyMode
                                                ? '****'
                                                : `${isPositive ? '+' : ''}${displaySymbol}${displayPlAmount.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>


        </div>
    );
}
