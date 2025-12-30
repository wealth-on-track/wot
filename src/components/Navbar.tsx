import Link from "next/link";
import { auth } from "@/auth";
import { handleSignOut } from "@/lib/authActions";
import { InlineAssetSearch } from "./InlineAssetSearch";
import { CurrencySelector } from "./CurrencySelector";
import { ThemeToggle } from "./ThemeToggle";
import { LogOut } from "lucide-react";

interface NavbarProps {
    totalBalance?: number;
    username?: string;
    isOwner?: boolean;
    showPortfolioButton?: boolean;
}

export async function Navbar({ totalBalance, username, isOwner, showPortfolioButton }: NavbarProps) {
    const session = await auth();

    return (
        <nav className="glass-panel" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            borderRadius: '0',
            border: 'none',
            borderBottom: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            width: '100%',
            height: '4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1rem', // Match global container padding if needed
                width: '100%',
                maxWidth: '1200px', // Match global container max-width
                height: '100%'
            }}>
                {/* Left: Logo */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Link href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '2px', lineHeight: 1, textDecoration: 'none' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.05em' }} className="gradient-text">Modern Portfolio Tracker</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 500, color: 'var(--text-secondary)' }}>Track your wealth in modern way!</span>
                    </Link>
                </div>

                {/* Center: Search Bar (Only for Owner) */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', maxWidth: '350px' }}>
                    {isOwner && (
                        <div style={{ width: '100%', transform: 'scale(0.9)' }}>
                            <InlineAssetSearch />
                        </div>
                    )}
                </div>

                {/* Right: User Actions */}
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    {session?.user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {showPortfolioButton && (
                                <Link
                                    href={`/${session.user?.name}`}
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)',
                                        textDecoration: 'none',
                                    }}
                                >
                                    My Portfolio
                                </Link>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ThemeToggle />
                                <CurrencySelector />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0' }}>
                                    <form action={handleSignOut} style={{ lineHeight: 1 }}>
                                        <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: 0 }}>
                                            Sign Out
                                        </button>
                                    </form>
                                    {username && (
                                        <div style={{ fontSize: '0.65rem', opacity: 0.6, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.2 }}>
                                            @{username}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Link href="/login" style={{ opacity: 0.8, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                Login
                            </Link>
                            <Link href="/register" className="glass-button" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                                Get Started
                            </Link>
                        </>
                    )}
                </div>
            </div >
        </nav >
    );
}
