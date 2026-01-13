"use client";

import { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobilePortfolioSummary, MobileHomeAllocations } from "./MobilePortfolioSummary";
import { MobileAssetList } from "./MobileAssetList";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileAssetModal } from "./MobileAssetModal";
import type { AssetDisplay } from "@/lib/types";
import type { Goal } from "@prisma/client";
import { PortfolioPerformanceChart } from "../PortfolioPerformanceChart";
import { AllocationCard } from "../PortfolioSidebarComponents";

interface MobileDashboardProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    goals: Goal[];
    exchangeRates: Record<string, number>;
}

type View = 'overview' | 'performance' | 'allocations' | 'positions';

export function MobileDashboard({
    username,
    isOwner,
    totalValueEUR,
    assets,
    goals,
    exchangeRates
}: MobileDashboardProps) {
    const [activeView, setActiveView] = useState<View>('overview');
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<AssetDisplay | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [visibleFields, setVisibleFields] = useState({
        portfolio: false,
        platform: false,
        quantity: true,
        cost: true,
        currentPrice: true
    });

    // Global Privacy Mode
    const [isPrivacyMode, setIsPrivacyMode] = useState(false);

    // Performance View State
    const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['SPY']);
    const [isPortfolioVisible, setIsPortfolioVisible] = useState(true);

    const handleEditAsset = (asset: AssetDisplay) => {
        setSelectedAsset(asset);
        setShowAssetModal(true);
    };

    const toggleBenchmark = (id: string) => {
        if (selectedBenchmarks.includes(id)) {
            setSelectedBenchmarks(prev => prev.filter(b => b !== id));
        } else {
            setSelectedBenchmarks(prev => [...prev, id]);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-main)',
            paddingBottom: '80px', // Space for bottom nav
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header - Always Visible */}
            <MobileHeader
                username={username}
                isOwner={isOwner}
            />

            {/* Main Content - Scrollable */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingTop: '0.5rem'
            }}>
                {/* OVERVIEW VIEW */}
                {activeView === 'overview' && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* 1. Summary Card (Interactive) */}
                        <MobilePortfolioSummary
                            totalValueEUR={totalValueEUR}
                            assets={assets}
                            isPrivacyMode={isPrivacyMode}
                            onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
                        />

                        {/* 2. Allocations Summary (Bars) */}
                        <MobileHomeAllocations
                            assets={assets}
                            totalValueEUR={totalValueEUR}
                            isPrivacyMode={isPrivacyMode}
                        />

                        {/* 3. Asset List */}
                        <MobileAssetList
                            assets={assets}
                            onEdit={handleEditAsset}
                            isCompact={true}
                            maxDisplay={5}
                            onViewAll={() => setActiveView('positions')}
                            onOpenSettings={() => setShowSettings(true)}
                            visibleFields={visibleFields}
                            isPrivacyMode={isPrivacyMode}
                        />
                    </div>
                )}

                {/* PERFORMANCE VIEW */}
                {activeView === 'performance' && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Portfolio Performance</h2>
                        <div style={{ minHeight: '400px' }}>
                            <PortfolioPerformanceChart
                                username={username}
                                totalValueEUR={totalValueEUR}
                                selectedBenchmarks={selectedBenchmarks}
                                isPortfolioVisible={isPortfolioVisible}
                                onToggleBenchmark={toggleBenchmark}
                                onTogglePortfolio={() => setIsPortfolioVisible(!isPortfolioVisible)}
                                controlsPosition="bottom"
                            />
                        </div>
                    </div>
                )}

                {/* ALLOCATIONS VIEW */}
                {activeView === 'allocations' && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <AllocationCard
                            totalValueEUR={totalValueEUR}
                            assets={assets}
                            exchangeRates={exchangeRates}
                            variant="mobile"
                        />
                    </div>
                )}

                {/* POSITIONS VIEW */}
                {activeView === 'positions' && (
                    <div style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>All Positions</h2>
                            <button
                                onClick={() => setShowSettings(true)}
                                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '0.4rem', borderRadius: '8px', color: 'var(--text-muted)' }}
                            >
                                ⚙️
                            </button>
                        </div>
                        <MobileAssetList
                            assets={assets}
                            onEdit={handleEditAsset}
                            isCompact={false}
                            onOpenSettings={() => setShowSettings(true)}
                            visibleFields={visibleFields}
                        />
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <MobileBottomNav
                activeView={activeView}
                onViewChange={setActiveView}
            />

            {/* Asset Modal (Edit Only now) */}
            {showAssetModal && (
                <MobileAssetModal
                    asset={selectedAsset}
                    onClose={() => {
                        setShowAssetModal(false);
                        setSelectedAsset(null);
                    }}
                />
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'flex-end'
                }}
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            background: 'var(--bg-primary)',
                            borderRadius: '1rem 1rem 0 0',
                            padding: '0.75rem 0.75rem 1rem',
                            maxHeight: '50vh',
                            overflowY: 'auto'
                        }}
                    >
                        {/* Handle */}
                        <div style={{
                            width: '30px',
                            height: '3px',
                            background: 'var(--border)',
                            borderRadius: '2px',
                            margin: '0 auto 0.75rem'
                        }} />

                        {/* Title */}
                        <h3 style={{
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            marginBottom: '0.65rem',
                            textAlign: 'center'
                        }}>
                            Display Settings
                        </h3>

                        {/* Field Toggles */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[
                                { key: 'portfolio', label: 'Portfolio/Group' },
                                { key: 'platform', label: 'Platform' },
                                { key: 'quantity', label: 'Quantity' },
                                { key: 'cost', label: 'Cost Price' },
                                { key: 'currentPrice', label: 'Current Price' }
                            ].map(field => (
                                <div key={field.key} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.6rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)'
                                }}>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {field.label}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setVisibleFields(prev => ({
                                                ...prev,
                                                [field.key]: !prev[field.key as keyof typeof prev]
                                            }));
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            fontSize: '1rem',
                                            cursor: 'pointer',
                                            padding: '0.2rem'
                                        }}
                                    >
                                        {visibleFields[field.key as keyof typeof visibleFields] ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowSettings(false)}
                            style={{
                                width: '100%',
                                background: 'var(--accent)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                padding: '0.6rem',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: '#fff',
                                cursor: 'pointer',
                                marginTop: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
