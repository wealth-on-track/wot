"use client";

import { useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useTheme } from "@/context/ThemeContext";

interface PreferencesSyncProps {
    preferences?: {
        language?: string;
        currency?: string;
        theme?: string;
        [key: string]: any;
    };
}

export function PreferencesSync({ preferences }: PreferencesSyncProps) {
    const { language, setLanguage } = useLanguage();
    const { currency, setCurrency } = useCurrency();
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        if (!preferences) return;

        // Sync Language
        if (preferences.language && preferences.language !== language && (preferences.language === 'ENG' || preferences.language === 'TR')) {
            setLanguage(preferences.language as 'ENG' | 'TR');
        }

        // Sync Currency
        if (preferences.currency && preferences.currency !== currency) {
            setCurrency(preferences.currency as any);
        }

        // Sync Theme
        if (preferences.theme && preferences.theme !== theme && (preferences.theme === 'light' || preferences.theme === 'dark')) {
            // Because toggleTheme just flips it, we need to be careful.
            // But verify theme logic: toggleTheme flips, we don't have direct setter exposed in context interface usually?
            // Let's check ThemeContext again. It only exposes toggleTheme.
            // Wait, ThemeContext actually checks localStorage/system on mount.
            // If we want to FORCE a theme from DB, we might need a direct setter or use the toggle if it mismatches.
            if (preferences.theme !== theme) {
                toggleTheme();
            }
        }
    }, [preferences, language, setLanguage, currency, setCurrency, theme, toggleTheme]);

    return null;
}
