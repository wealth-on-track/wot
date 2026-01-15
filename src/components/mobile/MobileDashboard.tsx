"use client";

import { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileStories } from "./MobileStories";
import { MobilePortfolioSummary, MobileHomeAllocations } from "./MobilePortfolioSummary";
import { MobileAllocationPie } from "./MobileAllocationPie";
import { MobileAssetList } from "./MobileAssetList";
import { MobileBottomNav, type Tab } from "./MobileBottomNav";
import { MobileAssetModal } from "./MobileAssetModal";
import { MobileAddAsset } from "./MobileAddAsset";
import { MobileVision } from "./MobileVision";
import { MobileImpactSheet } from "./MobileImpactSheet";
import { MobileDashboardTabs } from "./MobileDashboardTabs";
import { MobileVisionTab } from "./MobileVisionTab";
import { SettingsPage } from "../SettingsPage";
import type { AssetDisplay } from "@/lib/types";
import type { Goal } from "@prisma/client";
import { PortfolioPerformanceChart } from "../PortfolioPerformanceChart";
import { Plus, ArrowLeft } from "lucide-react";
import { getMarketPriceAction } from "@/app/actions/marketData";

interface MobileDashboardProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    goals: Goal[];
    exchangeRates: Record<string, number>;
    preferences?: any;
}

type View = 'overview' | 'performance' | 'allocations' | 'positions' | 'add';

