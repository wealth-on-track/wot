"use client";

import { useState } from "react";
import { MobileAssetList } from "./MobileAssetList";
import { PortfolioPerformanceChart } from "../PortfolioPerformanceChart";
import { MobileAllocationPie } from "./MobileAllocationPie";
import type { AssetDisplay } from "@/lib/types";

interface MobileDashboardTabsProps {
    assets: AssetDisplay[];
    username: string;
    totalValueEUR: number;
    onEditAsset: (asset: AssetDisplay) => void;
    isPrivacyMode: boolean;
    preferences?: any;
    highlightId?: string | null;
}

type TabView = 'positions' | 'performance' | 'allocation';

export function MobileDashboardTabs({
    assets,
    username,
    totalValueEUR,
    onEditAsset,
    isPrivacyMode,
    preferences,
    highlightId
}: MobileDashboardTabsProps) {
    const [activeTab, setActiveTab] = useState<TabView>('positions');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Tab Header */}
            <div style={{
                display: 'flex',
                gap: '0',
                borderBottom: '2px solid var(--border)',
                background: 'var(--bg-primary)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                padding: '0 1rem'
            }}>
                {[
                    { key: 'positions', label: 'Positions' },
                    { key: 'performance', label: 'Performance' },
                    { key: 'allocation', label: 'Allocation' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as TabView)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            padding: '12px 8px',
                            fontSize: '0.85rem',
                            fontWeight: activeTab === tab.key ? 800 : 600,
                            color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.2s',
                            borderBottom: activeTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
                            marginBottom: '-2px'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '1rem' }}>
                {activeTab === 'positions' && (
                    <MobileAssetList
                        assets={assets}
                        onEdit={onEditAsset}
                        isCompact={false}
                        isPrivacyMode={isPrivacyMode}
                        highlightId={highlightId}
                    />
                )}

                {activeTab === 'performance' && (
                    <div style={{ minHeight: '400px' }}>
                        <PortfolioPerformanceChart
                            username={username}
                            totalValueEUR={totalValueEUR}
                            selectedBenchmarks={preferences?.benchmarks || ['SPY']}
                            isPortfolioVisible={true}
                            onToggleBenchmark={() => { }}
                            onTogglePortfolio={() => { }}
                            controlsPosition="bottom"
                            defaultRange={preferences?.defaultRange || '1Y'}
                            showHistoryList={true}
                        />
                    </div>
                )}

                {activeTab === 'allocation' && (
                    <MobileAllocationPie
                        assets={assets}
                        totalValueEUR={totalValueEUR}
                        isPrivacyMode={isPrivacyMode}
                    />
                )}
            </div>
        </div>
    );
}
