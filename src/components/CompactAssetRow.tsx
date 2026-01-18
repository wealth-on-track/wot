"use client";

import React, { useState } from 'react';
import { getLogoUrl } from '@/lib/logos';
import { getCompanyName } from '@/lib/companyNames';
import { getRate, getCurrencySymbol } from '@/lib/currency';
import { Briefcase, MoreVertical, Edit2, Trash2 } from 'lucide-react';

interface CompactAssetRowProps {
    asset: any;
    positionsViewCurrency: string;
    exchangeRates?: Record<string, number>;
    isOwner: boolean;
    onDelete: (id: string) => void;
    onAssetClick?: (asset: any) => void;
    isGlobalEditMode?: boolean;
}

const COMPACT_GRID_TEMPLATE = "minmax(65px, 0.6fr) minmax(200px, 1fr) 130px 150px 140px 40px";

// Helper for Portfolio Styling (Duplicated from DashboardV2 to keep component self-contained or could be exported)
function getPortfolioStyle(name: string) {
    if (!name || name === '-') return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'transparent' };
    let hash = 0;
    const cleanName = name.toUpperCase();
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        { bg: 'rgba(59, 130, 246, 0.08)', text: '#1d4ed8', border: 'rgba(59, 130, 246, 0.12)' }, // Blue
        { bg: 'rgba(16, 185, 129, 0.08)', text: '#047857', border: 'rgba(16, 185, 129, 0.12)' }, // Emerald
        { bg: 'rgba(245, 158, 11, 0.08)', text: '#b45309', border: 'rgba(245, 158, 11, 0.12)' }, // Amber
        { bg: 'rgba(139, 92, 246, 0.08)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.12)' }, // Purple
        { bg: 'rgba(244, 63, 94, 0.08)', text: '#be123c', border: 'rgba(244, 63, 94, 0.12)' },  // Rose
        { bg: 'rgba(6, 182, 212, 0.08)', text: '#0e7490', border: 'rgba(6, 182, 212, 0.12)' }, // Cyan
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

export function CompactAssetRow({
    asset,
    positionsViewCurrency,
    exchangeRates,
    onAssetClick,
    isGlobalEditMode
}: CompactAssetRowProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Calculations
    const globalCurrency = positionsViewCurrency === 'ORG' ? 'EUR' : positionsViewCurrency;
    const globalRate = getRate(asset.currency, globalCurrency, exchangeRates);
    const globalSymbol = getCurrencySymbol(globalCurrency);
    const assetSymbol = getCurrencySymbol(asset.currency);

    const nativeTotalValue = asset.previousClose * asset.quantity;
    const nativeCostBasis = asset.buyPrice * asset.quantity;

    const globalTotalValue = globalCurrency === 'EUR' && asset.totalValueEUR > 0
        ? asset.totalValueEUR
        : nativeTotalValue * globalRate;

    const globalCostBasis = globalCurrency === 'EUR' && asset.totalValueEUR > 0
        ? asset.totalValueEUR / (1 + (asset.plPercentage / 100))
        : nativeCostBasis * globalRate;

    const totalProfitVal = globalTotalValue - globalCostBasis;
    const totalProfitPct = asset.plPercentage;
    const isProfit = totalProfitVal >= 0;

    // Formatting
    const fmt = (val: number, min = 2, max = 2) =>
        new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }).format(val || 0);

    // Explicit Colors
    const RED = '#ef4444';
    const GREEN = '#22c55e'; // Green-500

    // Portfolio Style
    const portfolioStyle = getPortfolioStyle(asset.customGroup);

    return (
        <div
            onClick={() => !isGlobalEditMode && onAssetClick?.(asset)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                display: 'grid',
                gridTemplateColumns: COMPACT_GRID_TEMPLATE,
                gap: '1rem', // Match header gap
                alignItems: 'center',
                padding: '0.4rem 0', // Vertical padding
                borderBottom: '1px solid var(--border)',
                background: isHovered ? 'var(--bg-secondary)' : 'transparent',
                cursor: isGlobalEditMode ? 'default' : 'pointer',
                transition: 'all 0.2s',
                height: '52px',
                position: 'relative'
            }}
        >
            {/* 1. Portfolio Info (Text Only) */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', paddingLeft: '0.5rem'
            }} title={asset.customGroup || 'Main'}>
                <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center'
                }}>
                    {asset.customGroup || 'Main'}
                </span>
            </div>

            {/* 2. Asset Info (Name + Ticker | Tag) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <img
                    src={asset.logoUrl || getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country)}
                    alt={asset.symbol}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${asset.symbol}&background=random` }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    {/* Top Row: Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {getCompanyName(asset.symbol, asset.type, asset.name)}
                        </span>
                    </div>
                    {/* Bottom Row: Ticker + Quantity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {asset.symbol}
                        </span>
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 600,
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-secondary)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border)'
                        }}>
                            x{fmt(asset.quantity, 0, 2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Price Pair: Price | Cost */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 1.5rem 0 0.5rem', width: '100%', textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {assetSymbol}{fmt(asset.previousClose)}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                    {assetSymbol}{fmt(asset.buyPrice)}
                </div>
            </div>

            {/* 4. Total Pair: Value | Cost */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 1.5rem 0 0.5rem', width: '100%', textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {globalSymbol}{fmt(globalTotalValue, 0, 0)}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                    {globalSymbol}{fmt(globalCostBasis, 0, 0)}
                </div>
            </div>

            {/* 5. P&L Pair: % | Amount */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isProfit ? <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `5px solid ${GREEN}` }} />
                        : <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `5px solid ${RED}` }} />}
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isProfit ? GREEN : RED }}>
                        {totalProfitPct.toFixed(1)}%
                    </div>
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isProfit ? GREEN : RED, opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                    {isProfit ? '+' : ''}{globalSymbol}{fmt(totalProfitVal, 0, 0)}
                </div>
            </div>

            {/* 6. Actions (Sticky) */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'sticky',
                right: 0,
                // background: isHovered ? 'var(--bg-secondary)' : 'var(--surface)', // Match row bg
                // BUT row bg changes on hover. If I set standard bg here, it might clip.
                // Best to be transparent? But "Sticky" needs background to cover content scroll.
                // DashboardV2 passes background Color.
                width: '40px',
                height: '100%'
            }}>
                <button
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className="hover:text-primary"
                >
                    <MoreVertical size={16} />
                </button>
            </div>

        </div>
    );
}