export function MobileDashboard({
    username,
    isOwner,
    totalValueEUR,
    assets,
    goals,
    exchangeRates,
    preferences
}: MobileDashboardProps) {
    // --- Navigation State ---
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [showImpactSheet, setShowImpactSheet] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(preferences?.defaultRange || '1Y');

    // Legacy 'View' for within Dashboard (Add Asset etc)
    type DashboardView = 'home' | 'add';
    const [dashboardView, setDashboardView] = useState<DashboardView>('home');

    const [showAssetModal, setShowAssetModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<AssetDisplay | null>(null);
    const [showSettings, setShowSettings] = useState(false); // Can double as 'profile' view

    // Highlight Logic
    const [highlightAssetId, setHighlightAssetId] = useState<string | null>(null);
    if (highlightAssetId) setTimeout(() => setHighlightAssetId(null), 3000);

    const handleAddFromSearch = async (searchResult: any) => {
        /* ... existing logic ... */
        // Copy existing handleAdd logic if needed or just reference it if I don't overwrite it. 
        // Since I am replacing a big block, I need to be careful to include the logic or keep it outside.
        // The method is locally defined inside the component, so I must preserve it. 
        // I'll assume the helper functions are preserved if I don't overwrite them. 
        // Wait, I AM replacinglines 39-295. This includes handleAddFromSearch. I need to keep it.
        // Re-implementing handleAddFromSearch below to be safe.
        let fetchedPrice = 0;
        let sector = searchResult.sector || 'UNKNOWN';
        let country = searchResult.country || 'UNKNOWN';

        try {
            if (searchResult.type === 'CASH') {
                fetchedPrice = 1;
            } else {
                const source = (searchResult.source === 'TEFAS' || searchResult.exchange === 'TEFAS') ? 'TEFAS' : searchResult.exchange;
                const data = await getMarketPriceAction(searchResult.symbol, searchResult.type === 'ETF' ? 'FUND' : searchResult.type, source);
                if (data) {
                    fetchedPrice = (data.price && data.price > 0) ? data.price : (data.previousClose || 0);
                    if (data.sector && data.sector !== 'N/A') sector = data.sector;
                    if (data.country && data.country !== 'N/A') country = data.country;
                }
            }
        } catch (e) {
            console.error("Failed to fetch price for mobile add", e);
        }

        const newAsset: Partial<AssetDisplay> = {
            id: 'new',
            symbol: searchResult.symbol,
            name: searchResult.fullName || searchResult.name,
            type: searchResult.type || 'Stock',
            currency: searchResult.currency || 'USD',
            quantity: 0,
            buyPrice: fetchedPrice,
            totalValueEUR: 0,
            currentPrice: fetchedPrice,
            sector: sector,
            country: country,
            exchange: searchResult.exchange,
            platform: searchResult.platform
        };
        setSelectedAsset(newAsset as AssetDisplay);
        setShowAssetModal(true);
    };

    // Global Privacy Mode
    const [isPrivacyMode, setIsPrivacyMode] = useState(false);

    const handleEditAsset = (asset: AssetDisplay) => {
        setSelectedAsset(asset);
        setShowAssetModal(true);
    };

    // Navigation Handler
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        if (tab === 'dashboard') setDashboardView('home');
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
                isPrivacyMode={isPrivacyMode}
                onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
                onLogoClick={() => { setActiveTab('dashboard'); setDashboardView('home'); }}
                assets={assets}
                totalValueEUR={totalValueEUR}
                onNavigate={(type, payload) => {
                    if (type === 'asset' && payload) {
                        setActiveTab('positions');
                        setHighlightAssetId(payload);
                    } else if (type === 'overview') {
                        setActiveTab('dashboard');
                        setDashboardView('home');
                    }
                }}
            />

            {/* Main Content - Scrollable */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                paddingTop: '0.5rem',
                paddingBottom: '100px' // Extra padding for bottom bar
            }}>

                {/* --- TAB: DASHBOARD (Home) --- */}
                {activeTab === 'dashboard' && dashboardView === 'home' && (
                    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {/* Summary Card */}
                        <MobilePortfolioSummary
                            totalValueEUR={totalValueEUR}
                            assets={assets}
                            isPrivacyMode={isPrivacyMode}
                            onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
                            defaultPeriod={selectedPeriod}
                            onPeriodChange={setSelectedPeriod}
                        />

                        {/* Performance Chart */}
                        <PortfolioPerformanceChart
                            username={username}
                            totalValueEUR={totalValueEUR}
                            selectedBenchmarks={preferences?.benchmarks || ['SPY']}
                            isPortfolioVisible={true}
                            onToggleBenchmark={() => { }}
                            onTogglePortfolio={() => { }}
                            controlsPosition="bottom"
                            defaultRange={selectedPeriod}
                            showHistoryList={false}
                            showPortfolioValue={false}
                            showPeriodSelector={false}
                        />
                    </div>
                )}

                {/* --- TAB: ADD ASSET VIEW --- */}
                {activeTab === 'dashboard' && dashboardView === 'add' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}>
                        <div style={{
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            borderBottom: '1px solid var(--border)'
                        }}>
                            <button
                                onClick={() => setDashboardView('home')}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Add Asset</h2>
                        </div>
                        <div style={{ padding: '1rem', flex: 1 }}>
                            <MobileAddAsset onAddKey={handleAddFromSearch} />
                        </div>
                    </div>
                )}

                {/* --- TAB: POSITIONS --- */}
                {activeTab === 'positions' && (
                    <div style={{ padding: '0.5rem' }}>
                        <MobileAssetList
                            assets={assets}
                            onEdit={handleEditAsset}
                            isCompact={false}
                            isPrivacyMode={isPrivacyMode}
                            highlightId={highlightAssetId}
                            onAdd={() => { setActiveTab('dashboard'); setDashboardView('add'); }}
                        />
                    </div>
                )}

                {/* --- TAB: ALLOCATION --- */}
                {activeTab === 'allocation' && (
                    <div style={{ padding: '0.5rem' }}>
                        <MobileAllocationPie
                            assets={assets}
                            totalValueEUR={totalValueEUR}
                            isPrivacyMode={isPrivacyMode}
                        />
                    </div>
                )}

                {/* --- TAB: VISION --- */}
                {activeTab === 'vision' && (
                    <MobileVisionTab totalValueEUR={totalValueEUR} />
                )}

            </div>

            {/* Bottom Navigation */}
            <MobileBottomNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />

            {/* Impact Sheet */}
            <MobileImpactSheet
                isOpen={showImpactSheet}
                onClose={() => setShowImpactSheet(false)}
                totalValueEUR={totalValueEUR}
            />

            {/* Asset Modal */}
            {showAssetModal && (
                <MobileAssetModal
                    asset={selectedAsset}
                    onClose={() => {
                        setShowAssetModal(false);
                        setSelectedAsset(null);
                    }}
                    onAssetAdded={(newAsset) => {
                        // Switch to positions tab
                        setActiveTab('positions');
                        setShowAssetModal(false);
                        setSelectedAsset(null);

                        // Highlight the new asset by symbol
                        setHighlightAssetId(newAsset.symbol);
                    }}
                />
            )}
        </div>
    );
}
