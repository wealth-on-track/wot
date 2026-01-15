"use client";

import { useState, useEffect } from "react";
import { X, TrendingUp, AlertCircle } from "lucide-react";

interface MobileImpactSheetProps {
    isOpen: boolean;
    onClose: () => void;
    totalValueEUR: number; // For context if needed, or maybe average return
}

export function MobileImpactSheet({ isOpen, onClose }: MobileImpactSheetProps) {
    const [amount, setAmount] = useState<string>("");
    const [years, setYears] = useState(10);
    const [interestRate, setInterestRate] = useState(8); // Default 8% annual return

    // Animation state
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const t = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    if (!isOpen && !visible) return null;

    const principal = parseFloat(amount) || 0;

    // Future Value Calculation: FV = PV * (1 + r)^n
    // Assumes monthly compounding for slightly better accuracy or just simple annual? 
    // Let's stick to simple annual compounding for impact: P * (1 + r/100)^n
    const futureValue = principal * Math.pow(1 + interestRate / 100, years);
    const profit = futureValue - principal;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2000,
            pointerEvents: isOpen ? 'auto' : 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    opacity: isOpen ? 1 : 0,
                    transition: 'opacity 0.3s ease'
                }}
            />

            {/* Sheet */}
            <div style={{
                background: 'var(--bg-secondary)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                padding: '24px',
                paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
                transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                position: 'relative',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
                borderTop: '1px solid var(--border)'
            }}>
                {/* Handle Bar */}
                <div style={{
                    width: '40px',
                    height: '4px',
                    background: 'var(--border)',
                    borderRadius: '2px',
                    margin: '0 auto 20px auto',
                    opacity: 0.5
                }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Impact Simulator</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>See the true cost of spending.</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Input Section */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        SPENDING AMOUNT
                    </label>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute',
                            left: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)'
                        }}>€</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            style={{
                                width: '100%',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border)', // Focused border color controlled by CSS if needed
                                borderRadius: '16px',
                                padding: '16px',
                                paddingLeft: '32px',
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* Settings (Years & Rate) Slider or Toggles */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ flex: 1, background: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>TIMEFRAME</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{years} Years</div>
                        <input
                            type="range"
                            min="1" max="40"
                            value={years}
                            onChange={(e) => setYears(parseInt(e.target.value))}
                            style={{ width: '100%', marginTop: '8px', accentColor: 'var(--accent)' }}
                        />
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>RETURN RATE</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{interestRate}%</div>
                        <input
                            type="range"
                            min="1" max="20"
                            value={interestRate}
                            onChange={(e) => setInterestRate(parseInt(e.target.value))}
                            style={{ width: '100%', marginTop: '8px', accentColor: 'var(--accent)' }}
                        />
                    </div>
                </div>

                {/* Result Card */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--accent), #a855f7)',
                    borderRadius: '20px',
                    padding: '24px',
                    textAlign: 'center',
                    marginBottom: '24px',
                    boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.5)'
                }}>
                    <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.8)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Future Value
                    </div>
                    <div style={{
                        fontSize: '2.5rem',
                        fontWeight: 900,
                        color: '#fff',
                        marginBottom: '8px',
                        lineHeight: 1
                    }}>
                        €{futureValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.9)',
                        background: 'rgba(255,255,255,0.2)',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <TrendingUp size={16} /> Pot. Profit: +€{profit.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                    </div>
                </div>

                {/* Message */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0
                    }}>
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, color: 'var(--danger)', marginBottom: '2px' }}>Don't spend, invest!</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                            Investing this €{principal} could turn into a fortune over {years} years. Think twice!
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
