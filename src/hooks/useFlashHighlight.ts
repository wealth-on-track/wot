"use client";

import { useState, useCallback, useRef } from "react";

type FlashDirection = 'up' | 'down' | null;

interface FlashState {
    direction: FlashDirection;
    timestamp: number;
    intensity: number; // 0-1, fades over time
}

interface UseFlashHighlightReturn {
    triggerFlash: (assetId: string, direction: FlashDirection) => void;
    getFlashStyle: (assetId: string) => React.CSSProperties;
    getFlashClass: (assetId: string) => string;
    flashStates: Record<string, FlashState>;
}

export function useFlashHighlight(duration: number = 2000): UseFlashHighlightReturn {
    const [flashStates, setFlashStates] = useState<Record<string, FlashState>>({});
    const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});
    const animationRefs = useRef<Record<string, NodeJS.Timeout>>({});

    const triggerFlash = useCallback((assetId: string, direction: FlashDirection) => {
        if (!direction) return;

        // Clear existing timeouts for this asset
        if (timeoutRefs.current[assetId]) {
            clearTimeout(timeoutRefs.current[assetId]);
        }
        if (animationRefs.current[assetId]) {
            clearTimeout(animationRefs.current[assetId]);
        }

        // Set flash state with full intensity
        setFlashStates(prev => ({
            ...prev,
            [assetId]: { direction, timestamp: Date.now(), intensity: 1 }
        }));

        // Fade out animation (reduce intensity over time)
        const fadeSteps = 10;
        const fadeInterval = duration / fadeSteps;

        for (let i = 1; i <= fadeSteps; i++) {
            animationRefs.current[`${assetId}_${i}`] = setTimeout(() => {
                setFlashStates(prev => {
                    if (!prev[assetId]) return prev;
                    return {
                        ...prev,
                        [assetId]: { ...prev[assetId], intensity: 1 - (i / fadeSteps) }
                    };
                });
            }, fadeInterval * i);
        }

        // Clear completely after duration
        timeoutRefs.current[assetId] = setTimeout(() => {
            setFlashStates(prev => {
                const { [assetId]: _, ...rest } = prev;
                return rest;
            });
            delete timeoutRefs.current[assetId];
        }, duration);
    }, [duration]);

    const getFlashStyle = useCallback((assetId: string): React.CSSProperties => {
        const flash = flashStates[assetId];
        if (!flash || flash.intensity <= 0) return {};

        const isUp = flash.direction === 'up';
        const intensity = flash.intensity;

        // Premium colors with alpha based on intensity
        const upColor = `rgba(34, 197, 94, ${0.15 * intensity})`; // Green
        const downColor = `rgba(239, 68, 68, ${0.15 * intensity})`; // Red
        const upBorder = `rgba(34, 197, 94, ${0.5 * intensity})`;
        const downBorder = `rgba(239, 68, 68, ${0.5 * intensity})`;

        return {
            backgroundColor: isUp ? upColor : downColor,
            boxShadow: `inset 0 0 0 1px ${isUp ? upBorder : downBorder}, 0 0 ${20 * intensity}px ${isUp ? upColor : downColor}`,
            transition: 'background-color 0.15s ease-out, box-shadow 0.15s ease-out',
        };
    }, [flashStates]);

    const getFlashClass = useCallback((assetId: string): string => {
        const flash = flashStates[assetId];
        if (!flash) return '';

        return flash.direction === 'up' ? 'flash-up' : 'flash-down';
    }, [flashStates]);

    return { triggerFlash, getFlashStyle, getFlashClass, flashStates };
}
