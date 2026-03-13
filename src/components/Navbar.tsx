import Link from "next/link";
import { auth } from "@/auth";
import { InlineAssetSearch } from "./InlineAssetSearch";


interface NavbarProps {
    totalBalance?: number;
    username?: string;
    isOwner?: boolean;
    showPortfolioButton?: boolean;
}

export async function Navbar({ username, isOwner }: NavbarProps) {
    const session = await auth();
    const sessionUser = session?.user as ({ username?: string; name?: string | null; email?: string | null } | undefined);
    const currentUsername = (sessionUser?.username || sessionUser?.name || username)?.toLowerCase();

    return (
        <nav className="wot-navbar">
            <div className="navbar-inner-container wot-navbar-frame">
                <div className="wot-navbar-layout">
                    <div className="wot-navbar-brand-wrap">
                        <Link href="/" className="brand-lockup">
                            <div className="brand-mark" aria-hidden="true">
                                <span className="brand-glyph">W</span>
                                <span className="brand-glyph brand-glyph-accent">O</span>
                                <span className="brand-glyph">T</span>
                            </div>
                            <div className="brand-copy">
                                <span className="brand-title">Wealth on Track</span>
                                <span className="brand-subtitle">Investor workspace</span>
                            </div>
                            <span className="brand-badge">Beta</span>
                        </Link>
                    </div>

                    <div className="wot-navbar-spacer" />

                    <div className="wot-navbar-search">
                        {isOwner && (
                            <div className="wot-navbar-search-inner">
                                <InlineAssetSearch />
                            </div>
                        )}
                    </div>

                    <div className="wot-navbar-actions">
                        {!session?.user && (
                            <div className="wot-navbar-guest">
                                <Link href="/login" className="wot-navbar-login-link">
                                    Login
                                </Link>
                                <Link href="/login" className="glass-button wot-navbar-cta-link">
                                    Get Started
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

/* autonomous-engine job:JOB-20260309-382 local change marker */

/* autonomous-engine:JOB-20260309-382:single-functional-change */
