"use client";

import { useState, useRef, useCallback, ReactNode } from "react";
import { motion, animate } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface PullToRefreshProps {
    children: ReactNode;
    onRefresh?: () => Promise<void>;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const isPulling = useRef(false);

    const PULL_THRESHOLD = 70; // Distance needed to trigger refresh
    const MAX_PULL = 100; // Maximum pull distance

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (isRefreshing) return;

        // Check if we're at the top of the page
        const scrollY = window.scrollY || document.documentElement.scrollTop;

        if (scrollY <= 0) {
            startY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    }, [isRefreshing]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling.current || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // Pulling down - apply resistance for natural feel
            const resistance = 0.4;
            const pullValue = Math.min(diff * resistance, MAX_PULL);
            setPullDistance(pullValue);
        } else {
            // Scrolling up, reset
            setPullDistance(0);
        }
    }, [isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling.current || isRefreshing) return;

        isPulling.current = false;

        if (pullDistance >= PULL_THRESHOLD) {
            // Trigger refresh
            setIsRefreshing(true);

            // Haptic feedback
            if (typeof window !== 'undefined' && window.navigator?.vibrate) {
                window.navigator.vibrate(20);
            }

            try {
                if (onRefresh) {
                    await onRefresh();
                } else {
                    // Default: use Next.js router refresh
                    router.refresh();
                    // Wait for the refresh to complete
                    await new Promise(resolve => setTimeout(resolve, 1200));
                }
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            // Animate back to 0
            setPullDistance(0);
        }

        startY.current = 0;
    }, [isRefreshing, pullDistance, onRefresh, router]);

    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
    const isTriggered = pullDistance >= PULL_THRESHOLD;

    return (
        <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                position: 'relative',
                height: '100%',
                overflow: 'hidden'
            }}
        >
            {/* Pull Indicator */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 100,
                    pointerEvents: 'none',
                    height: pullDistance,
                    overflow: 'hidden',
                    transition: isPulling.current ? 'none' : 'height 0.3s ease-out'
                }}
            >
                <motion.div
                    initial={false}
                    animate={{
                        opacity: progress,
                        scale: 0.5 + progress * 0.5
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--surface)',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                        border: '1px solid var(--border)'
                    }}
                >
                    <motion.div
                        initial={false}
                        animate={{
                            rotate: isRefreshing ? 360 : progress * 180
                        }}
                        transition={isRefreshing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0 }}
                    >
                        <RefreshCw
                            size={18}
                            style={{
                                color: isTriggered || isRefreshing ? 'var(--accent)' : 'var(--text-muted)',
                                transition: 'color 0.2s'
                            }}
                        />
                    </motion.div>
                </motion.div>
            </div>

            {/* Content - pushed down by pull */}
            <div
                style={{
                    height: '100%',
                    transform: `translateY(${pullDistance}px)`,
                    transition: isPulling.current ? 'none' : 'transform 0.3s ease-out'
                }}
            >
                {children}
            </div>
        </div>
    );
}
