"use client";

import { useEffect, ReactNode, useState, useCallback } from "react";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { DeploymentFooter } from "./DeploymentFooter";
import { PreferencesSync } from "./PreferencesSync";
import { FullScreenLayout } from "./FullScreenLayout";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";

interface ClientWrapperProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: any[];
    goals?: any[];
    navbar: ReactNode;
    exchangeRates?: Record<string, number>;
    preferences?: any;
    userEmail?: string;
    portfolioId?: string;
    enableLiveUpdates?: boolean;
}

export function ClientWrapper({
    username,
    isOwner,
    totalValueEUR,
    assets: initialAssets,
    goals = [],
    navbar,
    exchangeRates = {},
    preferences,
    userEmail,
    portfolioId,
    enableLiveUpdates = false
}: ClientWrapperProps) {
    // Mutable state for live price updates (only currentPrice, dailyChange)
    // totalValueEUR stays constant - recalculated on next page load
    const [assets, setAssets] = useState(initialAssets);

    // Handle individual asset updates from SSE - only price fields
    const handleAssetUpdate = useCallback((symbol: string, newData: Partial<any>) => {
        setAssets(prev => prev.map(a =>
            a.symbol === symbol ? { ...a, ...newData } : a
        ));
    }, []);

    // Live updates hook - silent background updates
    const {
        getFlashStyle,
        triggerFlash
    } = useLiveUpdates({
        portfolioId,
        assets,
        exchangeRates,
        enabled: enableLiveUpdates && isOwner,
        onAssetUpdate: handleAssetUpdate
    });

    // Force cleanup of any potential scroll locks
    useEffect(() => {
        document.body.style.overflowY = 'visible';
        document.body.style.overflowX = 'hidden';
        document.body.classList.remove('antigravity-scroll-lock');
        return () => {
            document.body.style.overflowY = '';
            document.body.style.overflowX = '';
        };
    }, []);

    // Mobile Redirect Fallback (Client-Side)
    useEffect(() => {
        const checkMobileRedirect = async () => {
            const { isMobileDevice, isMobileScreen } = await import('@/lib/deviceDetection');
            const forceDesktop = document.cookie.includes('forceDesktop=true');

            if (!forceDesktop && (isMobileDevice() || isMobileScreen())) {
                if (!window.location.pathname.includes('/mobile')) {
                    window.location.href = `/${username}/mobile`;
                }
            }
        };

        checkMobileRedirect();
    }, [username]);

    return (
        <CurrencyProvider>
            <PrivacyProvider>
                <PreferencesSync preferences={preferences} />
                {navbar}

                <FullScreenLayout
                    username={username}
                    isOwner={isOwner}
                    totalValueEUR={totalValueEUR}
                    assets={assets}
                    goals={goals}
                    exchangeRates={exchangeRates}
                    preferences={preferences}
                    userEmail={userEmail}
                    getFlashStyle={getFlashStyle}
                    triggerFlash={triggerFlash}
                />

                <DeploymentFooter />
            </PrivacyProvider>
        </CurrencyProvider>
    );
}
