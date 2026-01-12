"use client";

import { useState, useMemo, useEffect } from "react";
import { Asset } from "@prisma/client";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Clock, Trophy } from "lucide-react";
// import { getAssetPerformance } from "@/services/historyService"; // Server action used dynamically

// Helper type for the data we need
import { AssetDisplay } from '@/lib/types';

interface PerformanceData {
    symbol: string;
    name: string;
    category: string;
    currentPrice: number;
    performance: {
        changePercent1W: number;
        changePercent1M: number;
        changePercentYTD: number;
        changePercent1Y: number;
    };
};

interface TopPerformersProps {
    assets: AssetDisplay[];
    baseCurrency?: string; // User's selected base currency (EUR, USD, TRY, etc.)
}

export default function TopPerformers({ assets, baseCurrency = 'EUR' }: TopPerformersProps) {
    const [period, setPeriod] = useState<'1W' | '1M' | 'YTD' | '1Y'>('1Y');
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(true); // Start as loading to prevent flash of stale data

    // Filter eligible assets (No Cash, FX, Benchmark) AND unique by symbol
    const eligibleAssets = useMemo(() => {
        const uniqueSymbols = new Set<string>();
        return assets.filter(a => {
            // Filter categories
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((a as any).category === "CASH" || (a as any).category === "FX" || (a as any).category === "BENCHMARK") {
                return false;
            }
            if (a.quantity <= 0) return false;

            // Deduplicate
            if (uniqueSymbols.has(a.symbol)) return false;

            uniqueSymbols.add(a.symbol);
            return true;
        });
    }, [assets]);

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            setLoading(true);
            try {
                // Import dynamically to avoid build issues if server action not fully ready or client boundary issues
                const { getBulkAssetPerformance } = await import("@/app/actions/performance");

                // Fetch performance with user's selected base currency
                // ORG (original) means EUR as the default base currency
                const targetCurrency = baseCurrency === 'ORG' ? 'EUR' : baseCurrency;
                const results = await getBulkAssetPerformance(eligibleAssets, targetCurrency);

                if (!isMounted) return;

                // Map results to our state format
                const mappedData: PerformanceData[] = results.map(r => {
                    const originalAsset = eligibleAssets.find(a => a.symbol === r.symbol);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cat = (originalAsset as any)?.category || 'UNKNOWN';

                    return {
                        symbol: r.symbol,
                        name: originalAsset?.name || r.symbol,
                        category: cat,
                        currentPrice: r.currentPrice || 0, // Use isolated price from server with fallback
                        performance: r.perf
                    };
                });

                setPerformanceData(mappedData);
            } catch (err) {
                console.error("Failed to load top performers", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        if (eligibleAssets.length > 0) {
            loadData();
        }

        return () => { isMounted = false; };
    }, [eligibleAssets, period, baseCurrency]); // Recalculate when base currency changes

    // Derived Top 3 based on selected period
    const top3 = useMemo(() => {
        if (!performanceData.length) return [];

        const key = `changePercent${period}` as keyof typeof performanceData[0]['performance'];

        return [...performanceData]
            .sort((a, b) => (b.performance[key] || 0) - (a.performance[key] || 0))
            .slice(0, 3);
    }, [performanceData, period]);


    // This component logic is complex to fully implement in one shot without the Server Action bridge.
    // I will write the Server Action wrapper first in a separate tool call to ensure we can fetch data.

    return (
        <div className="neo-card" style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            height: '100%',
            position: 'relative',
            background: 'var(--surface)' // Ensure consistency if neo-card doesn't cover it
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    margin: 0
                }}>
                    Top Performers
                </h3>

                {/* Period Selector - Pill Style */}
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '6px', padding: '2px' }}>
                    {(["1W", "1M", "YTD", "1Y"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                border: 'none',
                                background: period === p ? 'var(--bg-card)' : 'transparent',
                                color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: period === p ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Clock className="animate-spin" size={20} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                        Calculations...
                    </div>
                ) : top3.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                        {top3.map((asset, index) => {
                            const key = `changePercent${period}` as keyof typeof asset.performance;
                            const val = asset.performance[key];
                            const isPositive = val >= 0;

                            // Medal Colors
                            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                            const bgGradient = index === 0 ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.1), transparent)' :
                                index === 1 ? 'linear-gradient(90deg, rgba(192, 192, 192, 0.1), transparent)' :
                                    'linear-gradient(90deg, rgba(205, 127, 50, 0.1), transparent)';

                            return (
                                <div
                                    key={asset.symbol}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem',
                                        borderRadius: '10px',
                                        background: bgGradient,
                                        borderBottom: '1px solid var(--border)',
                                        animation: `fadeIn 0.3s ease-out ${index * 0.1}s forwards`,
                                        opacity: 0,
                                        transform: 'translateY(5px)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.2rem',
                                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                        }}>
                                            {rankIcon}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {/* Swapped: Name on top, Ticker on bottom */}
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{asset.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{asset.symbol}</span>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: isPositive ? '#22C55E' : '#EF4444',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        fontVariantNumeric: 'tabular-nums'
                                    }}>
                                        {isPositive ? '+' : ''}{val.toFixed(0)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                        No winners yet
                    </div>
                )}
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
