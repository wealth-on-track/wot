import Link from "next/link";
import { auth } from "@/auth";
import { handleSignOut } from "@/lib/authActions";
import { InlineAssetSearch } from "./InlineAssetSearch";
import { CurrencySelector } from "./CurrencySelector";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { SignOutButton } from "./SignOutButton";
import { NavbarActions } from "./NavbarActions";
import { ArrowUpRight, Link2, LogOut, SlidersHorizontal, Sun, Moon } from "lucide-react";

interface NavbarProps {
    totalBalance?: number;
    username?: string;
    isOwner?: boolean;
    showPortfolioButton?: boolean;
}

export async function Navbar({ totalBalance, username, isOwner, showPortfolioButton }: NavbarProps) {
    const session = await auth();

    return (
        <nav
            className="fixed top-0 w-full z-50"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                margin: 0,
                width: '100%',
                zIndex: 9998,
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                height: '5rem', // Compact navbar height
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}>
            {/* Dark Mode Override Handled by parent or context? User said bg-white. I'll stick to white as requested for "High Contrast". If dark mode needed, I'd need conditional. Assuming Light Mode focus or explicit override request. "Arka Plan: Tam beyaz". */}

            <div className="navbar-inner-container" style={{
                width: '100%',
                maxWidth: '80rem',
                padding: '0 3rem',
                margin: '0 auto',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
            }}>
                {/* Layout Wrapper */}
                <div style={{
                    display: 'flex',
                    width: '100%',
                    gap: '1.5rem',
                    alignItems: 'center'
                }}>

                    {/* LEFT: Tightly Anchored Branding Component */}
                    <div style={{ padding: '0.4rem 0.6rem', position: 'relative' }}>
                        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            <div style={{
                                display: 'flex',
                                gap: '2px', /* Equal spacing between letters */
                                userSelect: 'none',
                                transition: 'opacity 0.2s ease',
                            }}>
                                {/* Column 1: W -> WEALTH */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ height: '1.8rem', display: 'flex', alignItems: 'center', marginBottom: '0px' }}>
                                        <span className="logo-letter-wt" style={{
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: '2.2rem',
                                            fontWeight: 900,
                                            lineHeight: 1,
                                            letterSpacing: '-0.03em'
                                        }}>W</span>
                                    </div>
                                    <span style={{
                                        fontSize: '8.5px',
                                        fontWeight: 400,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.02em',
                                        opacity: 0.8
                                    }}>WEALTH</span>
                                </div>

                                {/* Column 2: O -> ON (The Accent Anchor) */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ height: '1.8rem', display: 'flex', alignItems: 'center', marginBottom: '0px' }}>
                                        <span style={{
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: '2.2rem',
                                            fontWeight: 900,
                                            color: 'var(--accent)', /* Indigo Accent Dokunuşu */
                                            lineHeight: 1,
                                            letterSpacing: '-0.03em',
                                            filter: 'drop-shadow(0 0 8px var(--accent-glow))'
                                        }}>O</span>
                                    </div>
                                    <span style={{
                                        fontSize: '8.5px',
                                        fontWeight: 400,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.02em',
                                        opacity: 0.8
                                    }}>ON</span>
                                </div>

                                {/* Column 3: T -> TRACK */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ height: '1.8rem', display: 'flex', alignItems: 'center', marginBottom: '0px' }}>
                                        <span className="logo-letter-wt" style={{
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: '2.2rem',
                                            fontWeight: 900,
                                            lineHeight: 1,
                                            letterSpacing: '-0.03em'
                                        }}>T</span>
                                    </div>
                                    <span style={{
                                        fontSize: '8.5px',
                                        fontWeight: 400,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.02em',
                                        opacity: 0.8
                                    }}>TRACK</span>
                                </div>
                            </div>

                            {/* Beta Badge */}
                            <div style={{
                                position: 'absolute',
                                top: '-2px',
                                right: '-18px',
                                fontSize: '7px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                padding: '2px 6px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                color: '#fff',
                                boxShadow: '0 2px 8px var(--accent-glow)',
                                animation: 'pulse-glow 3s ease-in-out infinite',
                                userSelect: 'none',
                                whiteSpace: 'nowrap'
                            }}>
                                BETA V1
                            </div>
                        </Link>
                    </div>

                    {/* SPACER: Takes up remaining width of Main Content area to push Search right */}
                    <div style={{ flex: 1 }} />

                    {/* SEARCH: Aligned to right of Main Content (Performance Card) */}
                    <div style={{
                        width: '450px', // Fixed width for stability
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0
                    }}>
                        {isOwner && (
                            <div style={{ width: '100%' }}>
                                <InlineAssetSearch />
                            </div>
                        )}
                    </div>

                    {/* GAP: Matches Dashboard Layout Gap (1.5rem) */}
                    <div style={{
                        width: '1.5rem',
                        flexShrink: 0
                    }} />

                    {/* RIGHT COLUMN: Action Buttons (Aligned with Sidebar) */}
                    <div style={{
                        width: '380px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end', // Right aligned
                        height: '100%',
                        gap: '0.5rem'
                    }}>
                        {/* 1. Global Toggles (Always Visible) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem', paddingRight: '0.5rem', borderRight: '1px solid var(--border)' }}>
                            <CurrencySelector />
                            <LanguageToggle />
                            <ThemeToggle />
                        </div>

                        {session?.user ? (
                            <>
                                {/* Action Group */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {/* 1. Filter (Portal Target) */}
                                    <div id="navbar-extra-actions" style={{ display: 'flex', alignItems: 'center' }}></div>

                                    {/* 2. Actions (Integrations + Logout) */}
                                    <NavbarActions userEmail={session?.user?.email} />
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <Link href="/login" style={{ opacity: 0.8, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                    Login
                                </Link>
                                <Link href="/login" className="glass-button" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                                    Get Started
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </nav >

    );
}
