"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, TrendingUp, PieChart, Wallet, BarChart3, Shield } from "lucide-react";

const LOADING_PHASES = [
    { progress: 10, message: "Authenticating...", icon: Shield },
    { progress: 25, message: "Fetching exchange rates...", icon: TrendingUp },
    { progress: 45, message: "Loading your positions...", icon: Wallet },
    { progress: 65, message: "Fetching live prices...", icon: BarChart3 },
    { progress: 80, message: "Calculating portfolio value...", icon: PieChart },
    { progress: 95, message: "Preparing dashboard...", icon: Loader2 },
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
                    return Math.min(prev + 2, targetProgress);
                }
                return prev;
            });
        }, 40);

        const phaseInterval = setInterval(() => {
            setCurrentPhase(prev => {
                if (prev < LOADING_PHASES.length - 1) {
                    const next = prev + 1;
                    currentPhaseRef.current = next;
                    return next;
                }
                return prev;
            });
        }, 700);

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
            {/* Animated Icon */}
            <div style={{
                width: '88px',
                height: '88px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '40px',
                boxShadow: '0 12px 48px var(--accent-glow)',
                animation: 'pulse 2s ease-in-out infinite'
            }}>
                <CurrentIcon
                    size={40}
                    color="white"
                    style={{
                        animation: currentPhase === 0 || currentPhase >= 5 ? 'spin 1s linear infinite' : 'none',
                        transition: 'all 0.3s ease'
                    }}
                />
            </div>

            {/* Progress Container */}
            <div style={{
                width: '360px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
            }}>
                {/* Progress Bar Background */}
                <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                }}>
                    {/* Progress Bar Fill */}
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                        borderRadius: '4px',
                        transition: 'width 0.15s ease-out',
                        boxShadow: '0 0 10px var(--accent-glow)'
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
                        fontSize: '15px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            animation: 'blink 1s ease-in-out infinite'
                        }} />
                        {message}
                    </span>
                    <span style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        fontFamily: 'monospace',
                        minWidth: '45px',
                        textAlign: 'right'
                    }}>
                        {progress}%
                    </span>
                </div>
            </div>

            {/* Branding */}
            <div style={{
                position: 'absolute',
                bottom: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
            }}>
                <span style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.5px'
                }}>
                    Wealth on Track
                </span>
                <span style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    opacity: 0.7
                }}>
                    Loading your portfolio...
                </span>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}
