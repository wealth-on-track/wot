"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut, ShieldCheck, Banknote, Check, Euro, DollarSign, Coins } from "lucide-react";
import { handleSignOut } from "@/lib/authActions";
import { useCurrency } from "@/context/CurrencyContext";

export function NavbarActions({ userEmail }: { userEmail?: string | null }) {
    const { currency, setCurrency } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const currencies = [
        { code: 'ORG', label: 'Original', symbol: '📋' },
        { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
        { code: 'USD', label: 'US Dollar (USD)', symbol: '$' },
        { code: 'TRY', label: 'Turkish Lira (TRY)', symbol: '₺' },
    ];


    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>

            {/* Global Currency Selector */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    title={`Global Currency: ${currency}`}
                    style={{
                        width: '2.5rem', height: '2.5rem',
                        borderRadius: '9999px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isOpen ? '#6366f1' : 'var(--text-secondary)',
                        background: isOpen ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        border: isOpen ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                        if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, fontFamily: 'var(--font-sans)', letterSpacing: '-0.05em' }}>FX</span>
                </button>

                {isOpen && (
                    <div style={{
                        position: 'absolute',
                        top: '120%',
                        right: 0,
                        width: '180px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '1rem',
                        padding: '0.5rem',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                            View All In
                        </div>
                        {currencies.map((c) => (
                            <button
                                key={c.code}
                                onClick={() => {
                                    setCurrency(c.code as any);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    padding: '0.6rem 0.8rem',
                                    background: currency === c.code ? 'var(--bg-secondary)' : 'transparent',
                                    color: currency === c.code ? 'var(--accent)' : 'var(--text-primary)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.85rem',
                                    fontWeight: currency === c.code ? 600 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.1s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                onMouseLeave={(e) => {
                                    if (currency !== c.code) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ opacity: 0.7, width: '15px' }}>{c.symbol}</span>
                                    <span>{c.code}</span>
                                </div>
                                {currency === c.code && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Logout */}
            <form action={handleSignOut} style={{ margin: 0 }}>
                <button
                    type="submit"
                    title="Sign Out"
                    style={{
                        width: '2.5rem', height: '2.5rem',
                        borderRadius: '9999px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#64748b';
                    }}
                >
                    <LogOut size={20} />
                </button>
            </form>

            {/* Admin Panel Link (Only for test1@example.com) */}
            {userEmail === 'test1@example.com' && (
                <Link href="/admin">
                    <button
                        type="button"
                        title="Admin Panel"
                        style={{
                            width: '2.5rem', height: '2.5rem',
                            borderRadius: '9999px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.1)'; // Indigo tint
                            e.currentTarget.style.color = '#4F46E5';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#64748b';
                        }}
                    >
                        <ShieldCheck size={20} />
                    </button>
                </Link>
            )}
        </div>
    );
}
