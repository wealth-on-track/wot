"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface PrivacyContextType {
    showAmounts: boolean;
    toggleAmounts: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
    const [showAmounts, setShowAmounts] = useState(true);

    const toggleAmounts = () => {
        setShowAmounts(prev => !prev);
    };

    return (
        <PrivacyContext.Provider value={{ showAmounts, toggleAmounts }}>
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
