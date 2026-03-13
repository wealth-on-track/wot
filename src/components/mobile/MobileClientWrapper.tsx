"use client";

import { useCallback, useEffect, useState } from "react";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { MobileDashboard } from "./MobileDashboard";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import type { AssetDisplay } from "@/lib/types";

interface MobileClientWrapperProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    goals?: unknown[];
    exchangeRates: Record<string, number>;
    preferences?: { defaultRange?: string };
    portfolioId?: string;
    enableLiveUpdates?: boolean;
    buildTag?: string;
}

export function MobileClientWrapper({
    username,
    isOwner,
    totalValueEUR,
    assets: initialAssets,
    exchangeRates,
    preferences,
    portfolioId,
    enableLiveUpdates = false,
    buildTag
}: MobileClientWrapperProps) {
    const [assets, setAssets] = useState(initialAssets);

    useEffect(() => {
        setAssets(initialAssets);
    }, [initialAssets]);

    const handleAssetUpdate = useCallback((symbol: string, newData: Partial<any>) => {
        setAssets(prev => prev.map(a =>
            a.symbol === symbol ? { ...a, ...newData } : a
        ));
    }, []);

    const { isUpdating, progress } = useLiveUpdates({
        portfolioId,
        assets,
        exchangeRates,
        enabled: enableLiveUpdates && isOwner,
        onAssetUpdate: handleAssetUpdate
    });

    return (
        <CurrencyProvider>
            <MobileDashboard
                username={username}
                isOwner={isOwner}
                totalValueEUR={totalValueEUR}
                assets={assets}
                exchangeRates={exchangeRates}
                preferences={preferences}
                isLiveUpdating={isUpdating}
                liveProgress={progress}
                buildTag={buildTag}
            />
        </CurrencyProvider>
    );
}
