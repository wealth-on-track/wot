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
    const { theme, toggleTheme, setTheme } = useTheme();

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
            setTheme(preferences.theme as 'light' | 'dark');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferences, setLanguage, setCurrency, setTheme]);

    return null;
}
