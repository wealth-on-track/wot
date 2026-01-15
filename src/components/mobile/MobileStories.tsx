"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, TrendingUp, TrendingDown, Zap, Calendar, Award } from "lucide-react";
import type { AssetDisplay } from "@/lib/types";

// --- Types ---
export interface Story {
    id: string;
    type: 'summary' | 'mover' | 'insight' | 'news';
    title: string;
    description: string;
    value?: string;
    change?: number;
    color: string;
    icon: React.ReactNode;
    image?: string;
    linkedAssetId?: string; // ID/Symbol to navigate to
}

interface MobileStoriesProps {
    assets: AssetDisplay[];
    totalValueEUR: number;
    username: string;
    onNavigate: (type: string, payload?: any) => void;
}

// --- Story Generator Logic ---
const INSIGHTS = [
    { title: "Diversification", desc: "Consider adding Real Estate or Gold to balance your tech-heavy portfolio." },
    { title: "Dollar Cost Average", desc: "Markets are volatile. Regular monthly contributions can lower your average cost." },
    { title: "Emergency Fund", desc: "Ensure you have 3-6 months of expenses in Cash/Liquid assets before investing heavily." },
    { title: "Rebalancing", desc: "Your Tech allocation is high. It might be time to take some profits and rebalance." },
    { title: "Long Term", desc: "Time in the market beats timing the market. Stay consistent!" },
    { title: "Dividends", desc: "Reinvesting dividends can significantly compound your growth over time." },
    { title: "Risk Tolerance", desc: "Make sure your portfolio risk aligns with your age and financial goals." },
    { title: "Keep it Simple", desc: "A simple 3-fund portfolio often outperforms complex strategies." }
];

