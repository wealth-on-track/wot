import React from 'react';
import { Settings2, Trash2, Plus, Edit2, Check, X, MoreHorizontal, Save } from 'lucide-react';
import { addTransaction, updateTransaction, deleteTransaction } from '@/app/actions/history';

interface Transaction {
    id: string;
    type: 'BUY' | 'SELL' | 'CLEANUP' | 'DIVIDEND' | 'INTEREST' | 'COUPON' | 'STAKING';
    quantity: number;
    price: number;
    date: Date | string;
    currency: string;
    runningQty?: number;
    avgCost?: number;
    value?: number;
}

interface TransactionHistoryProps {
    symbol: string;
    transactions: Transaction[];
    onUpdate: () => void;
    isBatchEditMode?: boolean;
    isOwner?: boolean;
    defaultCurrency?: string;
}

export function TransactionHistory({ symbol, transactions, onUpdate, isBatchEditMode, isOwner = true, defaultCurrency }: TransactionHistoryProps) {
    const [mode, setMode] = React.useState<'VIEW' | 'MODIFY' | 'DELETE'>('VIEW');
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [isAddMode, setIsAddMode] = React.useState(false);

    // New Transaction State
    const [newTx, setNewTx] = React.useState({
        date: new Date().toISOString().split('T')[0],
        type: 'BUY',
        quantity: '',
        price: ''
    });

    // Edit State for Modify Mode
    const [edits, setEdits] = React.useState<Record<string, { date: string, type: string, quantity: string, price: string }>>({});

    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize edits when entering modify mode
    React.useEffect(() => {
        if (mode === 'MODIFY') {
            const initialEdits: any = {};
            transactions.forEach(tx => {
                if (tx.type !== 'CLEANUP') {
                    initialEdits[tx.id] = {
                        date: new Date(tx.date).toISOString().split('T')[0],
                        type: tx.type,
                        quantity: Math.abs(tx.quantity).toString(),
                        price: tx.price.toString()
                    };
                }
            });
            setEdits(initialEdits);
        }
    }, [mode, transactions]);

    const handleAdd = async () => {
        if (!newTx.quantity || !newTx.price) return;

        await addTransaction({
            symbol,
            type: newTx.type as 'BUY' | 'SELL',
            quantity: parseFloat(newTx.quantity),
            price: parseFloat(newTx.price),
            date: new Date(newTx.date),
            currency: defaultCurrency || transactions[0]?.currency || 'USD'
        });

        setIsAddMode(false);
        setNewTx({ date: new Date().toISOString().split('T')[0], type: 'BUY', quantity: '', price: '' });
        onUpdate();
    };

    const handleSaveEdits = async () => {
        // Process all edits
        const promises = Object.entries(edits).map(([id, data]) => {
            // Check if changed
            const original = transactions.find(t => t.id === id);
            if (!original) return Promise.resolve();

            // Basic diff check (could be more robust)
            if (
                new Date(original.date).toISOString().split('T')[0] === data.date &&
                original.type === data.type &&
                Math.abs(original.quantity) === parseFloat(data.quantity) &&
                original.price === parseFloat(data.price)
            ) {
                return Promise.resolve();
            }

            return updateTransaction(id, {
                type: data.type as 'BUY' | 'SELL',
                quantity: parseFloat(data.quantity),
                price: parseFloat(data.price),
                date: new Date(data.date)
            });
        });

        await Promise.all(promises);
        setMode('VIEW');
        onUpdate();
    };

    const handleDelete = async (txId: string) => {
        if (confirm('Delete this transaction?')) {
            await deleteTransaction(txId);
            onUpdate();
        }
    };

    // Calculate running balances
    const calculateBalances = () => {
        const sortedTxs = [...transactions].filter(t => t.type !== 'CLEANUP').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let runningQty = 0;
        let totalCost = 0;
        let currentAvgCost = 0;

        const txsWithBalance = sortedTxs.map((tx, index) => {
            const qty = Number(tx.quantity);
            const price = Number(tx.price);

            if (tx.type === 'BUY') {
                runningQty += qty;
                totalCost += (qty * price);
                if (runningQty > 0) {
                    currentAvgCost = totalCost / runningQty;
                }
            } else if (tx.type === 'SELL') {
                const soldPortion = runningQty > 0 ? qty / runningQty : 0;
                totalCost = totalCost * (1 - soldPortion);
                runningQty -= qty;
                // avgCost remains as previous currentAvgCost
            } else if (tx.type === 'DIVIDEND' || tx.type === 'INTEREST' || tx.type === 'COUPON' || tx.type === 'STAKING') {
                // Rewards add to running qty but are "free" (cost = 0)
                // This effectively lowers the average cost per unit
                runningQty += qty;
                // totalCost stays the same, so avgCost decreases
                if (runningQty > 0) {
                    currentAvgCost = totalCost / runningQty;
                }
            }

            const avgCost = currentAvgCost;
            const value = runningQty * avgCost;

            return { ...tx, runningQty, avgCost, value, index: index + 1 };
        });

        // Dust check
        const lastTx = txsWithBalance[txsWithBalance.length - 1];
        if (lastTx && Math.abs(lastTx.runningQty) > 0 && Math.abs(lastTx.runningQty) < 0.01) {
            txsWithBalance.push({
                id: 'cleanup-auto',
                type: 'CLEANUP',
                quantity: -lastTx.runningQty,
                price: 0,
                date: lastTx.date,
                currency: lastTx.currency,
                runningQty: 0,
                avgCost: 0,
                value: 0,
                index: txsWithBalance.length + 1
            });
        }

        return txsWithBalance.reverse();
    };

    const processedTransactions = calculateBalances();

    return (
        <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            padding: '0.5rem 1rem',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            {/* Header / Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `40px 1fr 0.8fr 1fr 1fr 1.2fr 1.2fr 1.2fr 30px ${isBatchEditMode ? '40px' : '0px'}`,
                    gap: '0.5rem',
                    alignItems: 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    flex: 1
                }}>
                    <div style={{ textAlign: 'center' }}>#</div>
                    <div style={{ textAlign: 'left' }}>Date</div>
                    <div style={{ textAlign: 'left' }}>Type</div>
                    <div style={{ textAlign: 'right' }}>Qty</div>
                    <div style={{ textAlign: 'right' }}>Price</div>
                    <div style={{ textAlign: 'right' }}>Qty Balance</div>
                    <div style={{ textAlign: 'right' }}>Avg. Cost</div>
                    <div style={{ textAlign: 'right' }}>Value</div>
                    <div></div>
                    {isBatchEditMode && <div></div>}
                </div>

                {/* Adjustment Menu Trigger */}
                <div style={{ position: 'relative' }} ref={menuRef}>
                    {isOwner && (
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                padding: '4px', borderRadius: '4px', color: 'var(--text-muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <Settings2 size={14} />
                        </button>
                    )}

                    {isMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            minWidth: '140px',
                            padding: '4px',
                            display: 'flex', flexDirection: 'column', gap: '2px'
                        }}>
                            <button
                                onClick={() => { setIsAddMode(true); setIsMenuOpen(false); setMode('VIEW'); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 12px', fontSize: '12px', fontWeight: 500,
                                    color: 'var(--text-primary)', background: 'transparent',
                                    border: 'none', cursor: 'pointer', borderRadius: '4px',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Plus size={14} /> Add
                            </button>
                            <button
                                onClick={() => { setMode('MODIFY'); setIsMenuOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 12px', fontSize: '12px', fontWeight: 500,
                                    color: 'var(--text-primary)', background: 'transparent',
                                    border: 'none', cursor: 'pointer', borderRadius: '4px',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Edit2 size={14} /> Modify
                            </button>
                            <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
                            <button
                                onClick={() => { setMode('VIEW'); setIsAddMode(false); setIsMenuOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 12px', fontSize: '12px', fontWeight: 500,
                                    color: 'var(--text-muted)', background: 'transparent',
                                    border: 'none', cursor: 'pointer', borderRadius: '4px',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <X size={14} /> Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {/* Add Row */}
                {isAddMode && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `40px 1fr 0.8fr 1fr 1fr 1.2fr 1.2fr 1.2fr 30px ${isBatchEditMode ? '40px' : '0px'}`,
                        gap: '0.5rem',
                        alignItems: 'center',
                        height: '40px',
                        borderBottom: '1px solid var(--accent)',
                        background: 'rgba(var(--accent-rgb), 0.05)',
                        padding: '0 4px'
                    }}>
                        <div />
                        <input type="date" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} style={inputStyle} />
                        <select value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value })} style={inputStyle}>
                            <option value="BUY">BUY</option>
                            <option value="SELL">SELL</option>
                        </select>
                        <input type="number" placeholder="Qty" value={newTx.quantity} onChange={e => setNewTx({ ...newTx, quantity: e.target.value })} style={inputStyle} />
                        <input type="number" placeholder="Price" value={newTx.price} onChange={e => setNewTx({ ...newTx, price: e.target.value })} style={inputStyle} />
                        <div /> <div /> <div />

                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={handleAdd} style={actionBtnStyle} title="Save"><Check size={14} color="#10b981" /></button>
                            <button onClick={() => setIsAddMode(false)} style={actionBtnStyle} title="Cancel"><X size={14} color="#ef4444" /></button>
                        </div>
                    </div>
                )}

                {/* List */}
                {processedTransactions.map((tx, idx) => {
                    const isEditing = mode === 'MODIFY' && tx.type !== 'CLEANUP';
                    const editData = isEditing ? edits[tx.id] : null;

                    return (
                        <div key={idx} style={{
                            display: 'grid',
                            gridTemplateColumns: `40px 1fr 0.8fr 1fr 1fr 1.2fr 1.2fr 1.2fr 30px ${isBatchEditMode ? '40px' : '0px'}`,
                            gap: '0.5rem',
                            alignItems: 'center',
                            height: '32px',
                            borderBottom: idx === processedTransactions.length - 1 ? 'none' : '1px solid var(--border)',
                            opacity: tx.type === 'CLEANUP' ? 0.7 : 0.9,
                            fontSize: '12px',
                            background: tx.type === 'CLEANUP' ? 'rgba(0,0,0,0.02)' : 'transparent',
                            fontStyle: tx.type === 'CLEANUP' ? 'italic' : 'normal'
                        }}>
                            {/* Col 1: Index */}
                            <div style={{ textAlign: 'center' }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    border: '1px solid var(--border)'
                                }}>
                                    {(tx as any).index || '-'}
                                </span>
                            </div>

                            {/* Edit Fields or Display */}
                            {isEditing && editData ? (
                                <>
                                    <input type="date" value={editData.date} onChange={e => setEdits({ ...edits, [tx.id]: { ...editData, date: e.target.value } })} style={compactInputStyle} />
                                    <select value={editData.type} onChange={e => setEdits({ ...edits, [tx.id]: { ...editData, type: e.target.value } })} style={compactInputStyle}>
                                        <option value="BUY">BUY</option>
                                        <option value="SELL">SELL</option>
                                    </select>
                                    <input type="number" value={editData.quantity} onChange={e => setEdits({ ...edits, [tx.id]: { ...editData, quantity: e.target.value } })} style={compactInputStyle} />
                                    <input type="number" value={editData.price} onChange={e => setEdits({ ...edits, [tx.id]: { ...editData, price: e.target.value } })} style={compactInputStyle} />
                                    <div /> <div /> <div />
                                </>
                            ) : (
                                <>
                                    {/* Col 2: Date */}
                                    <div style={{ textAlign: 'left', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '11px' }}>
                                        {new Date(tx.date).toLocaleDateString('en-GB')}
                                    </div>

                                    {/* Col 3: Type */}
                                    <div style={{ textAlign: 'left' }}>
                                        {tx.type === 'CLEANUP' ? (
                                            <span style={{ fontWeight: 500, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                Cleanup
                                            </span>
                                        ) : tx.type === 'STAKING' ? (
                                            <span style={{ fontWeight: 600, fontSize: '11px', color: '#3b82f6' }}>
                                                STAKING
                                            </span>
                                        ) : tx.type === 'DIVIDEND' || tx.type === 'INTEREST' || tx.type === 'COUPON' ? (
                                            <span style={{
                                                fontWeight: 600,
                                                fontSize: '10px',
                                                color: '#f59e0b',
                                                background: 'rgba(245, 158, 11, 0.1)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase'
                                            }}>
                                                {tx.type}
                                            </span>
                                        ) : (
                                            <span style={{ fontWeight: 600, fontSize: '11px', color: tx.type === 'BUY' ? '#22c55e' : '#ef4444' }}>
                                                {tx.type}
                                            </span>
                                        )}
                                    </div>

                                    {/* Col 4: Tx Qty */}
                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                        {tx.type === 'CLEANUP' ? '' : (
                                            <>
                                                {Math.abs(tx.quantity).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 6 })}
                                            </>
                                        )}
                                    </div>

                                    {/* Col 5: Tx Price */}
                                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '11px' }}>
                                        {tx.type === 'CLEANUP' ? '-' : (
                                            <>
                                                {tx.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </>
                                        )}
                                    </div>

                                    {/* Col 6: Qty Balance */}
                                    <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        {tx.runningQty?.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                    </div>

                                    {/* Col 7: Avg Cost */}
                                    <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        {tx.avgCost?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>

                                    {/* Col 8: Value */}
                                    <div style={{ textAlign: 'right', fontFamily: 'inherit', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        {tx.value?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </>
                            )}

                            {/* Col 9: Action (Delete or Spacer) */}
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.6 }}>
                                {mode === 'MODIFY' && tx.type !== 'CLEANUP' && (
                                    <button
                                        onClick={() => handleDelete(tx.id)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                                        title="Delete Transaction"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Col 10: Batch Spacer */}
                            {isBatchEditMode && <div></div>}

                        </div>
                    );
                })}
            </div>

            {/* Modify Mode Footer */}
            {mode === 'MODIFY' && (
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={() => setMode('VIEW')} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', fontSize: '12px', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={handleSaveEdits} style={{ padding: '6px 16px', borderRadius: '6px', background: 'var(--accent)', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: '11px'
};

const compactInputStyle = {
    ...inputStyle, padding: '2px 4px', height: '24px'
};

const actionBtnStyle = {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
};
