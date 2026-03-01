"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Inbox, X, Wallet, Monitor } from "lucide-react";
import { getClosedPositions, ClosedPosition } from "@/app/actions/history";
import { getLogoUrl } from "@/lib/logos";
import { formatEUR, formatNumber } from "@/lib/formatters";
import { EmptyPlaceholder } from "./EmptyPlaceholder";
import { TransactionHistory } from "./TransactionHistory";
import { getPortfolioStyle } from "@/lib/portfolioStyles";

// Helper to infer asset type for logo
const getAssetType = (pos: ClosedPosition) => {
    const ex = pos.exchange?.toUpperCase();
    const platform = pos.platform?.toUpperCase();

    // Check exchange
    if (ex === 'BINANCE' || ex === 'COINBASE' || ex === 'CCC' || ex === 'KRAKEN') return 'CRYPTO';

    // Check platform (Kraken imports may have platform but not exchange)
    if (platform === 'KRAKEN' || platform === 'BINANCE' || platform === 'COINBASE') return 'CRYPTO';

    // Check symbol pattern (crypto symbols often have -EUR, -USD suffix)
    if (pos.symbol?.includes('-EUR') || pos.symbol?.includes('-USD')) return 'CRYPTO';

    if (ex === 'TEFAS') return 'FUND';
    if (pos.name?.toLowerCase().includes('gold') || pos.symbol === 'XAU') return 'COMMODITY';
    return 'STOCK';
};

const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function ClosedPositionsNew({ isOwner = true }: { isOwner?: boolean }) {
    const [positions, setPositions] = useState<ClosedPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());

    const refreshData = () => {
        setLoading(true);
        getClosedPositions()
            .then(data => {
                setPositions(data);
            })
            .catch(err => console.error('[ClosedPositionsNew] Error:', err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refreshData();
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
        gridTemplateColumns: '50px 80px minmax(140px, 3fr) 80px 50px 60px 80px 100px 30px',
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
                <div style={{ textAlign: 'center' }}><Wallet size={14} /></div>
                <div style={{ textAlign: 'center' }}><Monitor size={14} /></div>
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

                    return (
                        <div key={pos.symbol} className="neo-card" style={{
                            background: '#ffffff',
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
                                {/* Portfolio */}
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    {(() => {
                                        const name = (pos.customGroup || 'Main').toUpperCase();
                                        const style = getPortfolioStyle(name);
                                        return (
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                background: style.bg,
                                                border: `1px solid ${style.border}`,
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                color: style.text,
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                                whiteSpace: 'nowrap',
                                                textTransform: 'uppercase',
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                {name}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Platform */}
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    {pos.platform ? (
                                        <div title={pos.platform} style={{
                                            display: 'inline-flex',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border)',
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            color: 'var(--text-secondary)',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                            maxWidth: '60px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {pos.platform}
                                        </div>
                                    ) : (
                                        <Monitor size={12} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                                    )}
                                </div>

                                {/* Asset */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                    {(() => {
                                        const logoUrl = getLogoUrl(pos.symbol, getAssetType(pos), pos.exchange);
                                        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent((pos.symbol || 'X').charAt(0))}&background=6366f1&color=fff&size=64&bold=true`;
                                        return (
                                            <img
                                                src={logoUrl || fallbackUrl}
                                                alt={pos.symbol}
                                                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                onError={(e) => { e.currentTarget.src = fallbackUrl; }}
                                            />
                                        );
                                    })()}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden' }} title={pos.name || pos.symbol}>
                                                {pos.name || pos.symbol}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
                                <TransactionHistory
                                    symbol={pos.symbol}
                                    transactions={pos.transactions}
                                    onUpdate={refreshData}
                                    isOwner={isOwner}
                                    defaultCurrency={pos.currency}
                                    customGroup={pos.customGroup}
                                />
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
