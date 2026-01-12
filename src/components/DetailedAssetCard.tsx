"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateAsset } from "@/lib/actions";
import { Settings, Save, X, Trash2 } from "lucide-react";
import { ASSET_COLORS } from "@/lib/constants";
import { getLogoUrl } from "@/lib/logos";
import { AssetDisplay } from "@/lib/types";
import { getRate, getCurrencySymbol } from "@/lib/currency";
import { getCompanyName } from "@/lib/companyNames";

/* Local Logo Component (mirroring Dashboard) */
const AssetLogo = ({ symbol, logoUrl, size = '3rem' }: { symbol: string, logoUrl?: string | null, size?: string }) => {
    const [error, setError] = useState(false);

    // Reset error state when logoUrl changes
    useEffect(() => {
        setError(false);
    }, [logoUrl]);

    const logoStyle: React.CSSProperties = {
        width: size, height: size, borderRadius: 'var(--radius-md)', objectFit: 'cover',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
    };
    if (logoUrl && !error) {
        return <img src={logoUrl} alt={symbol} onError={() => setError(true)} style={logoStyle} />;
    }
    return (
        <div style={{
            ...logoStyle, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size === '2rem' ? '0.8rem' : '1.1rem', fontWeight: 900, color: '#fff',
            letterSpacing: '-0.05em'
        }}>
            {symbol.slice(0, 2).toUpperCase()}
        </div>
    );
};

interface DetailedAssetCardProps {
    asset: AssetDisplay;
    positionsViewCurrency: string;
    totalPortfolioValueEUR: number;
    isBlurred: boolean;
    isOwner: boolean;
    onDelete: (id: string) => void;
    timeFactor?: number;
    timePeriod?: string;
    exchangeRates?: Record<string, number>;
}

export function DetailedAssetCard({
    asset,
    positionsViewCurrency,
    totalPortfolioValueEUR,
    isBlurred,
    isOwner,
    onDelete,
    timeFactor,
    timePeriod,
    exchangeRates
}: DetailedAssetCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [editQty, setEditQty] = useState(asset.quantity);
    const [editCost, setEditCost] = useState(asset.buyPrice);
    const [justUpdated, setJustUpdated] = useState(false);

    // Logic for Values (Copy from AssetCard)
    let displayCurrency = positionsViewCurrency === 'ORG' ? asset.currency : positionsViewCurrency;
    const currencySymbol = getCurrencySymbol(displayCurrency);

    let totalVal = 0;
    let totalCost = 0;
    let unitPrice = 0;

    if (positionsViewCurrency === 'ORG') {
        totalVal = (asset.currentPrice || asset.previousClose) * asset.quantity;
        totalCost = asset.buyPrice * asset.quantity;
        unitPrice = asset.currentPrice || asset.previousClose;
    } else {
        const targetRate = getRate('EUR', displayCurrency, exchangeRates);
        totalVal = asset.totalValueEUR * targetRate;
        const costEUR = asset.totalValueEUR / (1 + asset.plPercentage / 100);
        totalCost = costEUR * targetRate;
        unitPrice = (asset.totalValueEUR / asset.quantity) * targetRate;
    }

    const profit = totalVal - totalCost;
    const profitPct = asset.plPercentage;
    const periodProfitVal = profit; // Simplified: Always Total P/L
    const periodProfitPctVal = profitPct;

    // Use logoUrl from database if available, otherwise generate it
    const logoUrl = (asset as any).logoUrl || getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleSave = async () => {
        try {
            await updateAsset(asset.id, { quantity: editQty, buyPrice: editCost });
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 2000);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error("Failed to update asset", error);
        }
    };

    return (
        <div
            className="neo-card detailed-asset-card"
            style={{
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                position: 'relative',
                border: `1px solid ${justUpdated ? 'var(--success)' : isEditing ? 'var(--accent)' : 'var(--border)'}`,
                background: 'var(--bg-primary)',
                filter: isBlurred ? 'blur(12px)' : 'none',
                boxShadow: justUpdated ? '0 0 20px var(--success-bg)' : 'var(--shadow-md)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                height: '100%',
                justifyContent: 'space-between',
                overflow: 'hidden'
            }}
        >
            {/* Header: Logo, Ticker, Type, PL Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <AssetLogo symbol={asset.symbol} logoUrl={logoUrl} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="truncate-text" style={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{companyName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{asset.symbol} • {asset.type}</div>
                    </div>
                </div>

                {/* PL Badge */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: periodProfitVal >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${periodProfitVal >= 0 ? 'var(--success)' : 'var(--danger)'}40`
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: periodProfitVal >= 0 ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                        {periodProfitVal >= 0 ? '+' : ''}{fmt(periodProfitPctVal)}%
                    </span>
                </div>
            </div>

            {/* Editing Form Overlay or Normal View */}
            {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, animation: 'fadeIn 0.2s ease' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quantity</label>
                        <input
                            type="number"
                            value={editQty}
                            onChange={e => setEditQty(Number(e.target.value))}
                            style={{ padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cost ({asset.currency})</label>
                        <input
                            type="number"
                            value={editCost}
                            onChange={e => setEditCost(Number(e.target.value))}
                            style={{ padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                        <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 800, cursor: 'pointer' }}>Update</button>
                        <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    </div>
                    <button onClick={() => onDelete(asset.id)} style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)40', borderRadius: 'var(--radius-md)', marginTop: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}><Trash2 size={16} style={{ marginRight: '0.5rem' }} /> Delete Asset</button>
                </div>
            ) : (
                <>
                    {/* Main Body: Value & Positions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Current Equity</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                                {currencySymbol}{fmt(totalVal)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Quantity</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                {fmt(asset.quantity)}
                            </span>
                        </div>
                    </div>

                    {/* Performance Visualizer */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{
                            height: '6px',
                            width: '100%',
                            borderRadius: '10px',
                            background: 'var(--bg-secondary)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${Math.min(Math.max(50 + profitPct, 10), 100)}%`,
                                background: profitPct >= 0 ? 'var(--success)' : 'var(--danger)',
                                borderRadius: '10px',
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 500 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Cost: <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{currencySymbol}{fmt(totalCost)}</span></span>
                            <span style={{ color: 'var(--text-secondary)' }}>Price: <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{currencySymbol}{fmt(unitPrice)}</span></span>
                        </div>
                    </div>

                    {/* Edit Trigger */}
                    {isOwner && (
                        <div style={{ position: 'absolute', top: '1.25rem', right: '4.5rem' }}>
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '0.4rem',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                            >
                                <Settings size={14} />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
