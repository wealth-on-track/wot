"use client";

import { useState, useEffect, useMemo } from "react";

interface MiniPerformanceChartProps {
    totalValueEUR: number;
    selectedPeriod: string;
    periodReturnPct: number; // The actual percentage to display
}

export function MiniPerformanceChart({ totalValueEUR, selectedPeriod, periodReturnPct }: MiniPerformanceChartProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Mock historical data - generate to match the target percentage
    const data = useMemo(() => {
        if (!mounted) return [];

        const points = selectedPeriod === '1D' ? 24 :
            selectedPeriod === '1W' ? 7 :
                selectedPeriod === '1M' ? 30 :
                    selectedPeriod === 'YTD' ? 90 :
                        selectedPeriod === '1Y' ? 365 : 730;

        const result = [];
        const targetChange = periodReturnPct / 100; // Convert percentage to decimal
        const startValue = totalValueEUR / (1 + targetChange); // Calculate start value
        const volatility = 0.015; // Reduced volatility for smoother line

        let currentValue = startValue;

        for (let i = 0; i < points; i++) {
            // Add some random walk but trend towards target
            const progress = i / (points - 1);
            const targetValue = startValue * (1 + targetChange * progress);
            const randomWalk = (Math.random() - 0.5) * volatility * currentValue;

            // Blend between random walk and target trajectory
            currentValue = targetValue * 0.7 + (currentValue + randomWalk) * 0.3;
            result.push(currentValue);
        }

        // Ensure last point is exactly the current value
        result[result.length - 1] = totalValueEUR;
        return result;
    }, [totalValueEUR, selectedPeriod, periodReturnPct, mounted]);

    // Show placeholder during SSR
    if (!mounted || data.length === 0) {
        return (
            <div style={{
                width: '100%',
                height: '80px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                opacity: 0.3,
                marginTop: '16px'
            }} />
        );
    }

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const isPositive = periodReturnPct >= 0;

    // SVG dimensions
    const width = 100;
    const height = 30;

    // Normalize data to SVG coordinates
    const pathData = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - minVal) / (maxVal - minVal)) * height;
        return `${x},${y}`;
    }).join(' ');

    const fillPath = `0,${height} ${pathData} ${width},${height}`;

    // Calculate dates
    const today = new Date();
    const startDate = new Date();
    if (selectedPeriod === '1D') startDate.setDate(today.getDate() - 1);
    else if (selectedPeriod === '1W') startDate.setDate(today.getDate() - 7);
    else if (selectedPeriod === '1M') startDate.setMonth(today.getMonth() - 1);
    else if (selectedPeriod === 'YTD') startDate.setMonth(0, 1);
    else if (selectedPeriod === '1Y') startDate.setFullYear(today.getFullYear() - 1);
    else startDate.setFullYear(today.getFullYear() - 2);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div style={{
            width: '100%',
            position: 'relative',
            marginTop: '16px'
        }}>
            {/* Percentage Badge */}
            <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isPositive ? '#10b981' : '#ef4444',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                zIndex: 10
            }}>
                {isPositive ? '+' : ''}{periodReturnPct.toFixed(2)}%
            </div>

            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                style={{
                    width: '100%',
                    height: '80px',
                    overflow: 'visible'
                }}
            >
                <defs>
                    <linearGradient id="miniChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor={isPositive ? 'var(--success)' : 'var(--danger)'}
                            stopOpacity="0.3"
                        />
                        <stop
                            offset="100%"
                            stopColor={isPositive ? 'var(--success)' : 'var(--danger)'}
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>

                {/* Area Fill */}
                <polygon
                    points={fillPath}
                    fill="url(#miniChartGradient)"
                />

                {/* Line */}
                <polyline
                    points={pathData}
                    fill="none"
                    stroke={isPositive ? 'var(--success)' : 'var(--danger)'}
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {/* Date Labels */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                padding: '0 4px'
            }}>
                <span style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600
                }}>
                    {formatDate(startDate)}
                </span>
                <span style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-primary)',
                    fontWeight: 700
                }}>
                    Today
                </span>
            </div>
        </div>
    );
}
