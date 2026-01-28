"use client";

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

type Currency = "ORG" | "EUR" | "USD" | "TRY";

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState<Currency>("ORG");

    // Memoize setCurrency to prevent unnecessary re-renders
    const setCurrency = useCallback((newCurrency: Currency) => {
        setCurrencyState(newCurrency);
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        currency,
        setCurrency
    }), [currency, setCurrency]);

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
