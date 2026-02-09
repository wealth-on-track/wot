"use client";

import { CurrencyProvider } from "@/context/CurrencyContext";
import { MobileDashboard } from "./MobileDashboard";
import type { AssetDisplay } from "@/lib/types";

interface MobileClientWrapperProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    goals?: unknown[];
    exchangeRates: Record<string, number>;
    preferences?: unknown;
}

export function MobileClientWrapper({
    username,
    isOwner,
    totalValueEUR,
    assets,
    exchangeRates,
    preferences
}: MobileClientWrapperProps) {
    return (
        <CurrencyProvider>
            <MobileDashboard
                username={username}
                isOwner={isOwner}
                totalValueEUR={totalValueEUR}
                assets={assets}
                exchangeRates={exchangeRates}
                preferences={preferences}
            />
        </CurrencyProvider>
    );
}
