"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Target, PieChart, ArrowRight, Check, LogOut, ShieldCheck, Sparkles, Activity, Globe2, Layers3 } from "lucide-react";
import { handleSignOut } from "@/lib/authActions";

interface LandingPageProps {
    isLoggedIn: boolean;
    username?: string;
    userEmail?: string;
    buildTag?: string;
}

const featureItems = [
    {
        icon: PieChart,
        title: "Portfolio Intelligence",
        description: "Track stocks, funds, crypto, gold, and cash in one premium dashboard with clear allocation visibility.",
        bullets: ["Multi-asset tracking", "Automatic valuation", "Clean allocation view"],
        preview: "/landing/Dashboard-overview-2.png",
        alt: "Portfolio intelligence preview",
    },
    {
        icon: TrendingUp,
        title: "Performance Analytics",
        description: "Benchmark against market indexes with readable charts that highlight return quality, not just raw numbers.",
        bullets: ["Benchmark overlays", "Timeline performance", "Gain/loss clarity"],
        preview: "/landing/Chart-Analytics-2.png",
        alt: "Performance analytics preview",
    },
    {
        icon: Target,
        title: "Goal Execution",
        description: "Turn long-term targets into visible milestones so progress feels concrete and measurable every week.",
        bullets: ["Custom goal paths", "Progress milestones", "Momentum feedback"],
        preview: "/landing/Asset-list-2.png",
        alt: "Goal tracking preview",
    },
];

