"use client";

/**
 * Onboarding Modal Component
 * Step-by-step guide for new users
 */

import React from 'react';
import { useOnboarding, OnboardingStep } from './OnboardingProvider';
import { X, ChevronRight, Target, BarChart3, PlusCircle, Sparkles } from 'lucide-react';

const STEP_CONTENT: Record<OnboardingStep, {
    title: string;
    description: string;
    icon: React.ReactNode;
    tips: string[];
}> = {
    welcome: {
        title: 'Welcome to Wealth on Track!',
        description: 'Your personal portfolio tracker for stocks, crypto, funds, and more. Let\'s get you started.',
        icon: <Sparkles size={48} className="text-teal-500" />,
        tips: [
            'Track all your investments in one place',
            'See real-time prices and performance',
            'Analyze your portfolio allocation',
            'Set and track financial goals'
        ]
    },
    'add-first-asset': {
        title: 'Add Your First Asset',
        description: 'Click the "+" button or drag & drop a broker statement to add your first investment.',
        icon: <PlusCircle size={48} className="text-green-500" />,
        tips: [
            'Search for any stock, ETF, or crypto',
            'Import from PDF broker statements',
            'Manual entry with full control',
            'Supports 30+ currencies'
        ]
    },
    'explore-dashboard': {
        title: 'Explore Your Dashboard',
        description: 'Your dashboard shows portfolio value, allocation charts, and performance over time.',
        icon: <BarChart3 size={48} className="text-blue-500" />,
        tips: [
            'View total portfolio value in EUR',
            'See allocation by sector & country',
            'Track daily/weekly/monthly changes',
            'Compare with benchmark indices'
        ]
    },
    'set-goal': {
        title: 'Set a Financial Goal',
        description: 'Stay motivated by setting savings or investment goals with deadlines.',
        icon: <Target size={48} className="text-purple-500" />,
        tips: [
            'Create multiple goals',
            'Track progress visually',
            'Set target amounts and dates',
            'Celebrate when you achieve them!'
        ]
    },
    complete: {
        title: 'You\'re All Set!',
        description: 'You\'re ready to start tracking your wealth. Happy investing!',
        icon: <Sparkles size={48} className="text-yellow-500" />,
        tips: [
            'Import more assets anytime',
            'Check back daily for updates',
            'Explore the settings for more options',
            'Need help? Visit our support page'
        ]
    }
};

export function OnboardingModal() {
    const {
        isOnboardingActive,
        currentStep,
        nextStep,
        skipOnboarding,
        completeOnboarding
    } = useOnboarding();

    if (!isOnboardingActive) return null;

    const content = STEP_CONTENT[currentStep];
    const isLastStep = currentStep === 'complete';

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(4px)'
            }}
            onClick={(e) => e.target === e.currentTarget && skipOnboarding()}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '480px',
                    background: 'var(--bg-secondary, #1a1a1a)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {Object.keys(STEP_CONTENT).map((step, i) => (
                            <div
                                key={step}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: Object.keys(STEP_CONTENT).indexOf(currentStep) >= i
                                        ? 'linear-gradient(135deg, #14b8a6, #10b981)'
                                        : 'rgba(255,255,255,0.2)'
                                }}
                            />
                        ))}
                    </div>
                    <button
                        onClick={skipOnboarding}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        {content.icon}
                    </div>

                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        marginBottom: '0.75rem'
                    }}>
                        {content.title}
                    </h2>

                    <p style={{
                        color: '#888',
                        marginBottom: '1.5rem',
                        lineHeight: 1.6
                    }}>
                        {content.description}
                    </p>

                    <ul style={{
                        textAlign: 'left',
                        margin: '0 auto',
                        maxWidth: '320px',
                        listStyle: 'none',
                        padding: 0
                    }}>
                        {content.tips.map((tip, i) => (
                            <li
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.5rem 0',
                                    color: '#ccc',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: '#14b8a6',
                                    flexShrink: 0
                                }} />
                                {tip}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <button
                        onClick={skipOnboarding}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#888',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        Skip
                    </button>
                    <button
                        onClick={isLastStep ? completeOnboarding : nextStep}
                        style={{
                            flex: 2,
                            padding: '0.75rem',
                            background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {isLastStep ? 'Get Started' : 'Next'}
                        {!isLastStep && <ChevronRight size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
