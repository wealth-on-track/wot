"use client";

import { useState, useEffect } from "react";
import { getClosedPositions, ClosedPosition } from "@/app/actions/history";
import { useCurrency } from "@/context/CurrencyContext";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import type { AssetDisplay } from "@/lib/types";

interface MobileClosedPositionsProps {
    assets?: AssetDisplay[];
}

export function MobileClosedPositions({ assets = [] }: MobileClosedPositionsProps) {
    const [positions, setPositions] = useState<ClosedPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Determine locale based on currency for proper formatting
    const getLocale = (curr: string) => {
        switch (curr) {
            case 'TRY': return 'tr-TR';
            case 'USD': return 'en-US';
            case 'EUR': return 'de-DE';
            default: return 'en-US';
        }
    };

    const formatCurrency = (val: number, posCurrency: string) => {
        return new Intl.NumberFormat(getLocale(posCurrency), {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    };

    const formatPrice = (val: number, posCurrency: string) => {
        return new Intl.NumberFormat(getLocale(posCurrency), {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
    };

    const formatDate = (date: Date) => {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const getSymbol = (code: string) => {
        const symbols: Record<string, string> = { 'EUR': '€', 'USD': '$', 'TRY': '₺', 'GBP': '£' };
        return symbols[code] || code;
    }

    useEffect(() => {
        setLoading(true);
        getClosedPositions()
            .then(data => setPositions(data))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading closed positions...
            </div>
        );
    }

    if (positions.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No closed positions found.
            </div>
        );
    }

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingBottom: '20px' }}>
            {positions.map((pos, idx) => {
                const uniqueId = `${pos.symbol}-${idx}`;
                const pnl = pos.realizedPnl || 0;
                const totalCost = pos.totalInvested || 1;
                const pnlPercent = (pnl / totalCost) * 100;
                const isProfit = pnl >= 0;
                const sym = getSymbol(pos.currency);
                const isExpanded = expandedId === uniqueId;

                // Attempt to find current price from passed assets
                const activeAsset = assets.find(a => a.symbol === pos.symbol);
                const currentPrice = activeAsset ? (activeAsset.currentPrice || activeAsset.buyPrice) : null;

                return (
                    <div key={uniqueId} style={{ background: 'var(--surface)', borderRadius: '0' }}>
                        <div
                            onClick={() => toggleExpand(uniqueId)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px 8px', // Ultra compact
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                height: '40px', // Fixed small height
                                gap: '8px'
                            }}
                        >
                            {/* 1. Logo (Tiny) */}
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                background: 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                color: 'var(--text-secondary)',
                                flexShrink: 0
                            }}>
                                {pos.symbol.substring(0, 1)}
                            </div>

                            {/* 2. Symbol & Truncated Name */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0px', overflow: 'hidden', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {pos.symbol}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                                        {pos.name}
                                    </span>
                                </div>
                            </div>

                            {/* 3. P&L % */}
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: isProfit ? 'var(--success)' : 'var(--danger)',
                                width: '45px',
                                textAlign: 'right'
                            }}>
                                {isProfit ? '+' : ''}{Math.round(pnlPercent)}%
                            </span>

                            {/* 4. P&L Amount */}
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: isProfit ? 'var(--success)' : 'var(--danger)',
                                width: '55px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)'
                            }}>
                                {isProfit ? '+' : ''}{formatCurrency(pnl, pos.currency)}
                            </span>

                            {/* Chevron */}
                            <div style={{ width: '12px', display: 'flex', justifyContent: 'center', opacity: 0.5 }}>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                        </div>

                        {/* EXPANDED DETAILS */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{ overflow: 'hidden', background: 'var(--bg-secondary)' }}
                                >
                                    <div style={{ padding: '8px 12px 12px 12px', fontSize: '0.7rem' }}>
                                        {/* Summary Row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Invested: <b style={{ color: 'var(--text-primary)' }}>{sym}{formatCurrency(pos.totalInvested, pos.currency)}</b></span>
                                                <span style={{ color: 'var(--text-secondary)' }}>Sold: <b style={{ color: 'var(--text-primary)' }}>{sym}{formatCurrency(pos.totalRealized, pos.currency)}</b></span>
                                            </div>

                                            {currentPrice && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Current Price:</span>
                                                    <b style={{ color: 'var(--text-primary)' }}>{sym}{formatPrice(currentPrice, pos.currency)}</b>
                                                </div>
                                            )}
                                        </div>

                                        {/* Transactions - No Header */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                {pos.transactions.map((tx, idx) => (
                                                    <tr key={idx} style={{ color: 'var(--text-primary)', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                                                        <td style={{
                                                            padding: '3px 0',
                                                            color: tx.type === 'BUY' ? '#10b981' : '#ef4444',
                                                            fontWeight: 600,
                                                            width: '30px'
                                                        }}>
                                                            {tx.type}
                                                        </td>
                                                        <td style={{ padding: '3px 0', textAlign: 'right', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                                                            {formatDate(tx.date)}
                                                        </td>
                                                        <td style={{ padding: '3px 0', textAlign: 'right', width: '40px' }}>
                                                            {tx.quantity}
                                                        </td>
                                                        <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', width: '60px' }}>
                                                            {formatPrice(tx.price, pos.currency)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}
