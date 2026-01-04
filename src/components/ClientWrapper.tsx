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
    const [showChangelog, setShowChangelog] = useState(false);

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
                showChangelog={showChangelog}
            />

            <div style={{
                textAlign: 'center',
                padding: '2rem 0 3rem 0',
                fontSize: '0.65rem',
                opacity: 0.7,
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem'
            }}>
                <button
                    onClick={() => setShowChangelog(!showChangelog)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        textDecoration: 'none',
                        transition: 'opacity 0.2s',
                        opacity: showChangelog ? 1 : 0.7
                    }}
                    title="Click to see what's new"
                >
                    {versionData.version} - {versionData.buildDate} - {versionData.buildTime}
                </button>
            </div>
        </CurrencyProvider>
    );
}
