"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAsset } from "@/lib/actions";
import { Settings, Save, X, Trash2 } from "lucide-react";
import { ASSET_COLORS } from "@/lib/constants";
import { getLogoUrl } from "@/lib/logos";
import { AssetDisplay } from "@/lib/types";
import { RATES } from "@/lib/currency";

import { getCompanyName } from "@/lib/companyNames";
import { formatEUR } from "@/lib/formatters";

// Helper Functions removed (Imported from @/lib)

// Local getLogoUrl removed. Imported from @/lib/logos instead.

const AssetLogo = ({ symbol, logoUrl, size = '3rem' }: { symbol: string, logoUrl?: string | null, size?: string }) => {
    const [error, setError] = useState(false);
    const logoStyle: React.CSSProperties = {
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.05)'
    };
    if (logoUrl && !error) {
        return <img src={logoUrl} alt={symbol} onError={() => setError(true)} style={logoStyle} />;
    }
    return (
        <div style={{
            ...logoStyle, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(236, 72, 153, 0.3))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size === '2rem' ? '0.8rem' : '1rem', fontWeight: 700, color: 'var(--text-primary)'
        }}>
            {symbol.charAt(0)}
        </div>
    );
};

// Types
// AssetDisplay imported from @/lib/types

interface DetailedAssetCardProps {
    asset: AssetDisplay;
    positionsViewCurrency: string;
    totalPortfolioValueEUR: number;
    isBlurred: boolean;
    isOwner: boolean;
    onDelete: (id: string) => void;
    timeFactor: number;
}

export function DetailedAssetCard({
    asset,
    positionsViewCurrency,
    totalPortfolioValueEUR,
    isBlurred,
    isOwner,
    onDelete,
    timeFactor
}: DetailedAssetCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [editQty, setEditQty] = useState(asset.quantity);
    const [editCost, setEditCost] = useState(asset.buyPrice);
    const [isSaving, setIsSaving] = useState(false);
    const [justUpdated, setJustUpdated] = useState(false);

    // Currency Logic
    // Currency Logic: RATES imported from @/lib/currency
    const displayCurrency = positionsViewCurrency === 'ORIGINAL' ? asset.currency : positionsViewCurrency;
    const currencySymbol = displayCurrency === 'EUR' ? '€' : displayCurrency === 'USD' ? '$' : displayCurrency === 'TRY' ? '₺' : asset.currency;

    let totalVal = 0;
    let totalCost = 0;
    let unitPrice = 0;
    let unitCost = 0;

    if (positionsViewCurrency === 'ORIGINAL') {
        totalVal = asset.currentPrice * asset.quantity;
        totalCost = asset.buyPrice * asset.quantity;
        unitPrice = asset.currentPrice;
        unitCost = asset.buyPrice;
    } else {
        const targetRate = RATES[positionsViewCurrency] || 1;
        totalVal = asset.totalValueEUR * targetRate;
        const costEUR = asset.totalValueEUR / (1 + asset.plPercentage / 100);
        totalCost = costEUR * targetRate;
        unitPrice = (asset.totalValueEUR / asset.quantity) * targetRate;
        unitCost = (costEUR / asset.quantity) * targetRate;
    }

    const profit = totalVal - totalCost;
    const profitPct = asset.plPercentage;
    const periodProfitVal = profit * timeFactor;
    const periodProfitPctVal = profitPct * timeFactor;

    const logoUrl = getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSaving) return;
        setIsSaving(true);
        const res = await updateAsset(asset.id, { quantity: Number(editQty), buyPrice: Number(editCost) });
        if (res.error) {
            alert(res.error);
        } else {
            setIsEditing(false);
            setJustUpdated(true);
            router.refresh();
            setTimeout(() => setJustUpdated(false), 2000);
        }
        setIsSaving(false);
    };

    return (
        <div
            className="glass-panel detailed-asset-card"
            style={{
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                position: 'relative',
                border: `1px solid ${justUpdated ? '#10b981' : isEditing ? '#f59e0b' : 'var(--glass-border)'}`,
                background: 'var(--glass-bg)',
                filter: isBlurred ? 'blur(8px)' : 'none',
                boxShadow: justUpdated ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none',
                transition: 'all 0.3s ease',
                height: '100%',
                justifyContent: 'space-between'
            }}
        >
            {/* Header: Logo, Ticker, Type, PL Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <AssetLogo symbol={asset.symbol} logoUrl={logoUrl} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="truncate-text" style={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>{companyName}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '2px', fontWeight: 600 }}>{asset.symbol} • {asset.type}</div>
                    </div>
                </div>

                {/* PL Badge */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: periodProfitVal >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '0.5rem',
                    border: periodProfitVal >= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                    <span style={{ fontSize: '0.7rem', color: periodProfitVal >= 0 ? '#10b981' : '#ef4444' }}>
                        {periodProfitVal >= 0 ? '↗' : '↘'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: periodProfitVal >= 0 ? '#10b981' : '#ef4444' }}>
                        {fmt(Math.abs(periodProfitPctVal))}%
                    </span>
                </div>
            </div>

            {/* Editing Form Overlay or Normal View */}
            {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
                    {/* Simplified Edit Fields */}
                    <div>
                        <label style={{ fontSize: '0.7rem', opacity: 0.6 }}>Quantity</label>
                        <input type="number" value={editQty} onChange={e => setEditQty(Number(e.target.value))} className="glass-input" style={{ width: '100%', padding: '0.5rem' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', opacity: 0.6 }}>Cost ({asset.currency})</label>
                        <input type="number" value={editCost} onChange={e => setEditCost(Number(e.target.value))} className="glass-input" style={{ width: '100%', padding: '0.5rem' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        <button onClick={handleSave} style={{ flex: 1, padding: '0.5rem', background: '#10b981', color: 'black', borderRadius: '0.4rem', fontWeight: 'bold' }}>Save</button>
                        <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.4rem' }}>Cancel</button>
                    </div>
                    <button onClick={() => { if (confirm('Delete?')) onDelete(asset.id) }} style={{ padding: '0.5rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '0.4rem', marginTop: '0.5rem' }}><Trash2 size={16} /></button>
                </div>
            ) : (
                <>
                    {/* Main Body: Value & Positions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 600, letterSpacing: '0.05em' }}>CURRENT VALUE</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
                                {currencySymbol}{fmt(totalVal)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 600, letterSpacing: '0.05em' }}>POSITIONS</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                                {fmt(asset.quantity)} {asset.symbol}
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar Separator */}
                    <div style={{
                        height: '4px',
                        width: '100%',
                        borderRadius: '2px',
                        background: 'rgba(255,255,255,0.1)',
                        overflow: 'hidden',
                        margin: '0.5rem 0'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min(Math.max(50 + profitPct, 10), 100)}%`, // Dynamic width based on performance
                            background: profitPct >= 0 ? '#10b981' : '#ef4444',
                            borderRadius: '2px'
                        }} />
                    </div>

                    {/* Footer: Cost & Market Price */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>Cost: <span style={{ opacity: 0.8 }}>{currencySymbol}{fmt(totalCost)}</span></span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>Market: <span style={{ opacity: 0.8 }}>{currencySymbol}{fmt(unitPrice)}</span></span>
                        </div>
                    </div>

                    {/* Edit Trigger (Hover-only ideally, but button for now) */}
                    {isOwner && (
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    padding: '0.2rem'
                                }}
                                className="hover:text-white"
                            >
                                <Settings size={16} />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
