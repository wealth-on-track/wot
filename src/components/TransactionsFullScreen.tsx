"use client";

import React, { useEffect, useState } from "react";
import { getTransactions } from "@/lib/actions";
import { ArrowUpRight, ArrowDownLeft, Trash2, ChevronRight, ChevronDown, ChevronUp, Search, Layers, Calendar, Hash, Wallet, Building2, Tag } from "lucide-react";

interface Transaction {
    id: string;
    date: Date;
    type: string;
    symbol: string;
    name?: string;
    quantity: number;
    price: number;
    currency: string;
    platform?: string;
    exchange?: string;
}

interface AssetGroup {
    id: string;
    symbol: string;
    name: string;
    platform: string;
    transactions: Transaction[];
    lastDate: Date;
}

const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
};

const formatCurrency = (amount: number, currency: string) => {
    // 1.000,00 format (German locale matches requirements: . for thousands, , for decimal)
    const formatted = amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const symbols: Record<string, string> = { 'EUR': '€', 'USD': '$', 'TRY': '₺', 'GBP': '£' };
    const sym = symbols[currency] || currency;
    return `${formatted} ${sym}`;
};

// Extracted Row Component for Hover State
const TransactionDetailRow = ({ tx, index, total, gridTemplate, assets }: { tx: Transaction, index: number, total: number, gridTemplate: string, assets: any[] }) => {
    const [isHovered, setIsHovered] = useState(false);

    const matchedAsset = assets.find(a => a.symbol === tx.symbol);
    const portfolioName = matchedAsset?.customGroup || 'Main';

    const isSystemCleanup = tx.platform === 'System Cleanup';
    let displayAmount = tx.quantity > 0 ? tx.quantity : tx.price; // Show quantity for crypto, price for cash

    // Logic for CASH items
    if (matchedAsset?.category === 'CASH' || matchedAsset?.type === 'CASH') {
        displayAmount = tx.quantity; // Always use quantity for cash
    }

    if (tx.type === 'WITHDRAWAL') displayAmount = -Math.abs(displayAmount);
    const eventNumber = total - index;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                alignItems: 'center',
                padding: '10px 0',
                fontSize: '12px', // Reduced font size
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border)', // Separator for all
                background: isHovered ? 'var(--bg-secondary)' : 'transparent', // Significantly different highlight
                transition: 'background 0.1s'
            }}
        >
            {/* Gap for Avatar column */}
            <div></div>

            {/* Main Detail Content - Right Aligned in 1fr space */}
            <div style={{ padding: '0 6px', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'flex-end', fontFamily: 'inherit' }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)', width: '80px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{portfolioName}</span>
                <span style={{ fontWeight: 500, width: '60px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.platform}</span>
                <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-start' }}>
                    <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                        background: isSystemCleanup ? 'var(--bg-secondary)' : 'rgba(99, 102, 241, 0.1)',
                        color: isSystemCleanup ? 'var(--text-muted)' : 'var(--accent)',
                        textTransform: 'uppercase',
                        display: 'inline-block',
                        minWidth: '70px', // Ensure badge itself has consistent look
                        textAlign: 'left'
                    }}>
                        {isSystemCleanup ? 'CLEANUP' : tx.type}
                    </span>
                </div>
            </div>

            {/* # Aligned with Events */}
            <div style={{ textAlign: 'center' }}>
                <span style={{
                    fontSize: '10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                    padding: '1px 6px', borderRadius: '10px', border: '1px solid var(--border)',
                    fontWeight: 500
                }}>
                    #{eventNumber}
                </span>
            </div>

            {/* Date Aligned with Latest Activity */}
            <div style={{ textAlign: 'right', paddingRight: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {formatDate(tx.date)}
            </div>

            {/* Amount Aligned with Value */}
            <div style={{ textAlign: 'right', paddingRight: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatCurrency(displayAmount, tx.currency)}
            </div>

            {/* Empty Chevron */}
            <div></div>
        </div>
    );
};

export function TransactionsFullScreen({ viewMode = 'group', assets = [] }: { viewMode?: 'group' | 'date', assets?: any[] }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchTx = async () => {
            const data = await getTransactions();
            setTransactions(data as any[]);
            setLoading(false);
        };
        fetchTx();
    }, []);

    // Filter logic
    const filteredTxs = transactions.filter(tx => {
        // Calculate estimated value in EUR
        let eurValue = 0;
        const isFiat = ['EUR', 'USD', 'TRY', 'GBP'].includes(tx.currency);

        if (isFiat) {
            // For Fiat: Use the larger of (qty*price) or price. 
            // Deposits: qty=Amount, price=1. Interest: qty=0, price=Amount.
            eurValue = Math.max(Math.abs(tx.quantity * (tx.price || 1)), Math.abs(tx.price));
        } else {
            // For Crypto: Use Quantity * Current Market Price (from assets prop)
            const asset = assets.find(a => a.symbol === tx.symbol);
            const currentPrice = asset?.currentPrice || 0;
            eurValue = Math.abs(tx.quantity) * currentPrice;

            // If we have no price (e.g. historical asset no longer in portfolio?), fallback to buyPrice?
            // If price is 0, value is 0 -> Hidden. This matches requirement to hide low value.
            if (currentPrice === 0 && tx.price > 0 && tx.quantity > 0) {
                // Fallback: Use transaction price (Cost Basis) if current price missing
                eurValue = tx.quantity * tx.price;
            }
        }

        // Filter: Hide if value is less than 1 EUR
        if (eurValue < 1.0) return false;

        if (tx.platform === 'System Cleanup') return true;
        if (tx.type === 'BUY' || tx.type === 'SELL') return false;
        return true;
    });

    const groups: AssetGroup[] = [];

    // Process CASH
    const cashTxs = filteredTxs.filter(tx => tx.type === 'DEPOSIT' || tx.type === 'WITHDRAWAL');
    const otherTxs = filteredTxs.filter(tx => tx.type !== 'DEPOSIT' && tx.type !== 'WITHDRAWAL');

    const cashByPlatform: Record<string, Transaction[]> = {};
    cashTxs.forEach(tx => {
        const key = tx.platform || 'Unknown';
        if (!cashByPlatform[key]) cashByPlatform[key] = [];
        cashByPlatform[key].push(tx);
    });

    Object.entries(cashByPlatform).forEach(([platform, txs]) => {
        if (txs.length === 0) return;
        txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        groups.push({
            id: `CASH-${platform}`,
            symbol: 'CASH',
            name: `CASH ${platform}`,
            platform,
            transactions: txs,
            lastDate: new Date(txs[0].date)
        });
    });

    const assetsByKey: Record<string, Transaction[]> = {};
    otherTxs.forEach(tx => {
        const key = tx.symbol;
        if (!assetsByKey[key]) assetsByKey[key] = [];
        assetsByKey[key].push(tx);
    });

    Object.entries(assetsByKey).forEach(([symbol, txs]) => {
        if (txs.length === 0) return;
        txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        // Lookup Name from Assets Prop if available, else Transaction name
        const matchedAsset = assets.find(a => a.symbol === symbol);
        let name = matchedAsset?.name || txs[0].name || symbol;

        // Fix CASH naming
        if (symbol === 'EUR' || symbol === 'USD' || symbol === 'TRY' || name?.includes('Kraken')) {
            name = `CASH ${symbol}`;
        }

        groups.push({
            id: `ASSET-${symbol}`,
            symbol,
            name,
            platform: txs[0].platform || 'Unknown',
            transactions: txs,
            lastDate: new Date(txs[0].date)
        });
    });

    groups.sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());
    filteredTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    const toggleExpand = (id: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading transactions...</div>;

    if (transactions.length === 0) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '80px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
                marginTop: '1rem', border: '1px dashed var(--border)', textAlign: 'center'
            }}>
                <div style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
                    color: 'var(--accent)',
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                }}>
                    <Search size={32} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    No Transactions Found
                </h3>
                <p style={{
                    fontSize: '15px', color: 'var(--text-muted)', marginBottom: '0',
                    maxWidth: '400px', lineHeight: '1.6'
                }}>
                    Your account statement will appear here once you deposit or trade.
                </p>
            </div>
        );
    }

    // Standard widths for columns to ensure alignment
    // Avatar: 60px
    // Name: 1fr
    // Events: 80px
    // Date: 110px
    // Value: 120px
    // Chevron: 40px
    // Grid for Main Groups (6 Columns)
    const mainGridTemplate = "60px 1fr 70px 140px 140px 60px";

    // Grid for Transaction Details (9 Columns - Running Balance)
    const detailGridTemplate = "80px 90px 90px 60px 1fr 70px 140px 140px 60px";

    return (
        <div style={{ width: '100%', marginTop: '20px' }}>
            <div style={{
                borderRadius: '16px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {/* Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: mainGridTemplate,
                    background: 'var(--bg-secondary)',
                    height: '48px',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-muted)'
                }}>
                    {viewMode === 'group' ? (
                        <>
                            <div></div>
                            <div style={{ padding: '0 16px' }}>Asset Name</div>
                            <div style={{ textAlign: 'center' }}>Events</div>
                            <div style={{ textAlign: 'right', paddingRight: '16px' }}>Latest</div>
                            <div style={{ textAlign: 'right', paddingRight: '16px' }}>Total</div>
                            <div></div>
                        </>
                    ) : (
                        // Date View falls back to simple table or similar grid
                        <div style={{ display: 'contents' }}>
                            <div style={{ padding: '0 16px', gridColumn: 'span 2' }}>Date / Type</div>
                            <div style={{ padding: '0 16px' }}>Asset</div>
                            <div style={{ textAlign: 'right', paddingRight: '16px' }}>Amount</div>
                            <div style={{ textAlign: 'right', paddingRight: '16px' }}>Value</div>
                            <div style={{ paddingLeft: '16px' }}>Platform</div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div style={{ fontSize: '14px' }}>
                    {viewMode === 'group' && groups.map(group => {
                        const isExpanded = expandedGroups.has(group.id);

                        const totalValue = group.transactions.reduce((sum, t) => {
                            let val = t.quantity > 0 ? t.quantity * t.price : t.price;
                            if (t.type === 'WITHDRAWAL') val = -Math.abs(val);
                            if (t.type === 'DEPOSIT') val = Math.abs(val);
                            return sum + val;
                        }, 0);
                        const currency = group.transactions[0].currency;

                        const matchedAsset = assets.find(a => a.symbol.toUpperCase() === group.symbol.toUpperCase());
                        const logoUrl = matchedAsset?.logoUrl || `https://ui-avatars.com/api/?name=${group.symbol}&background=random&color=fff&size=64`;

                        return (
                            <React.Fragment key={group.id}>
                                <div
                                    onClick={() => toggleExpand(group.id)}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: mainGridTemplate,
                                        alignItems: 'center',
                                        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                                        cursor: 'pointer',
                                        background: isExpanded ? 'var(--bg-secondary-hover)' : 'transparent',
                                        transition: 'background 0.1s',
                                        minHeight: '64px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            overflow: 'hidden', background: 'var(--bg-secondary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <img
                                                src={logoUrl}
                                                alt={group.symbol}
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                onError={(e) => {
                                                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${group.symbol}&background=random&color=fff&size=64`;
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ padding: '0 16px' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{group.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{group.symbol}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{
                                            background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px',
                                            fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)'
                                        }}>
                                            {group.transactions.length}
                                        </span>
                                    </div>
                                    <div style={{ textAlign: 'right', paddingRight: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {formatDate(group.lastDate)}
                                    </div>
                                    <div style={{ textAlign: 'right', paddingRight: '16px', fontWeight: 700 }}>
                                        {formatCurrency(totalValue, currency)}
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{
                                        background: 'rgba(127, 127, 127, 0.12)',
                                        borderBottom: '1px solid var(--border)',
                                        paddingBottom: '0'
                                    }}>
                                        {(() => {
                                            // Calculate running balance for this asset/cash group
                                            const sortedTxs = [...group.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                            let runningQty = 0;
                                            let totalCost = 0;

                                            const txsWithBalance = sortedTxs.map(tx => {
                                                // For CASH/DEPOSIT/WITHDRAWAL
                                                if (tx.type === 'DEPOSIT') {
                                                    runningQty += tx.quantity;
                                                    totalCost += tx.quantity; // For cash, cost = quantity
                                                } else if (tx.type === 'WITHDRAWAL') {
                                                    runningQty -= tx.quantity;
                                                    totalCost -= tx.quantity;
                                                } else if (tx.type === 'BUY') {
                                                    runningQty += tx.quantity;
                                                    totalCost += (tx.quantity * tx.price);
                                                } else if (tx.type === 'SELL') {
                                                    const soldPortion = runningQty > 0 ? tx.quantity / runningQty : 0;
                                                    totalCost = totalCost * (1 - soldPortion);
                                                    runningQty -= tx.quantity;
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
                                            return txsWithBalance.reverse().map((tx, index) => {
                                                const matchedAsset = assets.find(a => a.symbol === tx.symbol);
                                                const portfolioName = matchedAsset?.customGroup || 'Main';
                                                const isSystemCleanup = tx.platform === 'System Cleanup';
                                                let displayAmount = tx.quantity > 0 ? tx.quantity : tx.price;
                                                if (matchedAsset?.category === 'CASH' || matchedAsset?.type === 'CASH') {
                                                    displayAmount = tx.quantity;
                                                }
                                                if (tx.type === 'WITHDRAWAL') displayAmount = -Math.abs(displayAmount);
                                                const eventNumber = group.transactions.length - index;
                                                const [isHovered, setIsHovered] = [false, () => { }]; // Simplified for inline

                                                return (
                                                    <div
                                                        key={tx.id}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: detailGridTemplate,
                                                            alignItems: 'center',
                                                            padding: '10px 0',
                                                            fontSize: '12px',
                                                            color: 'var(--text-secondary)',
                                                            borderBottom: '1px solid var(--border)',
                                                            background: 'transparent',
                                                            transition: 'background 0.1s'
                                                        }}
                                                    >
                                                        {/* Col 1: Running Qty */}
                                                        <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                            {tx.runningQty.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                        </div>

                                                        {/* Col 2: Avg Cost */}
                                                        <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                            {tx.avgCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>

                                                        {/* Col 3: Value */}
                                                        <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                            {tx.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>

                                                        {/* Gap for Avatar column */}
                                                        <div></div>

                                                        {/* Main Detail Content */}
                                                        <div style={{ padding: '0 6px', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'flex-end', fontFamily: 'inherit' }}>
                                                            <span style={{ fontWeight: 500, color: 'var(--text-primary)', width: '80px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{portfolioName}</span>
                                                            <span style={{ fontWeight: 500, width: '60px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.platform}</span>
                                                            <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-start' }}>
                                                                <span style={{
                                                                    fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                                                                    background: isSystemCleanup ? 'var(--bg-secondary)' : 'rgba(99, 102, 241, 0.1)',
                                                                    color: isSystemCleanup ? 'var(--text-muted)' : 'var(--accent)',
                                                                    textTransform: 'uppercase',
                                                                    display: 'inline-block',
                                                                    minWidth: '70px',
                                                                    textAlign: 'left'
                                                                }}>
                                                                    {isSystemCleanup ? 'CLEANUP' : tx.type}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* # */}
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{
                                                                fontSize: '10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                                                                padding: '1px 6px', borderRadius: '10px', border: '1px solid var(--border)',
                                                                fontWeight: 500
                                                            }}>
                                                                #{eventNumber}
                                                            </span>
                                                        </div>

                                                        {/* Date */}
                                                        <div style={{ textAlign: 'right', paddingRight: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                            {formatDate(tx.date)}
                                                        </div>

                                                        {/* Amount */}
                                                        <div style={{ textAlign: 'right', paddingRight: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            {formatCurrency(displayAmount, tx.currency)}
                                                        </div>

                                                        {/* Empty Chevron */}
                                                        <div></div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}

                    {viewMode === 'date' && filteredTxs.map(tx => {
                        const isSystemCleanup = tx.platform === 'System Cleanup';
                        const displayAmount = tx.quantity > 0 ? tx.quantity * tx.price : tx.price;

                        return (
                            <div key={tx.id} style={{
                                display: 'grid',
                                gridTemplateColumns: '120px 100px 1fr 100px 120px 120px', // Custom grid for date view
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                <div style={{ color: 'var(--text-secondary)' }}>{formatDate(tx.date)}</div>
                                <div>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                        background: isSystemCleanup ? 'var(--bg-secondary)' : 'rgba(99, 102, 241, 0.1)',
                                        color: isSystemCleanup ? 'var(--text-muted)' : 'var(--accent)'
                                    }}>
                                        {isSystemCleanup ? 'CLEANUP' : tx.type}
                                    </span>
                                </div>
                                <div style={{ fontWeight: 600 }}>{tx.symbol}</div>
                                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {tx.quantity > 0 ? tx.quantity : '-'}
                                </div>
                                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                    {formatCurrency(displayAmount, tx.currency)}
                                </div>
                                <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    {tx.platform}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
