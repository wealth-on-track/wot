"use client";

import { useEffect, ReactNode, useState } from "react";
import Dashboard from "@/components/DashboardV2";
import { CurrencyProvider, useCurrency } from "@/context/CurrencyContext";
import versionData from "@/version.json";

interface ClientWrapperProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: any[];
    goals?: any[];
    navbar: ReactNode;
    exchangeRates?: Record<string, number>;
    preferences?: any;
}

// Inner component that uses currency context
function DashboardWrapper({ username, isOwner, totalValueEUR, assets, goals, showChangelog, exchangeRates, preferences }: {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: any[];
    goals: any[];
    showChangelog: boolean;
    exchangeRates?: Record<string, number>;
    preferences?: any;
}) {
    const { currency } = useCurrency();

    return (
        <Dashboard
            key={currency} // Force re-render when currency changes
            username={username}
            isOwner={isOwner}
            totalValueEUR={totalValueEUR}
            assets={assets}
            goals={goals}
            isBlurred={false}
            showChangelog={showChangelog}
            exchangeRates={exchangeRates}
            positionsViewCurrency={currency}
            preferences={preferences}
        />
    );
}

export function ClientWrapper({ username, isOwner, totalValueEUR, assets, goals = [], navbar, exchangeRates, preferences }: ClientWrapperProps) {
    const [showChangelog, setShowChangelog] = useState(false);

    // Force cleanup of any potential scroll locks
    useEffect(() => {
        // Ensure body allows scrolling for sticky headers to work relative to viewport
        document.body.style.overflowY = 'visible';
        document.body.style.overflowX = 'hidden';
        document.body.classList.remove('antigravity-scroll-lock');
        return () => {
            document.body.style.overflowY = '';
            document.body.style.overflowX = '';
        };
    }, []);

    // Automatic Price Update for Owner (Local/Dev support)
    useEffect(() => {
        if (!isOwner) return;

        const updatePrices = async () => {
            try {
                // Call the cron endpoint
                // We don't await the result to block UI, just fire it.
                // The server-side logic has a 15-min skip threshold, so it won't spam.
                fetch('/api/cron/update-prices', { cache: 'no-store' })
                    .catch(err => console.error("Auto-update failed:", err));
            } catch (e) {
                console.error("Auto-update error:", e);
            }
        };

        // Run on mount
        updatePrices();

        // Run every 60 minutes
        const interval = setInterval(updatePrices, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isOwner]);

    return (
        <CurrencyProvider>
            {navbar}

            <div style={{ paddingTop: '6.5rem' }}>
                <div style={{
                    maxWidth: '80rem',
                    margin: '0 auto',
                    padding: '0 1.5rem'
                }}>
                    <DashboardWrapper
                        username={username}
                        isOwner={isOwner}
                        totalValueEUR={totalValueEUR}
                        assets={assets}
                        goals={goals}
                        showChangelog={showChangelog}
                        exchangeRates={exchangeRates}
                        preferences={preferences}
                    />
                </div>
            </div>

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
