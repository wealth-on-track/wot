import React from 'react';

interface SkeletonProps {
    width?: string;
    height?: string;
    borderRadius?: string;
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = 'var(--radius-md)', style, className }: SkeletonProps) {
    return (
        <div
            className={`skeleton-loader ${className || ''}`}
            style={{
                width,
                height,
                borderRadius,
                background: 'var(--bg-secondary)',
                position: 'relative',
                overflow: 'hidden',
                ...style
            }}
        >
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
                animation: 'shimmer 2s infinite linear'
            }} />
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto', padding: 'var(--content-padding)', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Chart Skeleton */}
                <Skeleton height="400px" borderRadius="var(--radius-xl)" />

                {/* Asset Table Skeleton */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Skeleton height="50px" borderRadius="var(--radius-lg)" />
                    {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} height="80px" borderRadius="var(--radius-lg)" />
                    ))}
                </div>
            </div>

            {/* Right Sidebar Skeleton */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <Skeleton height="350px" borderRadius="var(--radius-xl)" />
                <Skeleton height="200px" borderRadius="var(--radius-xl)" />
            </div>
        </div>
    );
}
