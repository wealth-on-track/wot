"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/context/CurrencyContext";
import { useTheme } from "@/context/ThemeContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { handleSignOut } from "@/lib/authActions";
import { LogOut, User, Eye, EyeOff } from "lucide-react";

interface MobileHeaderProps {
    username: string;
    isOwner: boolean;
    isPrivacyMode: boolean;
    onTogglePrivacy: () => void;
}

export function MobileHeader({ username, isOwner, isPrivacyMode, onTogglePrivacy }: MobileHeaderProps) {
    const { currency, setCurrency } = useCurrency();
    const { theme, toggleTheme } = useTheme();


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
                            fontSize: '7px',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            opacity: 0.9
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
                            fontSize: '7px',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            opacity: 0.9
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
                            fontSize: '7px',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            opacity: 0.9
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
                        marginLeft: '0rem', // Zero margin
                        alignSelf: 'flex-start',
                        marginTop: '0px'
                    }}>
                        BETA
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Privacy Toggle */}
                <button
                    onClick={onTogglePrivacy}
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
                        color: 'var(--text-muted)'
                    }}
                >
                    {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>

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
                    <Link href="/login" style={{
                        textDecoration: 'none',
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#fff',
                        boxShadow: '0 2px 8px var(--accent-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        Login
                    </Link>
                )}
            </div>
        </header>
    );
}
