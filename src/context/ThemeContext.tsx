'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('theme') as Theme;
            if (stored === 'light' || stored === 'dark') return stored;
            if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        }
        return 'dark';
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Use useLayoutEffect to apply theme before paint to avoid flash/delay
    // This is safe because we check window typeof in useState initializer
    React.useLayoutEffect(() => {
        if (!mounted) return;

        // Apply theme class to body
        const body = document.body;
        if (theme === 'light') {
            body.classList.add('light');
        } else {
            body.classList.remove('light');
        }

        // Persist
        localStorage.setItem('theme', theme);
    }, [theme, mounted]);

    // Memoize toggle and set functions
    const toggleTheme = useCallback(() => {
        setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
    }, []);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        theme,
        toggleTheme,
        setTheme
    }), [theme, toggleTheme, setTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
