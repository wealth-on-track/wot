"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFlashHighlight } from "./useFlashHighlight";

interface UseLiveUpdatesOptions {
    portfolioId?: string;
    assets: any[];
    exchangeRates: Record<string, number>;
    enabled?: boolean;
    onAssetUpdate?: (symbol: string, data: Partial<any>) => void;
}

interface UseLiveUpdatesReturn {
    isUpdating: boolean;
    progress: number;
    phase: string;
    showComplete: boolean;
    getFlashStyle: (assetId: string) => React.CSSProperties;
    triggerFlash: (assetId: string, direction: 'up' | 'down' | null) => void;
    startUpdate: () => void;
    hideComplete: () => void;
}

export function useLiveUpdates({
    portfolioId,
    assets,
    exchangeRates,
    enabled = true,
    onAssetUpdate
}: UseLiveUpdatesOptions): UseLiveUpdatesReturn {
    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState<string>('');
    const [showComplete, setShowComplete] = useState(false);

    const { triggerFlash, getFlashStyle } = useFlashHighlight(1500);
    const eventSourceRef = useRef<EventSource | null>(null);
    const previousPricesRef = useRef<Record<string, number>>({});
    const hasStartedRef = useRef(false);

    // Initialize previous prices from current assets
    useEffect(() => {
        const prices: Record<string, number> = {};
        assets.forEach(a => {
            prices[a.symbol] = a.currentPrice || a.previousClose || 0;
        });
        previousPricesRef.current = prices;
    }, []); // Only on mount

    const startUpdate = useCallback(() => {
        if (!enabled || isUpdating || !portfolioId) return;

        setIsUpdating(true);
        setProgress(0);
        setPhase('Connecting...');
        setShowComplete(false);

        // Close existing connection
        eventSourceRef.current?.close();

        const eventSource = new EventSource(`/api/prices/stream?portfolioId=${portfolioId}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'start') {
                    setPhase(`Updating ${data.total} assets...`);
                }

                if (data.type === 'price_update') {
                    setProgress(data.progress);
                    setPhase(`Updating ${data.symbol}...`);

                    // Find asset by symbol
                    const asset = assets.find(a => a.symbol === data.symbol);
                    if (asset) {
                        const prevPrice = previousPricesRef.current[data.symbol] || 0;
                        const newPrice = data.price;

                        // Determine direction for flash highlight
                        const priceDiff = newPrice - prevPrice;
                        const direction = priceDiff > 0.001 ? 'up' : priceDiff < -0.001 ? 'down' : null;

                        if (direction) {
                            triggerFlash(asset.id, direction);
                        }

                        // Update previous price ref
                        previousPricesRef.current[data.symbol] = newPrice;

                        // Only update price and daily change - don't recalculate EUR values
                        // This prevents calculation drift. EUR values come from server on next load.
                        onAssetUpdate?.(data.symbol, {
                            currentPrice: newPrice,
                            previousClose: data.previousClose,
                            dailyChange: data.change,
                            dailyChangePercentage: data.changePercent,
                        });
                    }
                }

                if (data.type === 'progress') {
                    setProgress(data.progress);
                }

                if (data.type === 'complete') {
                    setIsUpdating(false);
                    setProgress(100);
                    setPhase('Complete');
                    setShowComplete(true);
                    eventSource.close();
                }
            } catch (e) {
                console.error('[LiveUpdates] Parse error:', e);
            }
        };

        eventSource.onerror = (e) => {
            console.error('[LiveUpdates] Connection error:', e);
            setIsUpdating(false);
            setPhase('Connection error');
            eventSource.close();
        };
    }, [enabled, isUpdating, portfolioId, assets, triggerFlash, onAssetUpdate]);

    // Auto-start on mount (after brief delay)
    useEffect(() => {
        if (enabled && portfolioId && assets.length > 0 && !hasStartedRef.current) {
            hasStartedRef.current = true;
            const timer = setTimeout(startUpdate, 800);
            return () => clearTimeout(timer);
        }
    }, [enabled, portfolioId, assets.length, startUpdate]);

    // Cleanup
    useEffect(() => {
        return () => {
            eventSourceRef.current?.close();
        };
    }, []);

    const hideComplete = useCallback(() => {
        setShowComplete(false);
    }, []);

    return {
        isUpdating,
        progress,
        phase,
        showComplete,
        getFlashStyle,
        triggerFlash,
        startUpdate,
        hideComplete
    };
}
