"use client";

import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

interface PrivacyContextType {
    showAmounts: boolean;
    toggleAmounts: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
    const [showAmounts, setShowAmounts] = useState(true);

    // Memoize toggle function to prevent unnecessary re-renders
    const toggleAmounts = useCallback(() => {
        setShowAmounts(prev => !prev);
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        showAmounts,
        toggleAmounts
    }), [showAmounts, toggleAmounts]);

    return (
        <PrivacyContext.Provider value={value}>
            {children}
        </PrivacyContext.Provider>
    );
}

export function usePrivacy() {
    const context = useContext(PrivacyContext);
    if (context === undefined) {
        throw new Error('usePrivacy must be used within a PrivacyProvider');
    }
    return context;
}
