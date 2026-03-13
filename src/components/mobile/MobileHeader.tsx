"use client";

import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { handleSignOut } from "@/lib/authActions";
import { LogOut, User, Eye, EyeOff, Link as LinkIcon, Shield, Moon, Sun } from "lucide-react";

interface MobileHeaderProps {
    username: string;
    isOwner: boolean;
    isPrivacyMode: boolean;
    onTogglePrivacy: () => void;
    onLogoClick?: () => void;
    assets?: unknown[];
    totalValueEUR?: number;
    onNavigate?: (type: "settings" | "asset" | "overview", payload?: string) => void;
}

export function MobileHeader({
    username,
    isOwner,
    isPrivacyMode,
    onTogglePrivacy,
    onLogoClick,
    assets: _assets,
    totalValueEUR: _totalValueEUR,
    onNavigate = () => { }
}: MobileHeaderProps) {
    void _assets;
    void _totalValueEUR;
    const { theme, toggleTheme } = useTheme();

    return (
        <header style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            background: 'color-mix(in oklab, var(--bg-main) 72%, transparent)',
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
            <div
                onClick={onLogoClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    flexWrap: 'nowrap',
                    cursor: onLogoClick ? 'pointer' : 'default'
                }}
            >
                <div className="brand-lockup">
                    <div className="brand-mark" aria-hidden="true">
                        <span className="brand-glyph">W</span>
                        <span className="brand-glyph brand-glyph-accent">O</span>
                        <span className="brand-glyph">T</span>
                    </div>
                    <div className="brand-copy">
                        <span className="brand-title">WOT</span>
                        <span className="brand-subtitle">Mobile dashboard</span>
                    </div>
                    <span className="brand-badge">Beta</span>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

                {/* Public Share Page (left of privacy eye) */}
                <Link
                    href={`/${username}/portfolio_public`}
                    className="premium-icon-btn"
                    title="Public share page"
                >
                    <LinkIcon size={17} />
                </Link>

                {/* Admin (dev1/user1 owner only) */}
                {isOwner && (username === 'dev1' || username === 'user1') && (
                    <Link
                        href="/admin/autonomous-engine"
                        className="premium-icon-btn"
                        title="Admin"
                    >
                        <Shield size={17} />
                    </Link>
                )}

                {/* Privacy Toggle */}
                <button
                    onClick={onTogglePrivacy}
                    className="premium-icon-btn"
                >
                    {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="premium-icon-btn"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* Sign Out (if owner) OR Login/Get Started (if guest) */}
                {isOwner ? (
                    <>
                        {/* User Profile / Settings */}
                        <div
                            onClick={() => onNavigate && onNavigate('settings')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}>
                            <div
                                className="premium-icon-btn"
                                style={{
                                    cursor: 'pointer'
                                }}
                            >
                                <User size={18} />
                            </div>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={() => handleSignOut()}
                            className="premium-icon-btn"
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
