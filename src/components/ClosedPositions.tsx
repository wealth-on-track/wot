"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Clock, Award, CheckCircle2 } from "lucide-react";
import { getClosedPositions, ClosedPosition } from "@/app/actions/history";

// Elite Color Palette
const COLORS = {
    bg: '#121212',         // Off-black
    cardBg: '#1E1E1E',     // Lighter off-black for cards
    textMain: '#FFFFFF',   // Pure White
    textSec: '#94A3B8',    // Silver/Grey
    success: '#2DBC8E',    // Elite Emerald Green
    error: '#EB5757',      // Elite Ruby Red
    gold: '#D4AF37',       // Gold
    border: 'rgba(255, 255, 255, 0.1)'
};

const formatCurrency = (val: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency }).format(val);
};

const formatNumber = (val: number) => {
    return new Intl.NumberFormat('de-DE').format(val);
};

const formatPercent = (val: number) => {
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val) + '%';
};

export function ClosedPositions() {
    const [isOpen, setIsOpen] = useState(false);
    const [positions, setPositions] = useState<ClosedPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());

    // Group States - INITIALLY CLOSED
    const [showClosedGroup, setShowClosedGroup] = useState(false);
    const [showActiveGroup, setShowActiveGroup] = useState(false);

    useEffect(() => {
        setLoading(true);
        getClosedPositions()
            .then(data => setPositions(data))
            .catch(err => console.error('[ClosedPositions] Error:', err))
            .finally(() => setLoading(false));
    }, []);

    // Sort positions by last trade date (most recent first)
    const sortedPositions = [...positions].sort((a, b) =>
        new Date(b.lastTradeDate).getTime() - new Date(a.lastTradeDate).getTime()
    );

    const totalCount = positions.length;
    const profitableCount = positions.filter(p => p.realizedPnl > 0).length;
    const winRate = totalCount > 0 ? (profitableCount / totalCount) * 100 : 0;

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
        // Ensure sorted by date
        const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstDate = new Date(sorted[0].date);
        const lastDate = new Date(sorted[sorted.length - 1].date);
        return Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    };

    const calculateReturn = (pos: ClosedPosition) => {
        if (pos.totalInvested === 0) return 0;
        return (pos.realizedPnl / pos.totalInvested) * 100;
    };

    // Helper to render a position card
    const renderCard = (pos: ClosedPosition, idx: number) => {
        const isExpanded = expandedPositions.has(pos.symbol);
        const pnl = pos.realizedPnl || 0;
        const isProfit = pnl >= 0;
        const posColor = isProfit ? COLORS.success : COLORS.error;
        const holdDays = calculateHoldDays(pos.transactions);
        const returnPercent = calculateReturn(pos);
        const isClosed = Math.abs(pos.totalQuantityBought - pos.totalQuantitySold) < 0.01;
        const netQuantity = pos.totalQuantityBought - pos.totalQuantitySold;

        return (
            <div key={`${pos.symbol}-${idx}`} style={{ marginBottom: isExpanded ? '12px' : '0' }}>
                {/* Mobile Ledger Card - Off-Black Theme */}
                <div
                    onClick={() => toggleExpand(pos.symbol)}
                    style={{
                        height: '76px',
                        padding: '0 1rem',
                        background: COLORS.cardBg,
                        border: `1px solid rgba(255, 255, 255, 0.08)`,
                        borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                        borderBottom: isExpanded ? 'none' : `1px solid rgba(255, 255, 255, 0.08)`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        zIndex: 10,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                    }}
                    className="group hover:border-white/20 hover:scale-[1.01]"
                >
                    {/* Left: Asset & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* Asset Logo Placeholder */}
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #2A2A2A, #333333)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: COLORS.textSec,
                            fontFamily: 'Inter, system-ui, sans-serif'
                        }}>
                            {pos.symbol.substring(0, 2)}
                        </div>

                        {/* Ticker & Context */}
                        <div>
                            <div style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: COLORS.textMain,
                                fontFamily: 'Inter, system-ui, sans-serif',
                                lineHeight: 1.2,
                                marginBottom: '4px',
                                letterSpacing: '-0.01em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span title={pos.name || pos.symbol}>
                                    {(pos.name || pos.symbol).length > 35
                                        ? (pos.name || pos.symbol).substring(0, 35) + '...'
                                        : (pos.name || pos.symbol)}
                                </span>
                                <span style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 400,
                                    color: COLORS.textSec,
                                    opacity: 0.7
                                }}>| {pos.symbol}</span>
                            </div>
                            <div style={{
                                fontSize: '0.7rem',
                                color: COLORS.textSec,
                                fontFamily: 'Inter, system-ui, sans-serif',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <span>Tx: <span style={{ color: '#EEE', fontWeight: 600 }}>{pos.transactions.length}</span></span>
                                <span style={{ opacity: 0.3 }}>|</span>
                                {isClosed ? (
                                    <>
                                        <span>Sold: <span style={{ color: '#EEE', fontWeight: 600 }}>{formatNumber(pos.totalQuantitySold)}</span></span>
                                        {holdDays > 0 && (
                                            <>
                                                <span style={{ opacity: 0.3 }}>|</span>
                                                <span>Held: <span style={{ color: '#EEE', fontWeight: 600 }}>{holdDays} days</span></span>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <span>Net Qty: <span style={{ color: '#EEE', fontWeight: 600 }}>{formatNumber(netQuantity)}</span></span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Financials & Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* P&L Stats */}
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: posColor,
                                lineHeight: 1.2,
                                letterSpacing: '-0.02em'
                            }}>
                                {isProfit ? '+' : ''}{formatPercent(returnPercent)}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: COLORS.textSec,
                                fontWeight: 500,
                                marginTop: '2px',
                                opacity: 0.8
                            }}>
                                ({isProfit ? '+' : ''}{formatCurrency(pnl)})
                            </div>
                        </div>

                        {/* Realized Status Icon */}
                        {isClosed && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle at 30% 30%, rgba(212, 175, 55, 0.2), rgba(0,0,0,0))',
                                border: '1px solid rgba(212, 175, 55, 0.3)',
                                color: COLORS.gold,
                                boxShadow: '0 0 12px rgba(212, 175, 55, 0.1)'
                            }}>
                                <CheckCircle2 size={18} strokeWidth={2.5} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Expanded Information */}
                {isExpanded && (
                    <div style={{
                        marginTop: '-1px',
                        padding: '0.5rem 1rem 1rem 1rem',
                        background: COLORS.cardBg,
                        border: `1px solid rgba(255, 255, 255, 0.08)`,
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
                        position: 'relative',
                        zIndex: 9,
                        animation: 'slideDown 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {[...pos.transactions]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((tx, txIdx, arr) => (
                                    <div key={txIdx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '24px',
                                        padding: '0.4rem 0',
                                        paddingLeft: '56px',
                                        fontSize: '0.75rem',
                                        color: COLORS.textSec,
                                        fontFamily: 'Inter, system-ui, sans-serif',
                                        borderBottom: txIdx === arr.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.03)'
                                    }}>
                                        <div style={{ width: '80px', color: '#999' }}>
                                            {new Date(tx.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </div>
                                        <div style={{
                                            fontWeight: 700,
                                            color: tx.type === 'BUY' ? COLORS.success : COLORS.error,
                                            width: '40px'
                                        }}>
                                            {tx.type}
                                        </div>
                                        <div style={{ width: '40px', color: '#EEE', fontWeight: 600 }}>
                                            {formatNumber(tx.quantity)}
                                        </div>
                                        <div style={{ color: '#DDD' }}>
                                            {formatCurrency(tx.price, tx.currency)}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const closedPositionsList = sortedPositions.filter(p => Math.abs(p.totalQuantityBought - p.totalQuantitySold) < 0.01);
    const activePositionsList = sortedPositions.filter(p => Math.abs(p.totalQuantityBought - p.totalQuantitySold) >= 0.01);

    return (
        <div style={{
            marginTop: '1.5rem',
            marginBottom: '1rem',
            backgroundColor: COLORS.bg,
            background: `
                radial-gradient(circle at 10% 10%, rgba(168, 85, 247, 0.08), transparent 40%),
                radial-gradient(circle at 90% 90%, rgba(45, 188, 142, 0.05), transparent 40%),
                ${COLORS.bg}
            `,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            position: 'relative',
        }}>
            <div style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.03,
                pointerEvents: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                zIndex: 0
            }} />

            {/* Header */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '1.25rem 1.5rem',
                    cursor: 'pointer',
                    borderBottom: isOpen ? `1px solid ${COLORS.border}` : 'none',
                    transition: 'all 0.3s ease',
                    background: 'rgba(255, 255, 255, 0.02)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #2A2A2A, #333333)',
                            border: `1px solid rgba(255, 255, 255, 0.1)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                        }}>
                            <Clock size={20} color={COLORS.textSec} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: COLORS.textMain, margin: 0, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em' }}>
                                Transaction History
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: COLORS.textSec, margin: '2px 0 0 0', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                {loading ? 'Loading...' : `${totalCount} positions • ${formatPercent(winRate)} win rate`}
                            </p>
                        </div>
                    </div>
                    <div>
                        {isOpen ? <ChevronUp size={20} color={COLORS.textSec} /> : <ChevronDown size={20} color={COLORS.textSec} />}
                    </div>
                </div>
            </div>

            {/* Content */}
            {isOpen && (
                <div style={{ padding: '1.5rem', position: 'relative', zIndex: 1 }}>
                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.textSec }}>
                            <div className="animate-spin" style={{ margin: '0 auto 1rem', width: '32px', height: '32px', border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.textMain, borderRadius: '50%' }} />
                            <p style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Loading positions...</p>
                        </div>
                    ) : positions.length === 0 ? (
                        <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                            <Award size={48} color="#333" style={{ margin: '0 auto 1rem' }} />
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.textSec, margin: '0 0 0.5rem 0', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                No Transaction History Yet
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: '#555', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                Your closed positions will appear here
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            {/* Closed Positions Group */}
                            <div>
                                <div
                                    onClick={() => setShowClosedGroup(!showClosedGroup)}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '12px', cursor: 'pointer', marginBottom: showClosedGroup ? '1rem' : '0',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: COLORS.textMain, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CheckCircle2 size={18} color={COLORS.success} />
                                        <span>Closed / Realized</span>
                                        <span style={{ fontSize: '0.75rem', color: COLORS.textSec, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '100px' }}>
                                            {closedPositionsList.length}
                                        </span>
                                    </div>
                                    {showClosedGroup ? <ChevronUp size={18} color={COLORS.textSec} /> : <ChevronDown size={18} color={COLORS.textSec} />}
                                </div>
                                {showClosedGroup && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {closedPositionsList.length > 0 ? closedPositionsList.map((pos, i) => renderCard(pos, i)) : (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: COLORS.textSec, fontSize: '0.85rem' }}>No closed positions yet.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Active Positions Group */}
                            <div>
                                <div
                                    onClick={() => setShowActiveGroup(!showActiveGroup)}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '12px', cursor: 'pointer', marginBottom: showActiveGroup ? '1rem' : '0',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: COLORS.textMain, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Clock size={18} color={COLORS.gold} />
                                        <span>Active Positions History</span>
                                        <span style={{ fontSize: '0.75rem', color: COLORS.textSec, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '100px' }}>
                                            {activePositionsList.length}
                                        </span>
                                    </div>
                                    {showActiveGroup ? <ChevronUp size={18} color={COLORS.textSec} /> : <ChevronDown size={18} color={COLORS.textSec} />}
                                </div>
                                {showActiveGroup && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {activePositionsList.length > 0 ? activePositionsList.map((pos, i) => renderCard(pos, i)) : (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: COLORS.textSec, fontSize: '0.85rem' }}>No active positions history.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
