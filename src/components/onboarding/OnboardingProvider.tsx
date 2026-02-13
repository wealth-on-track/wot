"use client";

/**
 * User Onboarding System
 * Guides new users through initial setup
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Onboarding steps
export type OnboardingStep =
    | 'welcome'
    | 'add-first-asset'
    | 'explore-dashboard'
    | 'set-goal'
    | 'complete';

interface OnboardingState {
    currentStep: OnboardingStep;
    completedSteps: OnboardingStep[];
    isOnboardingActive: boolean;
    hasSeenOnboarding: boolean;
}

interface OnboardingContextValue extends OnboardingState {
    startOnboarding: () => void;
    nextStep: () => void;
    skipOnboarding: () => void;
    completeOnboarding: () => void;
    goToStep: (step: OnboardingStep) => void;
    isStepCompleted: (step: OnboardingStep) => boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const ONBOARDING_STORAGE_KEY = 'wot_onboarding_state';

const STEP_ORDER: OnboardingStep[] = [
    'welcome',
    'add-first-asset',
    'explore-dashboard',
    'set-goal',
    'complete'
];

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<OnboardingState>({
        currentStep: 'welcome',
        completedSteps: [],
        isOnboardingActive: false,
        hasSeenOnboarding: true // Default to true, will check storage
    });

    // Load state from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setState(prev => ({
                    ...prev,
                    ...parsed,
                    isOnboardingActive: false // Never auto-start
                }));
            } catch (e) {
                // Invalid storage, user hasn't seen onboarding
                setState(prev => ({
                    ...prev,
                    hasSeenOnboarding: false
                }));
            }
        } else {
            // No storage = new user
            setState(prev => ({
                ...prev,
                hasSeenOnboarding: false
            }));
        }
    }, []);

    // Save state to localStorage
    useEffect(() => {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
            completedSteps: state.completedSteps,
            hasSeenOnboarding: state.hasSeenOnboarding,
            currentStep: state.currentStep
        }));
    }, [state.completedSteps, state.hasSeenOnboarding, state.currentStep]);

    const startOnboarding = useCallback(() => {
        setState(prev => ({
            ...prev,
            isOnboardingActive: true,
            currentStep: 'welcome'
        }));
    }, []);

    const nextStep = useCallback(() => {
        setState(prev => {
            const currentIndex = STEP_ORDER.indexOf(prev.currentStep);
            const nextIndex = currentIndex + 1;

            if (nextIndex >= STEP_ORDER.length) {
                return {
                    ...prev,
                    isOnboardingActive: false,
                    hasSeenOnboarding: true,
                    completedSteps: [...new Set([...prev.completedSteps, prev.currentStep])]
                };
            }

            return {
                ...prev,
                currentStep: STEP_ORDER[nextIndex],
                completedSteps: [...new Set([...prev.completedSteps, prev.currentStep])]
            };
        });
    }, []);

    const skipOnboarding = useCallback(() => {
        setState(prev => ({
            ...prev,
            isOnboardingActive: false,
            hasSeenOnboarding: true
        }));
    }, []);

    const completeOnboarding = useCallback(() => {
        setState(prev => ({
            ...prev,
            isOnboardingActive: false,
            hasSeenOnboarding: true,
            completedSteps: STEP_ORDER
        }));
    }, []);

    const goToStep = useCallback((step: OnboardingStep) => {
        setState(prev => ({
            ...prev,
            currentStep: step
        }));
    }, []);

    const isStepCompleted = useCallback((step: OnboardingStep) => {
        return state.completedSteps.includes(step);
    }, [state.completedSteps]);

    return (
        <OnboardingContext.Provider value={{
            ...state,
            startOnboarding,
            nextStep,
            skipOnboarding,
            completeOnboarding,
            goToStep,
            isStepCompleted
        }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboarding must be used within OnboardingProvider');
    }
    return context;
}
