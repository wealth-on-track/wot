"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';

type Currency = "ORG" | "EUR" | "USD" | "TRY" | "GBP";

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState<Currency>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('currency') as Currency;
            if (stored && ['ORG', 'EUR', 'USD', 'TRY', 'GBP'].includes(stored)) {
                return stored;
            }
        }
        return "EUR";
    });

    // Persist currency changes to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('currency', currency);
        }
    }, [currency]);

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