export function LandingPage({ isLoggedIn, username, userEmail, buildTag }: LandingPageProps) {
    const [isMobile, setIsMobile] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-main)" }}>
            <section
                className="premium-shell"
                style={{
                    position: "relative",
                    overflow: "hidden",
                    borderBottom: "1px solid var(--border)",
                    background: "linear-gradient(180deg, color-mix(in oklab, var(--accent) 10%, var(--bg-main)) 0%, var(--bg-main) 56%)",
                }}
            >
                <div className="soft-grid" />

                <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "1rem 1rem 2.75rem" : "1.25rem 2rem 5rem", position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? "1.75rem" : "2.5rem" }}>
                        <Link href="/" className="brand-lockup">
                            <div className="brand-mark" aria-hidden="true">
                                <span className="brand-glyph">W</span>
                                <span className="brand-glyph brand-glyph-accent">O</span>
                                <span className="brand-glyph">T</span>
                            </div>
                            <div className="brand-copy">
                                <span className="brand-title">Wealth on Track</span>
                                <span className="brand-subtitle">Portfolio command center</span>
                            </div>
                            {!isMobile && <span className="brand-badge">Beta</span>}
                        </Link>

                        {isLoggedIn ? (
                            <div className="hero-auth-cluster">
                                <Link
                                    href={`/${username}`}
                                    className="btn-primary hero-pill hero-pill-primary"
                                >
                                    My Portfolio
                                    <ArrowRight size={16} />
                                </Link>
                                <form action={handleSignOut} className="hero-auth-form">
                                    <button
                                        type="submit"
                                        className="hero-pill hero-pill-subtle hero-pill-danger"
                                    >
                                        <LogOut size={15} />
                                        Log Out
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                className="hero-pill hero-pill-subtle"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.05fr 0.95fr", gap: isMobile ? "2rem" : "3.25rem", alignItems: "center" }}>
                        <div style={{ textAlign: isMobile ? "center" : "left" }}>
                            <div className="section-kicker" style={{ marginBottom: "1rem" }}>
                                <Sparkles size={13} />
                                Designed for long-term investors
                            </div>

                            <h1 className="landing-hero-title">
                                Track your wealth with
                                <span className="landing-hero-title-accent">
                                    confidence and clarity.
                                </span>
                            </h1>

                            <p style={{ fontSize: isMobile ? "1rem" : "1.12rem", lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 560, margin: isMobile ? "0 auto 1.85rem" : "0 0 1.85rem" }}>
                                WOT gives you a clean portfolio command center: better readability, smarter comparisons, and premium UX that keeps your money decisions focused.
                            </p>

                            <div className="proof-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", marginBottom: "1.5rem" }}>
                                {[
                                    { icon: Activity, label: "Decision-first UI", text: "Readable states and strong hierarchy, even when portfolios get busy." },
                                    { icon: Globe2, label: "Multi-asset coverage", text: "Stocks, funds, crypto, cash, and gold in one view." },
                                    { icon: Layers3, label: "Cross-device continuity", text: "Desktop depth with a mobile layout that still feels premium." },
                                ].map(({ icon: Icon, label, text }, idx) => (
                                    <div key={label} className={`proof-card premium-panel premium-panel-hover rise-in rise-in-delay-${idx + 1}`} style={{ textAlign: "left" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.55rem" }}>
                                            <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklab, var(--accent) 20%, transparent)", color: "var(--accent)" }}>
                                                <Icon size={16} />
                                            </div>
                                            <strong style={{ fontSize: "0.9rem" }}>{label}</strong>
                                        </div>
                                        <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>{text}</p>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "0.8rem", alignItems: isMobile ? "stretch" : "center", justifyContent: isMobile ? "center" : "flex-start", marginBottom: "1rem" }}>
                                {!isLoggedIn ? (
                                    <>
                                        <Link href="/login" className="btn-primary">
                                            Start Free
                                            <ArrowRight size={18} />
                                        </Link>
                                        <Link href="/demo" className="btn-secondary">
                                            View Live Demo
                                        </Link>
                                    </>
                                ) : (
                                    <div className="landing-signed-in" style={{ alignItems: isMobile ? "center" : "flex-start" }}>
                                        <span className="landing-signed-in-label">Signed in as {userEmail || username}</span>
                                        <Link href={`/${username}`} className="landing-signed-in-link">
                                            Open dashboard →
                                        </Link>
                                    </div>
                                )}
                            </div>

                            <div className="landing-trust-row" aria-label="Signup reassurance">
                                <span>No credit card</span>
                                <span aria-hidden="true">•</span>
                                <span>2-minute setup</span>
                                <span aria-hidden="true">•</span>
                                <span>Free forever</span>
                            </div>
                        </div>

                        {!isMobile ? (
                            <div style={{ position: "relative" }}>
                                <div className="premium-panel" style={{ borderRadius: "24px", overflow: "hidden" }}>
                                    <Image src="/landing/Dashboard-overview-1.png" alt="WOT dashboard" width={860} height={620} style={{ width: "100%", height: "auto", display: "block" }} priority />
                                </div>
                                <div className="premium-panel" style={{ position: "absolute", right: -14, bottom: -26, width: 188, borderRadius: 20, overflow: "hidden", border: "2px solid var(--bg-primary)" }}>
                                    <Image src="/landing/Mobile-view-1.png" alt="WOT mobile view" width={188} height={390} style={{ width: "100%", height: "auto", display: "block" }} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: "0.2rem" }}>
                                <div className="premium-panel" style={{ borderRadius: "18px", overflow: "hidden" }}>
                                    <Image src="/landing/Dashboard-overview-1.png" alt="WOT dashboard preview" width={860} height={620} style={{ width: "100%", height: "auto", display: "block" }} priority />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="metric-grid" style={{ marginTop: isMobile ? "1.6rem" : "2rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                        {[
                            ["Readability", "Dense portfolios stay scannable", "A tighter visual hierarchy keeps the dashboard useful instead of overwhelming."],
                            ["Privacy", "Hide sensitive values on demand", "One-tap masking makes reviews safer in shared or public spaces."],
                            ["Continuity", "Desktop depth with mobile discipline", "The same design language carries across the surfaces investors use most."],
                        ].map(([eyebrow, title, copy], idx) => (
                            <div key={eyebrow} className={`premium-panel premium-panel-hover metric-card rise-in rise-in-delay-${idx + 1}`}>
                                <div className="metric-eyebrow">{eyebrow}</div>
                                <div className="metric-title">{title}</div>
                                <div className="metric-copy">{copy}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section style={{ padding: isMobile ? "3rem 1rem" : "5rem 2rem", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: isMobile ? "2rem" : "3rem" }}>
                        <div className="section-kicker" style={{ marginBottom: "0.9rem" }}>
                            <PieChart size={13} />
                            Product surfaces
                        </div>
                        <h2 style={{ fontSize: isMobile ? "1.6rem" : "2.25rem", marginBottom: "0.8rem", letterSpacing: "-0.02em" }}>Built for clarity, not noise</h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: isMobile ? "0.95rem" : "1.05rem", maxWidth: 700, margin: "0 auto", lineHeight: 1.65 }}>
                            Every surface is optimized for fast interpretation: where your money sits, how it performs, and what needs attention.
                        </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "1.2rem" }}>
                        {featureItems.map((feature, idx) => {
                            const Icon = feature.icon;
                            return (
                                <article key={feature.title} className={`premium-panel premium-panel-hover rise-in rise-in-delay-${idx + 1}`} style={{ position: "relative", overflow: "hidden", borderRadius: 18, padding: isMobile ? "1.15rem" : "1.4rem", minHeight: isMobile ? "auto" : 300 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", marginBottom: "0.9rem" }}>
                                        <Icon color="white" size={22} />
                                    </div>
                                    <h3 style={{ fontSize: "1.15rem", marginBottom: "0.55rem" }}>{feature.title}</h3>
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.55, marginBottom: "0.85rem" }}>{feature.description}</p>
                                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.95rem" }}>
                                        {feature.bullets.map((bullet) => (
                                            <li key={bullet} style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-secondary)", fontSize: "0.84rem" }}>
                                                <Check size={14} style={{ color: "var(--accent)" }} />
                                                {bullet}
                                            </li>
                                        ))}
                                    </ul>

                                    {!isMobile ? (
                                        <div style={{ position: "absolute", right: -4, bottom: -10, width: 150, height: 105, borderRadius: 10, overflow: "hidden", border: "2px solid var(--bg-primary)", boxShadow: "0 8px 20px rgba(0,0,0,0.3)", transform: "rotate(3deg)" }}>
                                            <Image src={feature.preview} alt={feature.alt} width={150} height={105} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        </div>
                                    ) : (
                                        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 6px 16px rgba(0,0,0,0.16)" }}>
                                            <Image src={feature.preview} alt={feature.alt} width={500} height={290} style={{ width: "100%", height: "auto", display: "block" }} />
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section style={{ padding: isMobile ? "3rem 1rem 4rem" : "5rem 2rem 6rem" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: isMobile ? "2rem" : "2.6rem" }}>
                        <div className="section-kicker" style={{ marginBottom: "0.9rem" }}>
                            <TrendingUp size={13} />
                            Premium layout system
                        </div>
                        <h2 style={{ fontSize: isMobile ? "1.55rem" : "2.2rem", marginBottom: "0.6rem", letterSpacing: "-0.02em" }}>Premium interface. Real decision support.</h2>
                        <p style={{ color: "var(--text-secondary)", maxWidth: 700, margin: "0 auto", lineHeight: 1.65 }}>The dashboard is designed to stay readable as your portfolio grows — no clutter, no visual fatigue.</p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: isMobile ? "1rem" : "1.4rem" }}>
                        {["/landing/Chart-Analytics-1.png", "/landing/Asset-list-1.png"].map((src, idx) => (
                            <div key={src} className="premium-panel" style={{ borderRadius: 18, overflow: "hidden" }}>
                                <Image src={src} alt={idx === 0 ? "Analytics dashboard" : "Asset list"} width={700} height={450} style={{ width: "100%", height: "auto", display: "block" }} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {!isLoggedIn && (
                <section className="landing-cta-shell" style={{ padding: isMobile ? "2.8rem 1rem" : "4.5rem 2rem" }}>
                    <div className="landing-cta-grid" />
                    <div className="landing-cta-content">
                        <div className="landing-cta-kicker">
                            <ShieldCheck size={14} />
                            Built for investor confidence
                        </div>
                        <h2 className="landing-cta-title" style={{ fontSize: isMobile ? "1.8rem" : "2.6rem" }}>Ready to upgrade your portfolio workflow?</h2>
                        <p className="landing-cta-copy" style={{ fontSize: isMobile ? "0.98rem" : "1.12rem" }}>
                            Join investors who want premium UX and practical insights in one place.
                        </p>
                        <Link href="/login" className="landing-cta-btn">
                            Create Free Account
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </section>
            )}

            <button
                type="button"
                className="landing-build-tag"
                style={{
                    display: isMobile ? "none" : "block",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer"
                }}
                onClick={async () => {
                    const value = `build ${buildTag || "dev"}`;
                    try {
                        await navigator.clipboard.writeText(value);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1200);
                    } catch {
                        setCopied(false);
                    }
                }}
                aria-label="Copy build tag"
                title="Copy build tag"
            >
                {copied ? "Copied" : `build ${buildTag || "dev"}`}
            </button>
        </div>
    );
}
