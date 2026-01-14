"use client";

import { useEffect, ReactNode } from "react";
import Dashboard from "@/components/DashboardV2";
import { CurrencyProvider, useCurrency } from "@/context/CurrencyContext";
import { DeploymentFooter } from "./DeploymentFooter";

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

    // Mobile Redirect Fallback (Client-Side)
    // If server-side detection fails (e.g. edge cache), this catches it.
    useEffect(() => {
        const checkMobileRedirect = async () => {
            // Dynamic import to avoid SSR issues or circular dependencies if any
            const { isMobileDevice, isMobileScreen } = await import('@/lib/deviceDetection');

            // Check if forced desktop
            const forceDesktop = document.cookie.includes('forceDesktop=true');

            if (!forceDesktop && (isMobileDevice() || isMobileScreen())) {
                // Prevent loop if we are already on mobile (though this component shouldn't be rendered there)
                if (!window.location.pathname.includes('/mobile')) {
                    window.location.href = `/${username}/mobile`;
                }
            }
        };

        checkMobileRedirect();
    }, [username]);

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
                        showChangelog={false}
                        exchangeRates={exchangeRates}
                        preferences={preferences}
                    />
                </div>
            </div>
            <DeploymentFooter />
        </CurrencyProvider>
    );
}
