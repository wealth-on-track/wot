"use client";

import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function LanguageToggle() {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'ENG' ? 'TR' : 'ENG');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="navbar-btn"
            title={language === 'ENG' ? 'Dil Değiştir (TR)' : 'Switch Language (ENG)'}
            style={{ position: 'relative' }} // Needed for absolute badge
        >
            <Languages size={20} />
            <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                fontSize: '0.6rem',
                fontWeight: 800,
                background: 'var(--accent)',
                color: '#fff',
                padding: '1px 3px',
                borderRadius: '4px',
                minWidth: '18px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                {language}
            </span>
        </button>
    );
}
