"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Inbox, X } from "lucide-react";
import { getClosedPositions, ClosedPosition } from "@/app/actions/history";
import { getLogoUrl } from "@/lib/logos";
import { formatEUR, formatNumber } from "@/lib/formatters";
import { EmptyPlaceholder } from "./EmptyPlaceholder";

// Helper to infer asset type for logo
const getAssetType = (pos: ClosedPosition) => {
    const ex = pos.exchange?.toUpperCase() || '';
    const pl = pos.platform?.toUpperCase() || '';

    // Robust Crypto Detection - Priority 1
    if (pl === 'KRAKEN' || ex === 'KRAKEN' || ex === 'CCC' || ex === 'BINANCE' || ex === 'COINBASE') return 'CRYPTO';

    // Priority 2: Trust explicit valid types from DB
    if (pos.type === 'CRYPTO' || pos.type === 'FUND') return pos.type;

    if (ex === 'TEFAS') return 'FUND';
    if (pos.name?.toLowerCase().includes('gold') || pos.symbol === 'XAU') return 'COMMODITY';

    return 'STOCK'; // Default
};

const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function ClosedPositions() {
    const [positions, setPositions] = useState<ClosedPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());

    useEffect(() => {
        setLoading(true);
        getClosedPositions()
            .then(data => {
                // Server already filters correctly based on current quantity
                // No need for client-side filtering
                setPositions(data);
            })
            .catch(err => console.error('[ClosedPositions] Error:', err))
            .finally(() => setLoading(false));
    }, []);

    const sortedPositions = [...positions].sort((a, b) =>
        new Date(b.lastTradeDate).getTime() - new Date(a.lastTradeDate).getTime()
    );

    const toggleExpand = (symbol: string) => {
        setExpandedPositions(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) {
                next.delete(symbol);
            } else {
                next.add(symbol);
            }
            return next;
        });
    };

    const calculateHoldDays = (transactions: ClosedPosition['transactions']) => {
        if (transactions.length < 2) return 0;
        const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstDate = new Date(sorted[0].date);
        const lastDate = new Date(sorted[sorted.length - 1].date);
        return Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    };

    const calculateReturn = (pos: ClosedPosition) => {
        if (pos.totalInvested === 0) return 0;
        return (pos.realizedPnl / pos.totalInvested) * 100;
    };

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div className="animate-spin" style={{ margin: '0 auto 1rem', width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)', borderRadius: '50%' }} />
                <p style={{ fontSize: '0.9rem' }}>Loading...</p>
            </div>
        );
    }

    if (positions.length === 0) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '80px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
                marginTop: '1rem', border: '1px dashed var(--border)', textAlign: 'center'
            }}>
                <div style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
                    color: 'var(--text-muted)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <X size={32} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    No Closed Positions
                </h3>
                <p style={{
                    fontSize: '15px', color: 'var(--text-muted)', marginBottom: '0',
                    maxWidth: '400px', lineHeight: '1.6'
                }}>
                    Your closed positions will appear here once you sell any assets.
                </p>
            </div>
        );
    }

    // Grid for Main List (Summary Rows) - 7 Columns
    const mainGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'minmax(160px, 3fr) 90px 90px 60px 80px 100px 30px',
        gap: '0.5rem',
        alignItems: 'center'
    };

    // Grid for Transaction Details - 9 Columns (Running Balance)
    const detailGridStyle = {
        display: 'grid',
        gridTemplateColumns: '80px 90px 90px minmax(120px, 2fr) 90px 60px 80px 100px 30px',
        gap: '0.5rem',
        alignItems: 'center'
    };

    // Explicit colors
    const RED = '#ef4444';
    const GREEN = '#22c55e';

    return (
        <div style={{ marginTop: '1rem', paddingBottom: '2rem' }}>
            {/* Table Header */}
            <div style={{
                ...mainGridStyle,
                padding: '0 0.8rem 0.4rem 0.8rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
            }}>
                <div>Asset</div>
                <div style={{ textAlign: 'right' }}>Price</div>
                <div style={{ textAlign: 'right' }}>Tx</div>
                <div style={{ textAlign: 'right' }}>Held</div>
                <div style={{ textAlign: 'right' }}>P&L %</div>
                <div style={{ textAlign: 'right' }}>P&L €</div>
                <div></div>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {sortedPositions.map((pos) => {
                    const isExpanded = expandedPositions.has(pos.symbol);
                    const holdDays = calculateHoldDays(pos.transactions);
                    const returnPercent = calculateReturn(pos);
                    const pnl = pos.realizedPnl;
                    const isProfit = pnl >= 0;

                    const assetType = getAssetType(pos);
                    if (pos.symbol.includes('ETH')) {
                        console.log('[ClosedPositions Debug]', {
                            symbol: pos.symbol,
                            platform: pos.platform,
                            exchange: pos.exchange,
                            typeFromDB: pos.type,
                            inferredType: assetType
                        });
                    }
                    // Force generator for Crypto to ensure clean symbol (ETH-EUR -> ETH)
                    // This overrides potentially bad DB values (e.g. logo.dev with currency suffix)
                    const logoToUse = (assetType === 'CRYPTO')
                        ? getLogoUrl(pos.symbol, 'CRYPTO', pos.exchange)
                        : (pos.logoUrl || getLogoUrl(pos.symbol, assetType, pos.exchange));

                    return (
                        <div key={pos.symbol} className="neo-card" style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            transition: 'all 0.2s ease',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            {/* Summary Row */}
                            <div
                                onClick={() => toggleExpand(pos.symbol)}
                                style={{
                                    ...mainGridStyle,
                                    padding: '0.5rem 0.8rem',
                                    cursor: 'pointer',
                                    background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                                    transition: 'background 0.2s'
                                }}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                {/* Asset */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                    <img
                                        src={logoToUse || ''}
                                        alt={pos.symbol}
                                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pos.symbol}&background=random`
                                        }}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {pos.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {pos.symbol}
                                        </div>
                                    </div>
                                </div>

                                {/* Price */}
                                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                    {pos.currentPrice ? pos.currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                </div>

                                {/* Tx */}
                                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {pos.transactions.length}
                                </div>

                                {/* Held */}
                                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {holdDays}d
                                </div>

                                {/* P&L % */}
                                <div style={{
                                    textAlign: 'right',
                                    fontWeight: 600,
                                    color: isProfit ? GREEN : RED,
                                    fontSize: '0.8rem'
                                }}>
                                    {isProfit ? '+' : ''}{returnPercent.toFixed(1)}%
                                </div>

                                {/* P&L Amount */}
                                <div style={{
                                    textAlign: 'right',
                                    fontWeight: 600,
                                    color: isProfit ? GREEN : RED,
                                    fontSize: '0.8rem'
                                }}>
                                    {isProfit ? '+' : ''}{formatEUR(pnl)}
                                </div>

                                {/* Icon */}
                                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div style={{
                                    borderTop: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)',
                                    padding: '0.5rem 0.8rem',
                                    animation: 'fadeIn 0.2s ease-out'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                        {/* Header Row for Details */}
                                        <div style={{
                                            ...detailGridStyle,
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            paddingBottom: '0.5rem',
                                            marginBottom: '0.2rem',
                                            borderBottom: '1px dashed var(--border)',
                                            opacity: 0.7
                                        }}>
                                            <div style={{ textAlign: 'right' }}>Total Amt</div>
                                            <div style={{ textAlign: 'right' }}>Avg. Cost</div>
                                            <div style={{ textAlign: 'right' }}>Value</div>
                                            <div></div>
                                            <div style={{ textAlign: 'right' }}>Date</div>
                                            <div style={{ textAlign: 'right' }}>Type</div>
                                            <div style={{ textAlign: 'right' }}>Qty</div>
                                            <div style={{ textAlign: 'right' }}>Price</div>
                                            <div></div>
                                        </div>
                                        {(() => {
                                            // Calculate running balance for each transaction
                                            const sortedTxs = [...pos.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                            let runningQty = 0;
                                            let totalCost = 0;

                                            const txsWithBalance = sortedTxs.map(tx => {
                                                const qty = Number(tx.quantity);
                                                const price = Number(tx.price);

                                                if (tx.type === 'BUY') {
                                                    runningQty += qty;
                                                    totalCost += (qty * price);
                                                } else if (tx.type === 'SELL') {
                                                    const soldPortion = runningQty > 0 ? qty / runningQty : 0;
                                                    totalCost = totalCost * (1 - soldPortion);
                                                    runningQty -= qty;
                                                }

                                                const avgCost = runningQty > 0 ? totalCost / runningQty : 0;
                                                const value = runningQty * avgCost;

                                                return {
                                                    ...tx,
                                                    runningQty,
                                                    avgCost,
                                                    value
                                                };
                                            });

                                            // Reverse to show newest first
                                            return txsWithBalance.reverse().map((tx, idx) => (
                                                <div key={idx} style={{
                                                    ...detailGridStyle,
                                                    height: '28px',
                                                    borderBottom: idx === txsWithBalance.length - 1 ? 'none' : '1px solid var(--border)',
                                                    opacity: 0.9,
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {/* Col 1: Running Qty */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {tx.runningQty.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                    </div>

                                                    {/* Col 2: Avg Cost */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {tx.avgCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>

                                                    {/* Col 3: Value */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {tx.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>

                                                    {/* Col 4: Asset Name (empty now as current price is moved to summary) */}
                                                    <div></div>

                                                    {/* Col 5: Date */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                        {formatDate(tx.date)}
                                                    </div>

                                                    {/* Col 6: Type */}
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            fontSize: '0.7rem',
                                                            color: tx.type === 'BUY' ? GREEN : RED,
                                                        }}>
                                                            {tx.type}
                                                        </span>
                                                    </div>

                                                    {/* Col 7: Tx Qty */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                        <span style={{ opacity: 0.6, marginRight: '2px' }}>x</span>
                                                        {tx.quantity.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                    </div>

                                                    {/* Col 8: Tx Price */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                                        <span style={{ opacity: 0.6, marginRight: '2px' }}>@</span>
                                                        {tx.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>

                                                    {/* Col 9: Empty */}
                                                    <div></div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
