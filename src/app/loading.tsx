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
    const spinning = currentPhase === 0 || currentPhase >= 4;

    return (
        <div className="wot-loader-shell">
            <div className="wot-loader-orb" aria-hidden="true">
                <CurrentIcon size={34} color="white" className={spinning ? "wot-spin" : undefined} />
            </div>

            <div className="wot-loader-card premium-panel">
                <div className="wot-loader-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="wot-loader-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="wot-loader-meta">
                    <span className="wot-loader-message">{message}</span>
                    <span className="wot-loader-percent">{progress}%</span>
                </div>
            </div>

            <div className="wot-loader-brand">Wealth on Track</div>
        </div>
    );
}
