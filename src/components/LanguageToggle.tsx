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
            className="navbar-action-btn"
            style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.6rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title={language === 'ENG' ? 'Dil Değiştir (TR)' : 'Switch Language (ENG)'}
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
