"use client";

/**
 * Onboarding Trigger Component
 * Shows a welcome prompt for new users
 */

import React, { useEffect, useState } from 'react';
import { useOnboarding } from './OnboardingProvider';
import { Sparkles, X } from 'lucide-react';

interface OnboardingTriggerProps {
    assetCount: number;
}

export function OnboardingTrigger({ assetCount }: OnboardingTriggerProps) {
    const { hasSeenOnboarding, startOnboarding } = useOnboarding();
    const [showPrompt, setShowPrompt] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Show prompt for users who haven't completed onboarding and have no assets
        if (!hasSeenOnboarding && assetCount === 0 && !dismissed) {
            const timer = setTimeout(() => setShowPrompt(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [hasSeenOnboarding, assetCount, dismissed]);

    if (!showPrompt) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 1000,
                background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                maxWidth: '320px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                border: '1px solid rgba(20, 184, 166, 0.3)',
                animation: 'slideUp 0.3s ease-out'
            }}
        >
            <style>{`
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>

            <button
                onClick={() => setDismissed(true)}
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '4px'
                }}
                aria-label="Dismiss"
            >
                <X size={16} />
            </button>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Sparkles size={20} color="#fff" />
                </div>

                <div>
                    <h4 style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem'
                    }}>
                        New here? Let us show you around!
                    </h4>
                    <p style={{
                        fontSize: '0.8rem',
                        color: '#888',
                        marginBottom: '0.75rem',
                        lineHeight: 1.5
                    }}>
                        Take a quick tour to learn how to track your portfolio.
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => {
                                setDismissed(true);
                            }}
                            style={{
                                padding: '0.4rem 0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#888',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            Maybe later
                        </button>
                        <button
                            onClick={() => {
                                setDismissed(true);
                                startOnboarding();
                            }}
                            style={{
                                padding: '0.4rem 0.75rem',
                                background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Start Tour
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
