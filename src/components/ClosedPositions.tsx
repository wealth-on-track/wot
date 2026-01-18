"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { getClosedPositions, ClosedPosition } from "@/app/actions/history";
import { getLogoUrl } from "@/lib/logos";
import { formatEUR, formatNumber } from "@/lib/formatters";
import { EmptyPlaceholder } from "./EmptyPlaceholder";

// Helper to infer asset type for logo
const getAssetType = (pos: ClosedPosition) => {
    const ex = pos.exchange?.toUpperCase();
    if (ex === 'BINANCE' || ex === 'COINBASE') return 'CRYPTO';
    if (ex === 'TEFAS') return 'FUND';
    if (pos.name?.toLowerCase().includes('gold') || pos.symbol === 'XAU') return 'COMMODITY';
    return 'STOCK';
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
                const closed = data.filter(p => Math.abs(p.totalQuantityBought - p.totalQuantitySold) < 0.01);
                setPositions(closed);
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
            <div style={{ marginTop: '2rem' }}>
                <EmptyPlaceholder
                    title="No Closed Positions"
                    description="You haven't closed any positions yet."
                    icon={Inbox}
                    height="250px"
                />
            </div>
        );
    }

    // Strict Grid Alignment
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'minmax(160px, 3fr) 90px 60px 80px 100px 30px',
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
                ...gridStyle,
                padding: '0 0.8rem 0.4rem 0.8rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
            }}>
                <div>Asset</div>
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
                                    ...gridStyle,
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
                                        src={getLogoUrl(pos.symbol, getAssetType(pos), pos.exchange) || ''}
                                        alt={pos.symbol}
                                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pos.symbol}&background=random`
                                        }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden' }} title={pos.name || pos.symbol}>
                                            {pos.name || pos.symbol}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {pos.symbol}
                                        </span>
                                    </div>
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
                                        {[...pos.transactions]
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map((tx, idx) => (
                                                <div key={idx} style={{
                                                    ...gridStyle,
                                                    height: '28px', // Enforced strict height
                                                    borderBottom: idx === pos.transactions.length - 1 ? 'none' : '1px solid var(--border)',
                                                    opacity: 0.9,
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {/* Col 1: Empty or Current Price */}
                                                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '34px' }}>
                                                        {idx === 0 && pos.currentPrice && (
                                                            <div style={{
                                                                display: 'flex',
                                                                gap: '6px',
                                                                alignItems: 'center' // Changed from baseline to center for vertical stability
                                                            }}>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Current:</span>
                                                                <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                                                    <span style={{ opacity: 0.6, marginRight: '2px' }}>@</span>
                                                                    {pos.currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Col 2: Date */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                        {formatDate(tx.date)}
                                                    </div>

                                                    {/* Col 3: Type */}
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            fontSize: '0.7rem',
                                                            color: tx.type === 'BUY' ? GREEN : RED,
                                                        }}>
                                                            {tx.type}
                                                        </span>
                                                    </div>

                                                    {/* Col 4: Qty */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                        <span style={{ opacity: 0.6, marginRight: '2px' }}>x</span>
                                                        {tx.quantity.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                                    </div>

                                                    {/* Col 5: Price */}
                                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                                        <span style={{ opacity: 0.6, marginRight: '2px' }}>@</span>
                                                        {tx.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>

                                                    {/* Col 6: Empty */}
                                                    <div></div>
                                                </div>
                                            ))}
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
