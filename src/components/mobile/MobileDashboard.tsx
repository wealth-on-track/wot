"use client";

import { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobilePortfolioSummary } from "./MobilePortfolioSummary";
import { MobileAssetList } from "./MobileAssetList";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileAssetModal } from "./MobileAssetModal";
import { MobileDesktopToggle } from "./MobileDesktopToggle";
import type { AssetDisplay } from "@/lib/types";
import type { Goal } from "@prisma/client";

interface MobileDashboardProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    goals: Goal[];
    exchangeRates: Record<string, number>;
}

type View = 'overview' | 'positions' | 'add';

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

    const handleEditAsset = (asset: AssetDisplay) => {
        setSelectedAsset(asset);
        setShowAssetModal(true);
    };

    const handleAddAsset = () => {
        setSelectedAsset(null);
        setShowAssetModal(true);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-main)',
            paddingBottom: '80px', // Space for bottom nav
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <MobileHeader
                username={username}
                isOwner={isOwner}
            />

            {/* Main Content - Scrollable */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {activeView === 'overview' && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <MobilePortfolioSummary
                            totalValueEUR={totalValueEUR}
                            assets={assets}
                        />

                        <MobileAssetList
                            assets={assets}
                            onEdit={handleEditAsset}
                            isCompact={true}
                            maxDisplay={10}
                            onViewAll={() => setActiveView('positions')}
                            onOpenSettings={() => setShowSettings(true)}
                            visibleFields={visibleFields}
                        />
                    </div>
                )}

                {activeView === 'positions' && (
                    <div style={{ padding: '1rem' }}>
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
                onAddClick={handleAddAsset}
            />

            {/* Asset Modal */}
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

            {/* Desktop Toggle */}
            <MobileDesktopToggle username={username} />
        </div>
    );
}
