"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ENG' | 'TR';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
    ENG: {
        // Navbar
        search_placeholder: "Search assets, pairs or gold...",
        login: "Login",
        get_started: "Get Started",
        // Dashboard
        total_wealth: "Total Wealth",
        allocation: "Allocation",
        financial_goals: "Financial Goals",
        top_performers: "Top Performers",
        comparisons: "Comparisons",
        click_to_filter: "Click to filter",
        assets: "Assets",
        total: "Total",
        clear_filters: "Clear Filters",
        no_assets_found: "No Assets Found",
        no_assets_desc: "We couldn't find any assets matching your current filters.",
        done: "Done",
        table_columns: "Table Columns",
        customize_filters: "Customize Filters",
        benchmarks: "Benchmarks",
        performance: "Performance",
        positions: "Positions",
        // Columns
        name_col: "Name",
        price_col: "Price",
        value_col: "Value",
        change_1d_col: "1D Change",
        trend_7d_col: "7D Trend",
        pl_col: "P&L",
        // Categories
        portfolio_cat: "Portfolio",
        type_cat: "Type",
        exchange_cat: "Exchange",
        currency_cat: "Currency",
        country_cat: "Country",
        sector_cat: "Sector",
        platform_cat: "Platform",
        // Sidebar
        portfolio: "Portfolio",
        my_portfolio: "My Portfolio",
        wealth_tracking: "Wealth Tracking & Milestones",
        edit_goal: "Edit Goal",
        create_goal: "Create Goal",
        // Common
        regular: "Regular",
        closed: "Closed",
        post: "Post",
        pre: "Pre"
    },
    TR: {
        // Navbar
        search_placeholder: "Varlık, parite veya altın ara...",
        login: "Giriş Yap",
        get_started: "Başla",
        // Dashboard
        total_wealth: "Toplam Varlık",
        allocation: "Dağılım",
        financial_goals: "Finansal Hedefler",
        top_performers: "En İyi Performanslar",
        comparisons: "Karşılaştırmalar",
        click_to_filter: "Filtrelemek için tıkla",
        assets: "Varlıklar",
        total: "Toplam",
        clear_filters: "Filtreleri Temizle",
        no_assets_found: "Varlık Bulunamadı",
        no_assets_desc: "Seçili filtrelere uygun varlık bulunamadı.",
        done: "Tamam",
        table_columns: "Tablo Sütunları",
        customize_filters: "Filtreleri Özelleştir",
        benchmarks: "Karşılaştırmalar",
        performance: "Performans",
        positions: "Varlıklar ve Pozisyonlar",
        // Columns
        name_col: "Varlık",
        price_col: "Fiyat",
        value_col: "Değer",
        change_1d_col: "24s Değişim",
        trend_7d_col: "7g Trend",
        pl_col: "Kâr/Zarar",
        // Categories
        portfolio_cat: "Portföy",
        type_cat: "Tür",
        exchange_cat: "Borsa",
        currency_cat: "Para Birimi",
        country_cat: "Ülke",
        sector_cat: "Sektör",
        platform_cat: "Platform",
        // Sidebar
        portfolio: "Portföy",
        my_portfolio: "Benim Portföyüm",
        wealth_tracking: "Varlık Takibi & Hedefler",
        edit_goal: "Hedefi Düzenle",
        create_goal: "Hedef Oluştur",
        // Common
        regular: "Açık",
        closed: "Kapalı",
        post: "Kapanış Sonrası",
        pre: "Açılış Öncesi"
    }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('ENG');

    useEffect(() => {
        const savedLang = localStorage.getItem('language') as Language;
        if (savedLang && (savedLang === 'ENG' || savedLang === 'TR')) {
            setLanguageState(savedLang);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    const t = (key: string) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
