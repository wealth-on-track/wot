"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/context/CurrencyContext";
import { useTheme } from "@/context/ThemeContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { handleSignOut } from "@/lib/authActions";
import { LogOut, User } from "lucide-react";

interface MobileHeaderProps {
    username: string;
    isOwner: boolean;
}

export function MobileHeader({ username, isOwner }: MobileHeaderProps) {
    const { currency, setCurrency } = useCurrency();
    const { theme, toggleTheme } = useTheme();
    const [isFxOpen, setIsFxOpen] = useState(false);

    const CURRENCIES = ["ORG", "EUR", "USD", "TRY"] as const;

    return (
        <header style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1000,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
        }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                    display: 'flex',
                    gap: '1px',
                    userSelect: 'none'
                }}>
                    {/* W -> WEALTH */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ height: '1.2rem', display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '1.4rem',
                                fontWeight: 900,
                                lineHeight: 1,
                                letterSpacing: '-0.03em',
                                color: 'var(--text-primary)'
                            }}>W</span>
                        </div>
                        <span style={{
                            fontSize: '5.5px',
                            fontWeight: 400,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            opacity: 0.8
                        }}>WEALTH</span>
                    </div>

                    {/* O -> ON (Accent) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ height: '1.2rem', display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '1.4rem',
                                fontWeight: 900,
                                color: 'var(--accent)',
                                lineHeight: 1,
                                letterSpacing: '-0.03em',
                                filter: 'drop-shadow(0 0 6px var(--accent-glow))'
                            }}>O</span>
                        </div>
                        <span style={{
                            fontSize: '5.5px',
                            fontWeight: 400,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            opacity: 0.8
                        }}>ON</span>
                    </div>

                    {/* T -> TRACK */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ height: '1.2rem', display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '1.4rem',
                                fontWeight: 900,
                                lineHeight: 1,
                                letterSpacing: '-0.03em',
                                color: 'var(--text-primary)'
                            }}>T</span>
                        </div>
                        <span style={{
                            fontSize: '5.5px',
                            fontWeight: 400,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            opacity: 0.8
                        }}>TRACK</span>
                    </div>

                    {/* Beta Badge - Mobile */}
                    <div style={{
                        fontSize: '6px', // Slightly smaller for mobile
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        padding: '2px 5px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                        color: '#fff',
                        boxShadow: '0 2px 8px var(--accent-glow)',
                        animation: 'pulse-glow 3s ease-in-out infinite',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        marginLeft: '0.3rem',
                        alignSelf: 'flex-start',
                        marginTop: '0px'
                    }}>
                        BETA V2
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* FX Currency Selector - Accordion */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsFxOpen(!isFxOpen)}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>FX</span>
                        <span style={{
                            fontSize: '0.5rem',
                            transform: isFxOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                        }}>▼</span>
                    </button>

                    {/* Dropdown */}
                    {isFxOpen && (
                        <>
                            {/* Backdrop */}
                            <div
                                onClick={() => setIsFxOpen(false)}
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 999
                                }}
                            />
                            {/* Menu */}
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 0.5rem)',
                                right: 0,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.3rem',
                                zIndex: 1000,
                                minWidth: '120px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}>
                                {CURRENCIES.map(curr => (
                                    <button
                                        key={curr}
                                        onClick={() => {
                                            setCurrency(curr);
                                            setIsFxOpen(false);
                                        }}
                                        style={{
                                            background: currency === curr ? 'var(--accent)' : 'transparent',
                                            color: currency === curr ? '#fff' : 'var(--text-primary)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            textAlign: 'left'
                                        }}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Language Toggle */}
                <LanguageToggle />

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        fontSize: '1rem'
                    }}
                >
                    {theme === 'dark' ? '🌙' : '☀️'}
                </button>

                {/* Sign Out (if owner) OR Login/Get Started (if guest) */}
                {isOwner ? (
                    <>
                        {/* User Profile / Settings */}
                        <Link href="/settings" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                <User size={18} />
                            </div>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={() => handleSignOut()}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                width: '36px',
                                height: '36px', // Matching dimension
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                            }}
                        >
                            <LogOut size={18} />
                        </button>
                    </>
                ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link href="/login" style={{
                            textDecoration: 'none',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                        }}>
                            Login
                        </Link>
                        <Link href="/login" style={{
                            textDecoration: 'none',
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#fff',
                            boxShadow: '0 2px 8px var(--accent-glow)'
                        }}>
                            Start
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
}
