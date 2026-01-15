"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import type { AssetDisplay } from "@/lib/types";
import { MobileAssetCard } from "./MobileAssetCard";

interface MobileAssetListProps {
    assets: AssetDisplay[];
    onEdit: (asset: AssetDisplay) => void;
    isCompact?: boolean;
    maxDisplay?: number;
    onViewAll?: () => void;
    onOpenSettings?: () => void;
    visibleFields?: any;
    isPrivacyMode?: boolean;
    highlightId?: string | null;
    onAdd?: () => void;
}

export function MobileAssetList({
    assets,
    onEdit,
    isCompact = false,
    maxDisplay,
    onViewAll,
    onOpenSettings,
    isPrivacyMode = false,
    highlightId,
    onAdd
}: MobileAssetListProps) {
    const { currency } = useCurrency();
    const [timeHorizon, setTimeHorizon] = useState('ALL');
    const [showTimeMenu, setShowTimeMenu] = useState(false);

    const timeOptions = ['1D', '1W', '1M', 'YTD', '1Y', 'ALL'];

    // If maxDisplay is set, slice. Otherwise show all.
    const displayAssets = maxDisplay ? assets.slice(0, maxDisplay) : assets;

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
            borderRadius: '16px',
            border: '1px solid var(--border)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)'
            }}>
                {/* Title Row */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isCompact ? 0 : '12px'
                }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {isCompact ? 'Top Positions' : 'All Assets'}
                    </div>

                    {/* Time Horizon Dropdown (only for non-compact) */}
                    {!isCompact && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowTimeMenu(!showTimeMenu)}
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        padding: '6px 10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        minWidth: '70px',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    {timeHorizon}
                                    <ChevronDown size={12} style={{ opacity: 0.6 }} />
                                </button>

                                {/* Dropdown Menu */}
                                {showTimeMenu && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                        zIndex: 100,
                                        minWidth: '80px',
                                        overflow: 'hidden'
                                    }}>
                                        {timeOptions.map(option => (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    setTimeHorizon(option);
                                                    setShowTimeMenu(false);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: timeHorizon === option ? 'var(--accent)' : 'transparent',
                                                    border: 'none',
                                                    color: timeHorizon === option ? '#fff' : 'var(--text-primary)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: timeHorizon === option ? 700 : 500,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (timeHorizon !== option) {
                                                        e.currentTarget.style.background = 'var(--bg-secondary)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (timeHorizon !== option) {
                                                        e.currentTarget.style.background = 'transparent';
                                                    }
                                                }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {onAdd && (
                                <button
                                    onClick={onAdd}
                                    style={{
                                        background: 'var(--accent)',
                                        border: 'none',
                                        color: '#fff',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
                                    ADD
                                </button>
                            )}
                        </div>
                    )}

                    {/* See All button for compact view */}
                    {onViewAll && isCompact && (
                        <button onClick={onViewAll} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                            SEE ALL
                        </button>
                    )}
                </div>

                {/* Table Header (only for non-compact) */}
                {!isCompact && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '38px 1fr 60px 65px 55px',
                        gap: '6px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border)'
                    }}>
                        <div></div> {/* Logo space */}
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            ASSET
                        </div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', letterSpacing: '0.05em' }}>
                            PRICE
                        </div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', letterSpacing: '0.05em' }}>
                            VALUE
                        </div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', letterSpacing: '0.05em' }}>
                            P&L
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            <div>
                {displayAssets.map((asset) => (
                    <MobileAssetCard
                        key={asset.id}
                        asset={asset}
                        currency={currency}
                        onEdit={onEdit}
                        isPrivacyMode={isPrivacyMode}
                        timeHorizon={timeHorizon}
                    />
                ))}
            </div>
        </div>
    );
}
