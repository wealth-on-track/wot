"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { ChevronDown, Coins } from 'lucide-react';

import { getCurrencySymbol } from '@/lib/currency';

export function CurrencySelector() {
    const { currency, setCurrency } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const currencies = ["ORG", "EUR", "USD", "TRY"] as const;

    return (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="navbar-btn"
                title={`Currency: ${currency === 'ORG' ? 'Original' : currency}`}
            >
                <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'var(--font-sans)', letterSpacing: '0.5px' }}>FX</span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    minWidth: '130px',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    {currencies.map(curr => {
                        const isActive = currency === curr;
                        let label = curr === 'ORG' ? 'Original' : `${curr} (${getCurrencySymbol(curr)})`;

                        return (
                            <button
                                key={curr}
                                onClick={() => {
                                    setCurrency(curr);
                                    setIsOpen(false);
                                }}
                                style={{
                                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                    padding: '0.5rem 0.75rem',
                                    fontSize: '0.8rem',
                                    fontWeight: isActive ? 800 : 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                                onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
                            >
                                {label}
                                {isActive && <div style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%' }} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
