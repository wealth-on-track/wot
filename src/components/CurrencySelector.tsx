"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { ChevronDown } from 'lucide-react';

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
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="currency-selector-btn"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    background: isOpen ? 'var(--bg-active)' : 'transparent',
                    border: '1px solid',
                    borderColor: isOpen ? 'var(--accent)' : 'transparent',
                    borderRadius: '0.4rem',
                    color: 'var(--text-primary)',
                    padding: '0.25rem 0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    justifyContent: 'space-between'
                }}
            >
                <span className="desktop-only">{currency === 'ORG' ? 'CCY' : getCurrencySymbol(currency)}</span>
                <span className="mobile-only" style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                    {currency === 'ORG' ? 'CCY' : getCurrencySymbol(currency)}
                </span>
                <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    minWidth: '100px',
                    width: 'max-content',
                    padding: '0.2rem',
                    borderRadius: '0.5rem',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.1rem',
                    background: 'var(--bg-secondary)', // More solid background for readability
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                }}>
                    {currencies.map(curr => {
                        let label = '';
                        if (curr === 'ORG') label = 'Original';
                        else label = `${curr} (${getCurrencySymbol(curr)})`;

                        return (
                            <button
                                key={curr}
                                onClick={() => {
                                    setCurrency(curr);
                                    setIsOpen(false);
                                }}
                                style={{
                                    background: currency === curr ? 'var(--bg-active)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '0.3rem',
                                    color: currency === curr ? 'var(--text-active)' : 'var(--text-secondary)',
                                    padding: '0.3rem 0.6rem',
                                    fontSize: '0.75rem',
                                    fontWeight: currency === curr ? 700 : 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%',
                                    transition: 'all 0.1s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem'
                                }}
                            >
                                {label}
                                {currency === curr && <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>●</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
