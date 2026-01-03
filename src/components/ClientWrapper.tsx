"use client";

import { useEffect, ReactNode, useState } from "react";
import Dashboard from "@/components/DashboardV2";
import { CurrencyProvider } from "@/context/CurrencyContext";
import versionData from "@/version.json";

interface ClientWrapperProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: any[];
    navbar: ReactNode;
}

export function ClientWrapper({ username, isOwner, totalValueEUR, assets, navbar }: ClientWrapperProps) {
    // Force cleanup of any potential scroll locks
    useEffect(() => {
        document.body.style.overflow = 'auto';
        document.body.classList.remove('antigravity-scroll-lock');
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    return (
        <CurrencyProvider>
            {navbar}

            <Dashboard
                username={username}
                isOwner={isOwner}
                totalValueEUR={totalValueEUR}
                assets={assets}
                isBlurred={false}
            />

            <div style={{
                textAlign: 'center',
                padding: '2rem 0 1rem 0',
                fontSize: '0.65rem',
                opacity: 0.3,
                color: 'var(--text-secondary)'
            }}>
                <a href="/CHANGELOG.md" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                    v{versionData.version}
                </a>
            </div>
        </CurrencyProvider>
    );
}
