"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, TrendingUp, PieChart, Wallet } from "lucide-react";

const LOADING_PHASES = [
    { progress: 15, message: "Connecting to servers...", icon: Loader2 },
    { progress: 35, message: "Fetching exchange rates...", icon: TrendingUp },
    { progress: 55, message: "Loading your positions...", icon: Wallet },
    { progress: 75, message: "Calculating portfolio value...", icon: PieChart },
    { progress: 90, message: "Preparing dashboard...", icon: Loader2 },
    { progress: 100, message: "Almost there...", icon: Loader2 },
];

export default function Loading() {
    const [currentPhase, setCurrentPhase] = useState(0);
    const [progress, setProgress] = useState(0);
    const currentPhaseRef = useRef(0);

    useEffect(() => {
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                const targetProgress = LOADING_PHASES[currentPhaseRef.current]?.progress || 100;
                if (prev < targetProgress) {
                    return Math.min(prev + 1, targetProgress);
                }
                return prev;
            });
        }, 30);

        const phaseInterval = setInterval(() => {
            setCurrentPhase(prev => {
                if (prev < LOADING_PHASES.length - 1) {
                    const next = prev + 1;
                    currentPhaseRef.current = next;
                    return next;
                }
                return prev;
            });
        }, 800);

        return () => {
            clearInterval(progressInterval);
            clearInterval(phaseInterval);
        };
    }, []);

    const CurrentIcon = LOADING_PHASES[currentPhase]?.icon || Loader2;
    const message = LOADING_PHASES[currentPhase]?.message || "Loading...";

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            {/* Logo/Icon */}
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '32px',
                boxShadow: '0 10px 40px var(--accent-glow)'
            }}>
                <CurrentIcon
                    size={36}
                    color="white"
                    style={{
                        animation: currentPhase === 0 || currentPhase >= 4 ? 'spin 1s linear infinite' : 'none'
                    }}
                />
            </div>

            {/* Progress Container */}
            <div style={{
                width: '320px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
            }}>
                {/* Progress Bar */}
                <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '3px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                        borderRadius: '3px',
                        transition: 'width 0.1s ease-out'
                    }} />
                </div>

                {/* Progress Text */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    alignItems: 'center'
                }}>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        transition: 'opacity 0.3s'
                    }}>
                        {message}
                    </span>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        fontFamily: 'monospace'
                    }}>
                        {progress}%
                    </span>
                </div>
            </div>

            {/* Subtle branding */}
            <div style={{
                position: 'absolute',
                bottom: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 500
            }}>
                <span style={{ opacity: 0.6 }}>Wealth on Track</span>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