function generateStories(assets: AssetDisplay[], totalValue: number, username: string): Story[] {
    const stories: Story[] = [];

    // 1. Daily Summary
    let totalDailyChangeEUR = 0;
    assets.forEach(a => {
        // Calculate daily change based on previous close
        const price = a.currentPrice || a.previousClose || 0;
        const prev = a.previousClose || price; // If no prev, assume flat
        const changePerShare = price - prev;

        // Approximate daily portfolio value change contribution
        const pctChange = prev > 0 ? (changePerShare / prev) : 0;
        totalDailyChangeEUR += (a.totalValueEUR * pctChange);
    });

    const dailyChangePct = totalValue > 0 ? (totalDailyChangeEUR / totalValue) * 100 : 0;
    const isGreen = dailyChangePct >= 0;

    stories.push({
        id: 'daily-summary',
        type: 'summary',
        title: `Good ${new Date().getHours() < 12 ? 'Morning' : 'Evening'}, ${username}!`,
        description: `Your portfolio moved ${isGreen ? 'up' : 'down'} today. Total Value: €${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        value: `${isGreen ? '+' : ''}${dailyChangePct.toFixed(2)}%`,
        change: dailyChangePct,
        color: isGreen ? '#10b981' : '#ef4444',
        icon: isGreen ? <TrendingUp size={48} /> : <TrendingDown size={48} />
    });

    // 2. Top Mover
    if (assets.length > 0) {
        // Calculate % move for each asset locally
        const assetsWithMove = assets.map(a => {
            const price = a.currentPrice || a.previousClose || 0;
            const prev = a.previousClose || price;
            const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
            return { ...a, _movePct: pct };
        });

        const sortedByMove = [...assetsWithMove].sort((a, b) =>
            Math.abs(b._movePct) - Math.abs(a._movePct)
        );
        const topMover = sortedByMove[0];

        // Only show if movement is significant (>1%) or if it's the only asset
        if (topMover && (Math.abs(topMover._movePct) > 1.0 || assets.length < 3)) {
            const isMoverGreen = topMover._movePct >= 0;
            stories.push({
                id: 'top-mover',
                type: 'mover',
                title: 'Top Mover',
                description: `${topMover.symbol} is moving significantly today. Tap to check details.`,
                value: `${isMoverGreen ? '+' : ''}${topMover._movePct.toFixed(2)}%`,
                color: '#6366f1',
                icon: <Zap size={48} />,
                linkedAssetId: topMover.symbol
            });
        }
    }

    // 3. Random Insight (Pseudo-random based on minutes to rotate every minute or simple random)
    const randomInsight = INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)];
    stories.push({
        id: 'insight',
        type: 'insight',
        title: randomInsight.title,
        description: randomInsight.desc,
        value: 'Pro Tip',
        color: '#f59e0b',
        icon: <Award size={48} />
    });

    // 4. Upcoming (Mock)
    stories.push({
        id: 'upcoming',
        type: 'news',
        title: 'Market Watch',
        description: 'Fed Interest Rate decision is coming up next week. Expect volatility.',
        value: 'Next Week',
        color: '#ec4899',
        icon: <Calendar size={48} />
    });

    return stories;
}

// --- Component ---
import { createPortal } from "react-dom";

export function MobileStories({ assets, totalValueEUR, username, onNavigate }: MobileStoriesProps) {
    const [stories, setStories] = useState<Story[]>([]);
    const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Portal Target
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Transition Lock to prevent double skips
    const isTransitioning = useRef(false);

    // Init stories
    useEffect(() => {
        setStories(generateStories(assets, totalValueEUR, username));
    }, [assets, totalValueEUR, username]);

    // --- Navigation Logic ---
    const goToNextStory = useCallback(() => {
        if (isTransitioning.current) return;
        isTransitioning.current = true;

        setActiveStoryIndex(current => {
            if (current === null) return null;
            if (current < stories.length - 1) {
                setTimeout(() => { isTransitioning.current = false; }, 400); // Unlock after animation
                return current + 1;
            }
            // Finished
            onNavigate('overview');
            setTimeout(() => { isTransitioning.current = false; }, 400);
            return null; // Close
        });
        setProgress(0);
    }, [stories.length, onNavigate]);

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        goToNextStory();
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveStoryIndex(current => {
            if (current === null || current <= 0) {
                return current; // Do nothing if at start or closed
            }
            return current - 1;
        });
        setProgress(0);
    };

    const handleFinish = () => {
        setActiveStoryIndex(null);
        setProgress(0);
        onNavigate('overview');
    };

    const handleClose = () => {
        setActiveStoryIndex(null);
        setProgress(0);
    };

    // --- Timer Logic (Event Driven) ---
    useEffect(() => {
        if (activeStoryIndex === null || isPaused) return;

        const DURATION = 5000;
        const INTERVAL = 50;
        const step = 100 / (DURATION / INTERVAL);

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev + step;
                if (next >= 100) {
                    clearInterval(timer); // Stop immediately
                    goToNextStory();      // Trigger transition
                    return 0;             // Reset visual
                }
                return next;
            });
        }, INTERVAL);

        return () => clearInterval(timer);
    }, [activeStoryIndex, isPaused, goToNextStory]);

    const handleOpen = () => {
        isTransitioning.current = false;
        setActiveStoryIndex(0);
        setProgress(0);
    };

    const onDetailsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeStoryIndex === null) return;

        const story = stories[activeStoryIndex];
        if (story.linkedAssetId) {
            onNavigate('asset', story.linkedAssetId);
        }
        handleClose();
    };

    if (stories.length === 0) return null;

    const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

    // Trigger Icon Component (to be placed in Navbar)
    const StoryTrigger = (
        <div
            onClick={handleOpen}
            style={{
                position: 'relative',
                cursor: 'pointer',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                padding: '2px', // Border width
                background: `linear-gradient(135deg, #f59e0b, #ec4899, #6366f1)`, // Instagram-like gradient
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'var(--bg-main)', // Match navbar bg
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Zap size={18} color="var(--text-primary)" fill="currentColor" style={{ opacity: 0.8 }} />
                </div>
            </div>
            {/* Notification Dot */}
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ef4444',
                border: '2px solid var(--bg-main)'
            }} />
        </div>
    );

    const Overlay = activeStory ? (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: '#000',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column'
            }}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
        >
            {/* Progress Bars */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '10px',
                paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
                zIndex: 20
            }}>
                {stories.map((_, i) => (
                    <div key={i} style={{
                        flex: 1,
                        height: '3px',
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%',
                            background: '#fff',
                            width: i < activeStoryIndex! ? '100%' : i === activeStoryIndex ? `${progress}%` : '0%',
                            transition: i === activeStoryIndex && !isPaused ? 'width 0.05s linear' : 'none'
                        }} />
                    </div>
                ))}
            </div>

            {/* Header: User / Close */}
            <div style={{
                padding: '0 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fff',
                zIndex: 20
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* WOT Logo (Text Based Match) */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        userSelect: 'none'
                    }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.2rem', fontWeight: 900, lineHeight: 1, color: '#fff' }}>W</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.2rem', fontWeight: 900, lineHeight: 1, color: '#6366F1' }}>O</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.2rem', fontWeight: 900, lineHeight: 1, color: '#fff' }}>T</span>
                    </div>

                    {/* WOT Stories Gradient Text */}
                    <span style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        background: 'linear-gradient(135deg, #6366F1 0%, #a855f7 100%)', // Blue-Indigo Gradient
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.02em'
                    }}>
                        Stories
                    </span>

                    <span style={{ fontSize: '0.8rem', opacity: 0.6, color: '#fff', fontWeight: 400 }}>Just now</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); handleClose(); }}
                    style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px' }}
                >
                    <X size={24} />
                </button>
            </div>

            {/* STORY CONTENT CARD */}
            <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem'
            }}>
                {/* Tap Surfaces */}
                <div style={{ position: 'absolute', top: '100px', bottom: '100px', left: 0, width: '30%', zIndex: 10 }} onClick={handlePrev} />
                <div style={{ position: 'absolute', top: '100px', bottom: '100px', right: 0, width: '30%', zIndex: 10 }} onClick={(e) => handleNext(e)} />

                {/* Background Glow */}
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '300px', height: '300px',
                    background: activeStory.color,
                    filter: 'blur(100px)',
                    opacity: 0.4,
                    borderRadius: '50%',
                    zIndex: 1
                }} />

                {/* Story Body */}
                <div style={{ zIndex: 5, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <div style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '40px',
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${activeStory.color}`,
                        boxShadow: `0 20px 50px -10px ${activeStory.color}60`
                    }}>
                        <div style={{ color: '#fff' }}>
                            {activeStory.icon}
                        </div>
                    </div>

                    <div>
                        <h1 style={{
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            color: '#fff',
                            marginBottom: '1rem',
                            lineHeight: 1.1,
                            textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                        }}>
                            {activeStory.value}
                        </h1>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: '0.5rem' }}>
                            {activeStory.title}
                        </h2>
                        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, maxWidth: '300px' }}>
                            {activeStory.description}
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer / CTA (Conditional) */}
            <div style={{
                padding: '2rem',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)',
                zIndex: 20,
                display: 'flex',
                justifyContent: 'center',
                minHeight: '80px' // Reserve space
            }}>
                {activeStory.linkedAssetId && (
                    <button
                        onClick={onDetailsClick}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            padding: '12px 24px',
                            borderRadius: '30px',
                            color: '#fff',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                        }}>
                        See Asset Details <ChevronRight size={16} />
                    </button>
                )}
            </div>

        </div>
    ) : null;

    return (
        <>
            {StoryTrigger}
            {activeStory && mounted && createPortal(Overlay, document.body)}
        </>
    );
}
