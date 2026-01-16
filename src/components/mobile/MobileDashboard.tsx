"use client";

import { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { AnimatePresence, motion } from "framer-motion";
// import { MobileStories } from "./MobileStories";
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
import { Plus, ArrowLeft, Rocket, TrendingDown } from "lucide-react";
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

function AssetLogo({ asset, fallback, size = 18 }: { asset: AssetDisplay, fallback: React.ReactNode, size?: number }) {
    const [error, setError] = useState(false);
    const logoUrl = asset.logoUrl || `https://logo.clearbit.com/${asset.symbol.toLowerCase()}.com`;

    if (error) return <>{fallback}</>;

    return (
        <img
            src={logoUrl}
            alt={asset.symbol}
            style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-secondary)' }}
            onError={() => setError(true)}
        />
    );
}

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
    type DashboardView = 'home' | 'add' | 'settings';
    const [dashboardView, setDashboardView] = useState<DashboardView>('home');

    const [showAssetModal, setShowAssetModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<AssetDisplay | null>(null);
    const [showSettings, setShowSettings] = useState(false); // Can double as 'profile' view

    // Highlight Logic
    const [highlightAssetId, setHighlightAssetId] = useState<string | null>(null);
    if (highlightAssetId) setTimeout(() => setHighlightAssetId(null), 3000);

    const handleAddFromSearch = async (searchResult: any) => {
        let fetchedPrice = 0;
        let sector = searchResult.sector || 'UNKNOWN';
        let country = searchResult.country || 'UNKNOWN';

        try {
            if (searchResult.type === 'CASH') {
                fetchedPrice = 1;
            } else {
                const source = (searchResult.source === 'TEFAS' || searchResult.exchange === 'TEFAS') ? 'TEFAS' : searchResult.exchange;

                // Create a timeout promise that resolves to null after 3 seconds
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));

                // Race the API call against the timeout
                const data: any = await Promise.race([
                    getMarketPriceAction(searchResult.symbol, searchResult.type === 'ETF' ? 'FUND' : searchResult.type, source),
                    timeoutPromise
                ]);

                if (data) {
                    fetchedPrice = (data.price && data.price > 0) ? data.price : (data.previousClose || 0);
                    if (data.sector && data.sector !== 'N/A') sector = data.sector;
                    if (data.country && data.country !== 'N/A') country = data.country;
                } else {
                    console.warn("Price fetch timed out for", searchResult.symbol);
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
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(10); // Light tap
        }
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
                    } else if (type === 'settings') {
                        setDashboardView('settings');
                    }
                }}
            />

            {/* Main Content - Scrollable */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                paddingTop: '12px',
                paddingBottom: '120px' // Extra padding for bottom bar
            }}>

                <AnimatePresence mode="wait">
                    {/* --- GLOBAL: ADD ASSET VIEW --- */}
                    {dashboardView === 'add' ? (
                        <motion.div
                            key="dashboard-add"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}
                        >
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
                                    aria-label="Back"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Add Asset</h2>
                            </div>
                            <div style={{ padding: '1rem', flex: 1 }}>
                                <MobileAddAsset onAddKey={handleAddFromSearch} />
                            </div>
                        </motion.div>
                    ) : dashboardView === 'settings' ? (
                        <motion.div
                            key="dashboard-settings"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            style={{ height: '100%', minHeight: '80vh', background: 'var(--bg-main)' }}
                        >
                            <SettingsPage
                                userEmail={username} // Passing username as email for now, or fetch actual email if available
                                preferences={preferences}
                                onBack={() => setDashboardView('home')}
                            />
                        </motion.div>
                    ) : (
                        <>
                            {/* --- TAB: DASHBOARD (Home) --- */}
                            {activeTab === 'dashboard' && (
                                <motion.div
                                    key="dashboard-home"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ padding: '0 12px 12px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                                >
                                    {/* Summary Card */}
                                    <MobilePortfolioSummary
                                        totalValueEUR={totalValueEUR}
                                        assets={assets}
                                        isPrivacyMode={isPrivacyMode}
                                        onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
                                        defaultPeriod={selectedPeriod}
                                        onPeriodChange={setSelectedPeriod}
                                    />

                                    {/* Top Movers Badges (Pulse Cards) */}
                                    {(() => {
                                        const validAssets = assets.filter(a => a.type !== 'CASH');
                                        if (validAssets.length === 0) return null;

                                        const sorted = [...validAssets].sort((a, b) => b.plPercentage - a.plPercentage);
                                        const best = sorted[0];
                                        const worst = sorted[sorted.length - 1];

                                        return (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                overflowX: 'auto',
                                                scrollbarWidth: 'none',
                                                padding: '4px 0'
                                            }}>
                                                {/* Gainer Badge */}
                                                <div
                                                    onClick={() => handleEditAsset(best)}
                                                    style={{
                                                        flex: 1,
                                                        minWidth: '45%',
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        background: 'var(--surface)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '12px',
                                                        padding: '8px 12px',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                    }}
                                                >
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <AssetLogo asset={best} fallback={<Rocket size={16} color="#10b981" />} size={16} />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{best.symbol}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>+{best.plPercentage.toFixed(1)}%</span>
                                                    </div>
                                                </div>

                                                {/* Loser Badge */}
                                                <div
                                                    onClick={() => handleEditAsset(worst)}
                                                    style={{
                                                        flex: 1,
                                                        minWidth: '45%',
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        background: 'var(--surface)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '12px',
                                                        padding: '8px 12px',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                    }}
                                                >
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <AssetLogo asset={worst} fallback={<TrendingDown size={16} color="#ef4444" />} size={16} />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{worst.symbol}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444' }}>{worst.plPercentage.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

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
                                </motion.div>
                            )}

                            {/* --- TAB: POSITIONS --- */}
                            {activeTab === 'positions' && (
                                <motion.div
                                    key="positions"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ padding: '0.5rem' }}
                                >
                                    <MobileAssetList
                                        assets={assets}
                                        onEdit={handleEditAsset}
                                        isCompact={false}
                                        isPrivacyMode={isPrivacyMode}
                                        highlightId={highlightAssetId}
                                        onAdd={() => setDashboardView('add')} // Crucial: Only changes view, keeps activeTab 'positions'
                                        totalValueEUR={totalValueEUR}
                                    />
                                </motion.div>
                            )}

                            {/* --- TAB: ALLOCATION --- */}
                            {activeTab === 'allocation' && (
                                <motion.div
                                    key="allocation"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ padding: '0.5rem' }}
                                >
                                    <MobileAllocationPie
                                        assets={assets}
                                        totalValueEUR={totalValueEUR}
                                        isPrivacyMode={isPrivacyMode}
                                    />
                                </motion.div>
                            )}

                            {/* --- TAB: VISION --- */}
                            {activeTab === 'vision' && (
                                <motion.div
                                    key="vision"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <MobileVisionTab
                                        totalValueEUR={totalValueEUR}
                                        onOpenImpactSheet={() => setShowImpactSheet(true)}
                                    />
                                </motion.div>
                            )}
                        </>
                    )}
                </AnimatePresence>

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
