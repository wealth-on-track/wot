"use client";

import { CurrencyProvider } from "@/context/CurrencyContext";
import { MobileDashboard } from "./MobileDashboard";
import type { AssetDisplay } from "@/lib/types";
import type { Goal } from "@prisma/client";

interface MobileClientWrapperProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    goals: Goal[];
    exchangeRates: Record<string, number>;
    preferences?: any;
}

export function MobileClientWrapper({
    username,
    isOwner,
    totalValueEUR,
    assets,
    goals,
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
                goals={goals}
                exchangeRates={exchangeRates}
                preferences={preferences}
            />
        </CurrencyProvider>
    );
}
