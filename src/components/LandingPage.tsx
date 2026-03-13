"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Target, PieChart, ArrowRight, Check, LogOut, ShieldCheck, Sparkles } from "lucide-react";
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

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-main)" }}>
            <section
                style={{
                    position: "relative",
                    overflow: "hidden",
                    borderBottom: "1px solid var(--border)",
                    background: "linear-gradient(180deg, color-mix(in oklab, var(--accent) 8%, var(--bg-main)) 0%, var(--bg-main) 55%)",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: "-20%",
                        left: "-10%",
                        width: "120%",
                        height: "90%",
                        background: "radial-gradient(circle at top, var(--accent-glow), transparent 70%)",
                        pointerEvents: "none",
                    }}
                />

                <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "1rem 1rem 2.75rem" : "1.25rem 2rem 5rem", position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? "1.75rem" : "2.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <div style={{ fontSize: isMobile ? "1.35rem" : "1.55rem", fontWeight: 900, letterSpacing: "-0.03em" }}>WOT</div>
                            <span style={{ fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--text-secondary)", textTransform: "uppercase" }}>Wealth on Track</span>
                        </div>

                        {isLoggedIn ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Link
                                    href={`/${username}`}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.45rem",
                                        padding: "0.65rem 0.95rem",
                                        borderRadius: "999px",
                                        fontSize: "0.85rem",
                                        textDecoration: "none",
                                        fontWeight: 700,
                                        color: "white",
                                        background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                                    }}
                                >
                                    My Portfolio
                                    <ArrowRight size={16} />
                                </Link>
                                <form action={handleSignOut} style={{ margin: 0 }}>
                                    <button
                                        type="submit"
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            padding: "0.62rem 0.9rem",
                                            borderRadius: "999px",
                                            border: "1px solid var(--border)",
                                            background: "var(--bg-primary)",
                                            color: "var(--text-secondary)",
                                            fontSize: "0.84rem",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        <LogOut size={15} />
                                        Log Out
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                style={{
                                    textDecoration: "none",
                                    color: "var(--text-primary)",
                                    fontWeight: 650,
                                    fontSize: "0.85rem",
                                    border: "1px solid var(--border)",
                                    padding: "0.5rem 0.8rem",
                                    borderRadius: "999px",
                                    background: "color-mix(in oklab, var(--surface) 90%, transparent)",
                                }}
                            >
                                Sign In
                            </Link>
                        )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.05fr 0.95fr", gap: isMobile ? "2rem" : "3.25rem", alignItems: "center" }}>
                        <div style={{ textAlign: isMobile ? "center" : "left" }}>
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.45rem",
                                    padding: "0.35rem 0.72rem",
                                    borderRadius: "999px",
                                    border: "1px solid var(--border)",
                                    background: "color-mix(in oklab, var(--surface) 85%, transparent)",
                                    marginBottom: "1rem",
                                    color: "var(--text-secondary)",
                                    fontSize: "0.74rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                }}
                            >
                                <Sparkles size={13} />
                                Designed for long-term investors
                            </div>

                            <h1 style={{ fontSize: isMobile ? "2.1rem" : "3.6rem", lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: "1rem" }}>
                                Track your wealth with
                                <span style={{ display: "block", background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                                    confidence and clarity.
                                </span>
                            </h1>

                            <p style={{ fontSize: isMobile ? "1rem" : "1.12rem", lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 560, margin: isMobile ? "0 auto 1.85rem" : "0 0 1.85rem" }}>
                                WOT gives you a clean portfolio command center: better readability, smarter comparisons, and premium UX that keeps your money decisions focused.
                            </p>

                            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "0.8rem", alignItems: isMobile ? "stretch" : "center", justifyContent: isMobile ? "center" : "flex-start", marginBottom: "1rem" }}>
                                {!isLoggedIn ? (
                                    <>
                                        <Link
                                            href="/login"
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "0.6rem",
                                                padding: "0.92rem 1.4rem",
                                                borderRadius: "12px",
                                                color: "white",
                                                textDecoration: "none",
                                                fontWeight: 700,
                                                background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                                                boxShadow: "0 10px 30px var(--accent-glow)",
                                            }}
                                        >
                                            Start Free
                                            <ArrowRight size={18} />
                                        </Link>
                                        <Link
                                            href="/demo"
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                padding: "0.92rem 1.4rem",
                                                borderRadius: "12px",
                                                color: "var(--text-primary)",
                                                textDecoration: "none",
                                                fontWeight: 650,
                                                background: "var(--bg-primary)",
                                                border: "1px solid var(--border)",
                                            }}
                                        >
                                            View Live Demo
                                        </Link>
                                    </>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: isMobile ? "center" : "flex-start" }}>
                                        <span style={{ color: "var(--text-secondary)", fontSize: "0.86rem" }}>Signed in as {userEmail || username}</span>
                                        <Link href={`/${username}`} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}>
                                            Open dashboard →
                                        </Link>
                                    </div>
                                )}
                            </div>

                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No credit card · 2-minute setup · Free forever</div>
                        </div>

                        {!isMobile ? (
                            <div style={{ position: "relative" }}>
                                <div style={{ borderRadius: "22px", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 20px 55px rgba(0,0,0,0.35)" }}>
                                    <Image src="/landing/Dashboard-overview-1.png" alt="WOT dashboard" width={860} height={620} style={{ width: "100%", height: "auto", display: "block" }} priority />
                                </div>
                                <div style={{ position: "absolute", right: -14, bottom: -26, width: 188, borderRadius: 18, overflow: "hidden", border: "2px solid var(--bg-primary)", boxShadow: "0 16px 35px rgba(0,0,0,0.4)" }}>
                                    <Image src="/landing/Mobile-view-1.png" alt="WOT mobile view" width={188} height={390} style={{ width: "100%", height: "auto", display: "block" }} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: "0.2rem" }}>
                                <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 14px 34px rgba(0,0,0,0.22)" }}>
                                    <Image src="/landing/Dashboard-overview-1.png" alt="WOT dashboard preview" width={860} height={620} style={{ width: "100%", height: "auto", display: "block" }} priority />
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: isMobile ? "1.6rem" : "2rem", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
                        {[
                            ["10k+", "investors tracking wealth"],
                            ["5 asset classes", "stocks, funds, crypto, gold, cash"],
                            ["< 3 min", "from sign-up to first portfolio view"],
                        ].map(([value, label]) => (
                            <div key={value} style={{ padding: "0.85rem 1rem", borderRadius: 12, border: "1px solid var(--border)", background: "color-mix(in oklab, var(--surface) 88%, transparent)" }}>
                                <div style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.2rem" }}>{value}</div>
                                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section style={{ padding: isMobile ? "3rem 1rem" : "5rem 2rem", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: isMobile ? "2rem" : "3rem" }}>
                        <h2 style={{ fontSize: isMobile ? "1.6rem" : "2.25rem", marginBottom: "0.8rem", letterSpacing: "-0.02em" }}>Built for clarity, not noise</h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: isMobile ? "0.95rem" : "1.05rem", maxWidth: 700, margin: "0 auto", lineHeight: 1.65 }}>
                            Every surface is optimized for fast interpretation: where your money sits, how it performs, and what needs attention.
                        </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "1.2rem" }}>
                        {featureItems.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <article key={feature.title} style={{ position: "relative", overflow: "hidden", borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-primary)", padding: isMobile ? "1.15rem" : "1.4rem", minHeight: isMobile ? "auto" : 300 }}>
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
                        <h2 style={{ fontSize: isMobile ? "1.55rem" : "2.2rem", marginBottom: "0.6rem", letterSpacing: "-0.02em" }}>Premium interface. Real decision support.</h2>
                        <p style={{ color: "var(--text-secondary)", maxWidth: 700, margin: "0 auto", lineHeight: 1.65 }}>The dashboard is designed to stay readable as your portfolio grows — no clutter, no visual fatigue.</p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: isMobile ? "1rem" : "1.4rem" }}>
                        {["/landing/Chart-Analytics-1.png", "/landing/Asset-list-1.png"].map((src, idx) => (
                            <div key={src} style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 10px 36px rgba(0,0,0,0.2)" }}>
                                <Image src={src} alt={idx === 0 ? "Analytics dashboard" : "Asset list"} width={700} height={450} style={{ width: "100%", height: "auto", display: "block" }} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {!isLoggedIn && (
                <section style={{ padding: isMobile ? "2.8rem 1rem" : "4.5rem 2rem", background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, opacity: 0.13, backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
                    <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.8rem", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            <ShieldCheck size={14} />
                            Built for investor confidence
                        </div>
                        <h2 style={{ color: "white", fontSize: isMobile ? "1.8rem" : "2.6rem", letterSpacing: "-0.02em", marginBottom: "0.9rem" }}>Ready to upgrade your portfolio workflow?</h2>
                        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: isMobile ? "0.98rem" : "1.12rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                            Join investors who want premium UX and practical insights in one place.
                        </p>
                        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem", borderRadius: 12, padding: "0.92rem 1.5rem", textDecoration: "none", color: "var(--accent)", background: "white", fontWeight: 800 }}>
                            Create Free Account
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </section>
            )}

            <div
                style={{
                    position: "fixed",
                    left: 10,
                    bottom: 8,
                    fontSize: 10,
                    color: "var(--text-muted)",
                    opacity: 0.72,
                    zIndex: 20,
                    pointerEvents: "none",
                    userSelect: "none",
                    display: isMobile ? "none" : "block",
                }}
            >
                build {buildTag || "dev"}
            </div>
        </div>
    );
}
