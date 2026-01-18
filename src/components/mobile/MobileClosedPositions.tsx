
"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Layers, History, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { getClosedPositions, ClosedPosition } from "@/app/actions/history";
import { useCurrency } from "@/context/CurrencyContext";

export function MobileClosedPositions() {
    const [isOpen, setIsOpen] = useState(false);
    const [positions, setPositions] = useState<ClosedPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const { currency } = useCurrency(); // Keep context if needed for other things, but formatCurrency is missing

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(val);

    // Fetch on mount or when opened to save data? 
    // Let's fetch on mount so we can show the count in the header.
    useEffect(() => {
        setLoading(true);
        getClosedPositions()
            .then(data => setPositions(data))
            .finally(() => setLoading(false));
    }, []);

    // Calculate Summary
    const totalRealizedPnl = positions.reduce((acc, p) => acc + (p.realizedPnl || 0), 0);
    const totalCount = positions.length;

    if (loading && positions.length === 0) {
        return <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5 }}>Loading history...</div>;
    }

    if (positions.length === 0) return null;

    return (
        <div style={{
            marginTop: '1.5rem',
            marginBottom: '2rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}>
            {/* Header / Toggle */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isOpen ? 'var(--bg-secondary)' : 'transparent',
                    transition: 'background 0.2s'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Layers size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                            Closed Positions
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {totalCount} positions
                            </span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>•</span>
                            <span style={{
                                fontSize: '0.8rem',
                                color: totalRealizedPnl >= 0 ? '#10b981' : '#ef4444',
                                fontWeight: 600
                            }}>
                                {totalRealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalRealizedPnl)} Total P&L
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Source Badge */}
                    <div style={{
                        padding: '4px 8px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '6px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: '#3b82f6',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        Source: DeGiro
                    </div>

                    {isOpen ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                </div>
            </div>

            {/* Content */}
            {isOpen && (
                <div style={{ padding: '0 1rem 1rem 1rem' }}>
                    <div style={{ height: '1px', background: 'var(--border)', marginBottom: '1rem', opacity: 0.5 }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {positions.map((pos, idx) => {
                            const pnl = pos.realizedPnl || 0;
                            const isProfit = pnl >= 0;

                            return (
                                <div key={`${pos.symbol}-${idx}`} style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '16px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}>
                                    {/* Row 1: Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: 'var(--surface)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)'
                                            }}>
                                                {pos.symbol.substring(0, 1)}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {pos.name || pos.symbol}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
                                                    <span>{pos.symbol}</span>
                                                    <span>•</span>
                                                    <span>{pos.transactionCount} txns</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                fontSize: '1rem',
                                                fontWeight: 800,
                                                color: isProfit ? '#10b981' : '#ef4444'
                                            }}>
                                                {isProfit ? '+' : ''}{formatCurrency(pnl)}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                Realized P&L
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Stats Grid */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 1fr',
                                        gap: '8px',
                                        background: 'rgba(0,0,0,0.02)',
                                        borderRadius: '10px',
                                        padding: '8px'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Bought</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{pos.totalQuantityBought.toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Sold</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{pos.totalQuantitySold.toFixed(2)}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Last Trade</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                                {new Date(pos.lastTradeDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Investment Details */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0 4px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Invested: <b>{formatCurrency(pos.totalInvested)}</b></span>
                                        <span style={{ color: 'var(--text-secondary)' }}>Sold For: <b>{formatCurrency(pos.totalRealized)}</b></span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
