"use client";

import React, { useState } from "react";
import {
    Briefcase, PieChart, TrendingUp, Lightbulb, Eye,
    Target, Trophy, XCircle, Share2, Settings, Hash, Monitor, Pencil, Wallet, Save, X,
    ChevronUp, ChevronDown, FileSpreadsheet, Trash2, GripVertical
} from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { ImportModal } from "./ImportModal";
import { getLogoUrl } from "@/lib/logos";
import { ShareHub } from "./share/ShareHub";
import { InsightsTab } from "./InsightsTab";
import { AllocationCard } from "./PortfolioSidebarComponents";
import { PortfolioPerformanceChart } from "./PortfolioPerformanceChart";
import { usePrivacy } from "@/context/PrivacyContext";
import { BENCHMARK_ASSETS } from "@/lib/benchmarkApi";

// Sortable Row Component for Open Positions Table
function SortableRow({ children, id, isBatchEditMode }: { children: React.ReactNode, id: string, isBatchEditMode: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
        position: isDragging ? 'relative' as const : 'static' as const,
    };

    return (
        <tr ref={setNodeRef} style={style} className="table-row-hover">
            {/* Drag Handle Column */}
            <td style={{
                width: '30px',
                padding: '0',
                textAlign: 'center',
                verticalAlign: 'middle',
                borderBottom: '1px solid var(--border-light)',
                cursor: isBatchEditMode ? 'default' : 'grab'
            }}
                {...(!isBatchEditMode ? { ...attributes, ...listeners } : {})}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    opacity: isBatchEditMode ? 0.3 : 0.7,
                }}>
                    <GripVertical size={14} />
                </div>
            </td>
            {children}
        </tr>
    );
}

type SectionId =
    | 'open-positions'
    | 'allocations'
    | 'performance'
    | 'insights'
    | 'vision'
    | 'financial-goals'
    | 'top-performers'
    | 'closed-positions'
    | 'share'
    | 'settings';

interface MenuItem {
    id: SectionId;
    label: string;
    icon: React.ElementType;
}

const MENU_ITEMS: MenuItem[] = [
    { id: 'open-positions', label: 'Open Positions', icon: Briefcase },
    { id: 'allocations', label: 'Allocations', icon: PieChart },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'vision', label: 'Vision', icon: Eye },
    { id: 'financial-goals', label: 'Financial Goals', icon: Target },
    { id: 'top-performers', label: 'Top & Worst Performers', icon: Trophy },
    { id: 'closed-positions', label: 'Closed Positions', icon: XCircle },
    { id: 'share', label: 'Share', icon: Share2 },
    { id: 'settings', label: 'Settings', icon: Settings },
];

interface FullScreenLayoutProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: any[];
    goals?: any[];
    exchangeRates?: Record<string, number>;
    preferences?: any;
    defaultSection?: SectionId;
}

export function FullScreenLayout({
    username,
    isOwner,
    totalValueEUR,
    assets,
    goals = [],
    exchangeRates,
    preferences,
    defaultSection = 'open-positions'
}: FullScreenLayoutProps) {
    const [activeSection, setActiveSection] = useState<SectionId>(defaultSection);
    const [hoveredItem, setHoveredItem] = useState<SectionId | null>(null);
    const [closedPositionsCount, setClosedPositionsCount] = useState<number>(0);
    const [openPositionsCount, setOpenPositionsCount] = useState<number>(assets.length);
    const [showImportModal, setShowImportModal] = useState(false);

    // Fetch open and closed positions counts - refetch when activeSection changes
    React.useEffect(() => {
        // Fetch open positions count
        import('@/lib/actions').then(({ getOpenPositions }) => {
            getOpenPositions()
                .then(data => {
                    setOpenPositionsCount(data.length);
                })
                .catch(err => console.error('[FullScreenLayout] Error fetching open positions count:', err));
        });

        // Fetch closed positions count
        import('@/app/actions/history').then(({ getClosedPositions }) => {
            getClosedPositions()
                .then(data => {
                    const closed = data.filter(p => Math.abs(p.totalQuantityBought - p.totalQuantitySold) < 0.01);
                    setClosedPositionsCount(closed.length);
                })
                .catch(err => console.error('[FullScreenLayout] Error fetching closed positions count:', err));
        });
    }, [activeSection]);

    const [sectionKey, setSectionKey] = React.useState(0);

    // Increment key when section changes to force remount and refetch data
    React.useEffect(() => {
        setSectionKey(prev => prev + 1);
    }, [activeSection]);

    // Function to refresh counts (called after save/delete operations)
    const refreshCounts = React.useCallback(() => {
        // Fetch open positions count
        import('@/lib/actions').then(({ getOpenPositions }) => {
            getOpenPositions()
                .then(data => {
                    setOpenPositionsCount(data.length);
                })
                .catch(err => console.error('[refreshCounts] Error fetching open positions count:', err));
        });

        // Fetch closed positions count
        import('@/app/actions/history').then(({ getClosedPositions }) => {
            getClosedPositions()
                .then(data => {
                    const closed = data.filter(p => Math.abs(p.totalQuantityBought - p.totalQuantitySold) < 0.01);
                    setClosedPositionsCount(closed.length);
                })
                .catch(err => console.error('[refreshCounts] Error fetching closed positions count:', err));
        });
    }, []);

    const renderContent = () => {
        switch (activeSection) {
            case 'open-positions':
                return <OpenPositionsFullScreen key={`open-${sectionKey}`} assets={assets} exchangeRates={exchangeRates} globalCurrency={preferences?.currency || 'EUR'} onOpenImport={() => setShowImportModal(true)} onCountChange={refreshCounts} />;
            case 'allocations':
                return <AllocationsFullScreen assets={assets} exchangeRates={exchangeRates} />;
            case 'performance':
                return <PerformanceFullScreen username={username} totalValueEUR={totalValueEUR} />;
            case 'insights':
                return <InsightsFullScreen username={username} />;
            case 'vision':
                return <VisionFullScreen username={username} totalValueEUR={totalValueEUR} />;
            case 'financial-goals':
                return <FinancialGoalsFullScreen goals={goals} totalValueEUR={totalValueEUR} exchangeRates={exchangeRates} isOwner={isOwner} />;
            case 'top-performers':
                return <TopPerformersFullScreen assets={assets} />;
            case 'closed-positions':
                return <ClosedPositionsFullScreen key={`closed-${sectionKey}`} onOpenImport={() => setShowImportModal(true)} onCountChange={refreshCounts} />;
            case 'share':
                return <ShareFullScreen key={activeSection} assets={assets} username={username} totalValueEUR={totalValueEUR} />;
            case 'settings':
                return <SettingsFullScreen key={activeSection} preferences={preferences} />;
            default:
                return null;
        }
    };

    return (
        <div style={{
            display: 'flex',
            height: 'calc(100vh - 5rem)',
            marginTop: '5rem',
            background: 'var(--bg-primary)',
            position: 'relative'
        }}>
            {/* Sidebar Menu - Fixed width, no expansion */}
            <div style={{
                width: '70px',
                background: 'var(--surface)',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 0',
                gap: '8px',
                position: 'relative',
                zIndex: 10,
                boxShadow: 'var(--shadow-sm)'
            }}>
                {MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    const isHovered = hoveredItem === item.id;
                    const showCount =
                        (item.id === 'closed-positions' && closedPositionsCount > 0) ||
                        (item.id === 'open-positions' && openPositionsCount > 0);

                    return (
                        <div key={item.id} style={{ position: 'relative' }}>
                            <button
                                onClick={() => setActiveSection(item.id)}
                                onMouseEnter={() => setHoveredItem(item.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '12px 0',
                                    background: isActive ? 'var(--accent)' : 'transparent',
                                    color: isActive ? '#fff' : 'var(--text-muted)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                            >
                                <Icon size={20} style={{ flexShrink: 0 }} />
                                {isActive && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '4px',
                                        background: '#fff',
                                        borderRadius: '0 4px 4px 0'
                                    }} />
                                )}
                            </button>

                            {/* Tooltip with Count */}
                            {isHovered && (
                                <div style={{
                                    position: 'absolute',
                                    left: '75px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '8px 16px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                                    zIndex: 1000,
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {item.label}
                                        {item.id === 'closed-positions' && closedPositionsCount > 0 && ` (${closedPositionsCount})`}
                                        {item.id === 'open-positions' && openPositionsCount > 0 && ` (${openPositionsCount})`}
                                    </div>
                                    {/* Arrow pointing to sidebar */}
                                    <div style={{
                                        position: 'absolute',
                                        left: '-6px',
                                        top: '50%',
                                        transform: 'translateY(-50%) rotate(-45deg)',
                                        width: '12px',
                                        height: '12px',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRight: 'none',
                                        borderBottom: 'none'
                                    }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                background: 'var(--bg-primary)'
            }}>
                {renderContent()}
            </div>

            {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
        </div>
    );
}

// Full Screen Section Components

// 1. Open Positions - Table Only, No Tabs
function OpenPositionsFullScreen({ assets: initialAssets, exchangeRates, globalCurrency = 'EUR', onOpenImport, onCountChange }: { assets: any[], exchangeRates?: Record<string, number>, globalCurrency?: string, onOpenImport: () => void, onCountChange: () => void }) {
    const [isBatchEditMode, setIsBatchEditMode] = React.useState(false);
    const [editedAssets, setEditedAssets] = React.useState<Record<string, any>>({});
    const [assets, setAssets] = React.useState(initialAssets);
    const [showSuccessNotification, setShowSuccessNotification] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setAssets((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);

                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Persist new order
                const saveOrder = async () => {
                    const { reorderAssets } = await import('@/lib/actions');
                    await reorderAssets(newOrder.map(a => a.id));
                };
                saveOrder();

                return newOrder;
            });
        }
    };

    // Fetch fresh data from database on mount
    React.useEffect(() => {
        const fetchAssets = async () => {
            setLoading(true);
            try {
                const { getOpenPositions } = await import('@/lib/actions');
                const freshAssets = await getOpenPositions();
                setAssets(freshAssets);
            } catch (error) {
                console.error('[OpenPositionsFullScreen] Error fetching assets:', error);
                // Fallback to initial assets if fetch fails
                setAssets(initialAssets);
            } finally {
                setLoading(false);
            }
        };

        fetchAssets();
    }, []); // Only run on mount

    // Recalculate total value dynamically based on current prices and rates
    const totalPortfolioValue = assets.reduce((sum, asset) => {
        const price = asset.currentPrice || asset.price || asset.previousClose || 0;
        const quantity = asset.quantity || 0;
        const value = price * quantity;
        const currency = asset.currency || 'EUR';

        let rateToEur = 1;
        if (currency !== 'EUR') {
            if (exchangeRates && exchangeRates[currency]) {
                rateToEur = exchangeRates[currency];
            }
        }
        const valueEur = value / rateToEur;
        return sum + valueEur;
    }, 0);

    // Helper function to get current value (edited or original)
    const getCurrentValue = (assetId: string, field: string, originalValue: any) => {
        return editedAssets[assetId]?.[field] ?? originalValue;
    };

    const formatNumber = (num: number | undefined | null, decimals: number = 2): string => {
        if (num === undefined || num === null || isNaN(num)) return '0';
        const [integer, decimal] = num.toFixed(decimals).split('.');
        const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimal ? `${formattedInteger},${decimal}` : formattedInteger;
    };



    const getCurrencySymbol = (currency: string): string => {
        const symbols: Record<string, string> = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'TRY': '₺', 'JPY': '¥', 'CNY': '¥', 'KRW': '₩', 'INR': '₹',
            'BRL': 'R$', 'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF', 'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr',
            'PLN': 'zł', 'RUB': '₽', 'MXN': '$', 'ZAR': 'R', 'SGD': 'S$', 'HKD': 'HK$', 'NZD': 'NZ$'
        };
        return symbols[currency] || currency;
    };

    // Dynamic sizing based on asset count
    const assetCount = assets.length;
    const isCompact = assetCount >= 10;
    const isExtraCompact = assetCount >= 20;

    const sizing = {
        // Row padding
        rowPadding: isExtraCompact ? '6px' : isCompact ? '8px' : '10px',
        rowPaddingLR: isExtraCompact ? '10px' : isCompact ? '12px' : '16px',

        // Logo size
        logoSize: isExtraCompact ? 28 : isCompact ? 32 : 36,

        // Font sizes
        assetNameSize: isExtraCompact ? '12px' : isCompact ? '13px' : '14px',
        symbolSize: isExtraCompact ? '10px' : isCompact ? '11px' : '12px',
        numberSize: isExtraCompact ? '12px' : isCompact ? '13px' : '14px',
        smallNumberSize: isExtraCompact ? '10px' : isCompact ? '11px' : '12px',
        pillFontSize: isExtraCompact ? '9px' : isCompact ? '10px' : '11px',

        // Pill padding
        pillPadding: isExtraCompact ? '3px 6px' : isCompact ? '3px 7px' : '4px 8px',

        // Header height
        headerHeight: isExtraCompact ? '40px' : isCompact ? '44px' : '48px',

        // Icon sizes
        iconSize: isExtraCompact ? 14 : isCompact ? 15 : 16,

        // Input padding
        inputPadding: isExtraCompact ? '2px 6px' : isCompact ? '3px 7px' : '4px 8px',
    };

    const handleDelete = async (assetId: string) => {
        // Optimistically update UI
        setAssets(prev => prev.filter(a => a.id !== assetId));
        setEditedAssets(prev => {
            const newEdited = { ...prev };
            delete newEdited[assetId];
            return newEdited;
        });

        // Persist to database
        try {
            const { deleteAsset } = await import('@/lib/actions');
            const result = await deleteAsset(assetId);
            if (result.error) {
                console.error('[handleDelete] Error:', result.error);
                // Optionally: revert optimistic update or show error notification
            }
        } catch (error) {
            console.error('[handleDelete] Failed to delete asset:', error);
            // Optionally: revert optimistic update or show error notification
        }
    };

    // Show loading state while fetching data
    if (loading) {
        return (
            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{ padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{
                        margin: '0 auto 1rem',
                        width: '32px',
                        height: '32px',
                        border: '3px solid var(--border)',
                        borderTopColor: 'var(--accent)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>Loading positions...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Premium Header Card - Compact Single Line */}
            <div style={{
                marginBottom: '24px',
                padding: '12px 24px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                {/* Icon */}
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                }}>
                    <Briefcase size={18} strokeWidth={2} />
                </div>

                {/* Title & Count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Open Positions ({assets.length})
                    </h1>
                    <button
                        onClick={onOpenImport}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s',
                            marginLeft: '4px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.borderColor = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                        title="Import CSV"
                    >
                        <FileSpreadsheet size={16} />
                    </button>
                </div>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Total Wealth */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Total Wealth:
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: 'var(--accent)' }}>€</span>{formatNumber(totalPortfolioValue, 0)}
                    </span>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '28px', background: 'var(--border)' }}></div>

                {/* Batch Edit Button */}
                <button
                    onClick={() => {
                        if (isBatchEditMode) {
                            // Apply edits to assets
                            const updatedAssets = assets.map(asset => {
                                if (editedAssets[asset.id]) {
                                    return {
                                        ...asset,
                                        ...editedAssets[asset.id]
                                    };
                                }
                                return asset;
                            });

                            setAssets(updatedAssets);

                            // Persist changes to database
                            const saveChanges = async () => {
                                const { updateAsset } = await import('@/lib/actions');
                                const promises = Object.entries(editedAssets).map(([id, data]) => {
                                    // Map form fields to API fields
                                    return updateAsset(id, {
                                        quantity: data.quantity,
                                        buyPrice: data.averageBuyPrice, // Map back to buyPrice
                                        name: data.name,
                                        platform: data.platform,
                                        customGroup: data.portfolio
                                    });
                                });
                                await Promise.all(promises);
                                onCountChange();
                            };
                            saveChanges().catch(err => console.error("Batch save failed:", err));

                            // Show success notification
                            setShowSuccessNotification(true);
                            setTimeout(() => {
                                setShowSuccessNotification(false);
                            }, 2000);

                            setEditedAssets({});
                            setIsBatchEditMode(false);
                        } else {
                            // Initialize editedAssets with current values when entering batch mode
                            const initialEdits: Record<string, any> = {};
                            assets.forEach(asset => {
                                initialEdits[asset.id] = {
                                    portfolio: asset.portfolio || 'Main',
                                    platform: asset.platform || 'Interactive Brokers',
                                    name: asset.name || asset.symbol,
                                    quantity: asset.quantity,
                                    averageBuyPrice: asset.buyPrice || asset.averageBuyPrice || asset.avgPrice || 0
                                };
                            });
                            setEditedAssets(initialEdits);
                            setIsBatchEditMode(true);
                        }
                    }}
                    style={{
                        background: isBatchEditMode ? 'var(--accent)' : 'transparent',
                        border: isBatchEditMode ? '1px solid var(--accent)' : '1px dashed var(--border)',
                        borderRadius: '8px',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        color: isBatchEditMode ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minWidth: isBatchEditMode ? '72px' : '36px',
                        height: '36px',
                        flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                        if (!isBatchEditMode) {
                            e.currentTarget.style.borderColor = 'var(--text-primary)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isBatchEditMode) {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                        }
                    }}
                    title={isBatchEditMode ? "Save Changes" : "Batch Edit"}>
                    {isBatchEditMode ? (
                        <>
                            <Save size={16} />
                        </>
                    ) : (
                        <Pencil size={16} />
                    )}
                </button>

                {/* Cancel Button - Only show in batch edit mode */}
                {isBatchEditMode && (
                    <button
                        onClick={() => {
                            setEditedAssets({});
                            setIsBatchEditMode(false);
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            width: '36px',
                            height: '36px',
                            flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#ef4444';
                            e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                        title="Cancel">
                        <X size={16} />
                    </button>
                )}

                {/* Success Notification Toast */}
                {showSuccessNotification && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        animation: 'fadeIn 0.3s ease-out',
                        marginLeft: '8px'
                    }}>
                        <Save size={16} />
                        <span>Saved successfully!</span>
                    </div>
                )}
            </div>

            <div style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                overflow: 'visible',
                boxShadow: 'var(--shadow-md)'
            }}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)', height: sizing.headerHeight }}>
                                {/* Drag Handle Header */}
                                <th style={{ width: '30px', borderBottom: '1px solid var(--border)' }} />
                                {/* Portfolio Icon Header */}
                                <th style={{ padding: '0 12px', textAlign: 'center', color: 'var(--text-muted)', width: '60px', borderBottom: '1px solid var(--border)' }}>
                                    <Wallet size={sizing.iconSize} strokeWidth={2.5} />
                                </th>
                                {/* Platform Icon Header */}
                                <th style={{ padding: '0 12px', textAlign: 'center', color: 'var(--text-muted)', width: '110px', borderBottom: '1px solid var(--border)' }}>
                                    <Monitor size={sizing.iconSize} strokeWidth={2.5} />
                                </th>
                                {/* Asset */}
                                <th style={{ padding: '0 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                    Asset Name
                                </th>
                                {/* Qty Icon Header */}
                                <th style={{ padding: '0 12px', textAlign: 'right', color: 'var(--text-muted)', width: '80px', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        <Hash size={sizing.iconSize} strokeWidth={2.5} />
                                    </div>
                                </th>
                                {/* Price */}
                                <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                    <div>Price</div>
                                    <div style={{ opacity: 0.5, fontWeight: 500 }}>Cost</div>
                                </th>
                                {/* Total Value Org */}
                                <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                    <div>Value</div>
                                    <div style={{ opacity: 0.5, fontWeight: 500 }}>Cost</div>
                                </th>
                                {/* Total Value Global */}
                                <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                    <div>Value ({getCurrencySymbol(globalCurrency)})</div>
                                    <div style={{ opacity: 0.5, fontWeight: 500 }}>Cost ({getCurrencySymbol(globalCurrency)})</div>
                                </th>
                                {/* Weight */}
                                <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                    Weight
                                </th>
                                {/* P&L */}
                                <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                    <div>P&L</div>
                                    <div style={{ opacity: 0.5, fontWeight: 500 }}>Amt</div>
                                </th>
                                {/* Delete Action (Batch Mode Only) */}
                                <th style={{
                                    padding: isBatchEditMode ? '0 12px' : '0',
                                    width: isBatchEditMode ? '60px' : '0px',
                                    opacity: isBatchEditMode ? 1 : 0,
                                    transition: 'all 0.3s ease',
                                    overflow: 'hidden',
                                    borderBottom: '1px solid var(--border)'
                                }} />
                            </tr>
                        </thead>
                        <tbody>
                            <SortableContext
                                items={assets.map(a => a.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {assets.map((asset, i) => {
                                    const isLast = i === assets.length - 1;

                                    // Calculations per row for consistent display
                                    const calculateValues = () => {
                                        const price = asset.currentPrice || asset.price || asset.previousClose || 0;
                                        const cost = asset.buyPrice || asset.averageBuyPrice || asset.avgPrice || 0;
                                        const quantity = asset.quantity || 0;
                                        const value = price * quantity;
                                        const costValue = cost * quantity;

                                        const currency = asset.currency || 'EUR';

                                        // Calculate values in EUR first (Base)
                                        let rateToEur = 1;
                                        if (currency !== 'EUR') {
                                            if (exchangeRates && exchangeRates[currency]) {
                                                rateToEur = exchangeRates[currency];
                                            }
                                        }
                                        const valueEur = value / rateToEur;
                                        const costEur = costValue / rateToEur;

                                        // Convert to Global Currency (e.g. USD) if needed
                                        let globalRate = 1;
                                        if (globalCurrency !== 'EUR') {
                                            if (exchangeRates && exchangeRates[globalCurrency]) {
                                                globalRate = exchangeRates[globalCurrency];
                                            }
                                        }

                                        const valueGlobal = valueEur * globalRate;
                                        const costGlobal = costEur * globalRate;
                                        const plAmount = valueGlobal - costGlobal;
                                        const weight = totalPortfolioValue > 0 ? (valueEur / totalPortfolioValue) * 100 : 0;

                                        return { value, costValue, valueGlobal, costGlobal, plAmount, weight, currency, price, cost };
                                    };

                                    const { value, costValue, valueGlobal, costGlobal, plAmount, weight, currency, price, cost } = calculateValues();

                                    return (
                                        <SortableRow
                                            key={asset.id}
                                            id={asset.id}
                                            isBatchEditMode={isBatchEditMode}
                                        >
                                            {/* Portfolio Pill */}
                                            <td style={{ padding: sizing.rowPadding, textAlign: 'center', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                {isBatchEditMode ? (
                                                    <input
                                                        type="text"
                                                        value={getCurrentValue(asset.id, 'portfolio', asset.portfolio || 'Main')}
                                                        onChange={(e) => {
                                                            setEditedAssets(prev => ({
                                                                ...prev,
                                                                [asset.id]: { ...prev[asset.id], portfolio: e.target.value }
                                                            }));
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: sizing.inputPadding,
                                                            borderRadius: '6px',
                                                            background: 'var(--bg-primary)',
                                                            border: '1px solid var(--accent)',
                                                            fontSize: sizing.pillFontSize,
                                                            fontWeight: 700,
                                                            color: 'var(--text-primary)',
                                                            textAlign: 'center'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        display: 'inline-flex', padding: sizing.pillPadding,
                                                        borderRadius: '6px',
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border)',
                                                        fontSize: sizing.pillFontSize, fontWeight: 700,
                                                        color: 'var(--text-secondary)',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                    }}>
                                                        {asset.portfolio || 'Main'}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Platform Pill */}
                                            <td style={{ padding: sizing.rowPadding, textAlign: 'center', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                {isBatchEditMode ? (
                                                    <input
                                                        type="text"
                                                        value={getCurrentValue(asset.id, 'platform', asset.platform || 'Interactive Brokers')}
                                                        onChange={(e) => {
                                                            setEditedAssets(prev => ({
                                                                ...prev,
                                                                [asset.id]: { ...prev[asset.id], platform: e.target.value }
                                                            }));
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: sizing.inputPadding,
                                                            borderRadius: '6px',
                                                            background: 'var(--bg-primary)',
                                                            border: '1px solid var(--accent)',
                                                            fontSize: sizing.pillFontSize,
                                                            fontWeight: 700,
                                                            color: 'var(--text-primary)',
                                                            textAlign: 'center'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        display: 'inline-flex', padding: sizing.pillPadding,
                                                        borderRadius: '6px',
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border)',
                                                        fontSize: sizing.pillFontSize, fontWeight: 700,
                                                        color: 'var(--text-secondary)',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                    }}>
                                                        {asset.platform || 'Interactive Brokers'}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Asset (Logo + Name) */}
                                            <td style={{ padding: `${sizing.rowPadding} ${sizing.rowPaddingLR}`, verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: `${sizing.logoSize}px`, height: `${sizing.logoSize}px`,
                                                        borderRadius: '50%', overflow: 'hidden',
                                                        background: '#fff',
                                                        border: '1px solid var(--border-light)',
                                                        flexShrink: 0,
                                                        padding: '2px',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                                                    }}>
                                                        <img
                                                            src={getLogoUrl(asset.symbol, asset.type || 'STOCK', asset.exchange, asset.country) || ''}
                                                            alt={asset.symbol}
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                                                            onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${asset.symbol}&background=random` }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        {isBatchEditMode ? (
                                                            <>
                                                                <input
                                                                    type="text"
                                                                    value={getCurrentValue(asset.id, 'name', asset.name || asset.symbol)}
                                                                    onChange={(e) => {
                                                                        setEditedAssets(prev => ({
                                                                            ...prev,
                                                                            [asset.id]: { ...prev[asset.id], name: e.target.value }
                                                                        }));
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '2px 4px',
                                                                        marginBottom: '2px',
                                                                        borderRadius: '4px',
                                                                        background: 'var(--bg-primary)',
                                                                        border: '1px solid var(--accent)',
                                                                        fontSize: '14px',
                                                                        fontWeight: 700,
                                                                        color: 'var(--text-primary)'
                                                                    }}
                                                                />
                                                                <div style={{ fontSize: sizing.symbolSize, color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>{asset.symbol}</div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div style={{ fontSize: sizing.assetNameSize, fontWeight: 700, color: 'var(--text-primary)' }}>{asset.name || asset.symbol}</div>
                                                                <div style={{ fontSize: sizing.symbolSize, color: 'var(--text-muted)', fontWeight: 500 }}>{asset.symbol}</div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Qty */}
                                            <td style={{ padding: `${sizing.rowPaddingLR} 12px`, textAlign: 'right', verticalAlign: 'top', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                {isBatchEditMode ? (
                                                    <input
                                                        type="number"
                                                        value={getCurrentValue(asset.id, 'quantity', asset.quantity)}
                                                        onChange={(e) => {
                                                            setEditedAssets(prev => ({
                                                                ...prev,
                                                                [asset.id]: { ...prev[asset.id], quantity: parseFloat(e.target.value) || 0 }
                                                            }));
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            background: 'var(--bg-primary)',
                                                            border: '1px solid var(--accent)',
                                                            fontSize: '14px',
                                                            fontWeight: 700,
                                                            color: 'var(--text-primary)',
                                                            textAlign: 'right'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatNumber(asset.quantity, 0)}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Price / Cost */}
                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {getCurrencySymbol(currency)}{formatNumber(price)}
                                                </div>
                                                {isBatchEditMode ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={getCurrentValue(asset.id, 'averageBuyPrice', cost)}
                                                        onChange={(e) => {
                                                            setEditedAssets(prev => ({
                                                                ...prev,
                                                                [asset.id]: { ...prev[asset.id], averageBuyPrice: parseFloat(e.target.value) || 0 }
                                                            }));
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '2px 4px',
                                                            marginTop: '2px',
                                                            borderRadius: '4px',
                                                            background: 'var(--bg-primary)',
                                                            border: '1px solid var(--accent)',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            color: 'var(--text-primary)',
                                                            textAlign: 'right'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                                        {getCurrencySymbol(currency)}{formatNumber(cost)}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Value / Cost (Local) */}
                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {currency !== globalCurrency && value > 0 ? `${getCurrencySymbol(currency)}${formatNumber(value, 0)}` : '-'}
                                                </div>
                                                <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                                    {currency !== globalCurrency && costValue > 0 ? `${getCurrencySymbol(currency)}${formatNumber(costValue, 0)}` : '-'}
                                                </div>
                                            </td>
                                            {/* Value / Cost (Global) */}
                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {valueGlobal > 0 ? `${getCurrencySymbol(globalCurrency)}${formatNumber(valueGlobal, 0)}` : '-'}
                                                </div>
                                                <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                                    {costGlobal > 0 ? `${getCurrencySymbol(globalCurrency)}${formatNumber(costGlobal, 0)}` : '-'}
                                                </div>
                                            </td>
                                            {/* Weight */}
                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'top', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {Math.round(weight)}%
                                                </div>
                                            </td>
                                            {/* P&L */}
                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                                                <div style={{ fontSize: sizing.numberSize, fontWeight: 800, color: (asset.plPercentage || 0) >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                                                    {(asset.plPercentage || 0) >= 0 ? '+' : ''}{Math.round(asset.plPercentage || 0)}%
                                                </div>
                                                <div style={{ fontSize: sizing.smallNumberSize, color: plAmount >= 0 ? '#34d399' : '#f87171', marginTop: '2px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {plAmount >= 0 ? '+' : ''}{getCurrencySymbol(globalCurrency)}{formatNumber(plAmount, 0)}
                                                </div>
                                            </td>
                                            {/* Delete Action Button */}
                                            <td style={{
                                                padding: isBatchEditMode ? sizing.rowPadding : 0,
                                                width: isBatchEditMode ? '60px' : '0px',
                                                maxWidth: isBatchEditMode ? '60px' : '0px',
                                                opacity: isBatchEditMode ? 1 : 0,
                                                textAlign: 'center',
                                                verticalAlign: 'middle',
                                                borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                                                transition: 'all 0.3s ease',
                                                overflow: 'hidden',
                                                visibility: isBatchEditMode ? 'visible' : 'hidden'
                                            }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(asset.id);
                                                    }}
                                                    style={{
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '8px',
                                                        width: '32px', height: '32px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        color: '#ef4444',
                                                        transition: 'all 0.2s',
                                                        opacity: isBatchEditMode ? 1 : 0,
                                                        transform: isBatchEditMode ? 'scale(1)' : 'scale(0.8)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = '#fee2e2';
                                                        e.currentTarget.style.borderColor = '#ef4444';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'var(--bg-secondary)';
                                                        e.currentTarget.style.borderColor = 'var(--border)';
                                                    }}
                                                    title="Delete Position"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </SortableRow>
                                    );
                                })}
                            </SortableContext>
                        </tbody>
                    </table>
                </DndContext>
            </div>

        </div>
    );
}

// 2. Allocations - Single Card with Side Options
function AllocationsFullScreen({ assets, exchangeRates }: { assets: any[], exchangeRates?: Record<string, number> }) {
    const [selectedType, setSelectedType] = React.useState('Type');
    const { showAmounts } = usePrivacy();

    // Process assets to include totalValueEUR for the chart
    const processedAssets = React.useMemo(() => {
        return assets.map(asset => {
            const price = asset.currentPrice || asset.price || 0;
            const quantity = asset.quantity || 0;
            const value = price * quantity;

            const currency = asset.currency || 'EUR';
            let rate = 1;
            if (currency !== 'EUR') {
                if (exchangeRates && exchangeRates[currency]) {
                    rate = exchangeRates[currency];
                }
            }
            const valueEur = value / rate;

            return {
                ...asset,
                totalValueEUR: valueEur
            };
        });
    }, [assets, exchangeRates]);

    const totalValueEUR = processedAssets.reduce((sum, a) => sum + (a.totalValueEUR || 0), 0);

    // Calculate chart data
    const getChartData = () => {
        let data: { name: string; value: number; color?: string }[] = [];
        switch (selectedType) {
            case "Portfolio":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const rawName = asset.customGroup || asset.ownerCode || 'Main';
                    const normalizedName = rawName.toLowerCase();
                    const existing = acc.find(item => item.name.toLowerCase() === normalizedName);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name: rawName, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Type":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const rawType = asset.type || 'Uncategorized';
                    const typeName = (asset.symbol === 'EUR' || rawType === 'Cash') ? 'Cash' : rawType;
                    const existing = acc.find(item => item.name === typeName);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name: typeName, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Exchange":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const name = asset.exchange || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Currency":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const name = asset.currency || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Positions":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const name = asset.symbol || asset.name || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Country":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const name = asset.country || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Sector":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const name = asset.sector || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Platform":
                data = processedAssets.reduce((acc: typeof data, asset) => {
                    const name = asset.platform || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
        }
        return data.sort((a, b) => b.value - a.value);
    };

    const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6', '#f97316'];
    const rawChartData = getChartData();

    const processChartData = () => {
        if (rawChartData.length <= 6) {
            return rawChartData.map((item, index) => ({
                ...item,
                color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
            }));
        }

        const topItems = rawChartData.slice(0, 5);
        const otherItems = rawChartData.slice(5);
        const otherValue = otherItems.reduce((sum, item) => sum + item.value, 0);

        const processed = topItems.map((item, index) => ({
            ...item,
            color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
        }));

        if (otherValue > 0) {
            processed.push({
                name: 'Other',
                value: otherValue,
                color: '#94a3b8'
            });
        }

        return processed;
    };

    const chartData = processChartData();
    const totalVal = chartData.reduce((sum, item) => sum + item.value, 0);
    const [hoveredSlice, setHoveredSlice] = React.useState<string | null>(null);

    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Premium Header Card - Compact Single Line */}
            <div style={{
                marginBottom: '24px',
                padding: '12px 24px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                {/* Icon */}
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                }}>
                    <PieChart size={18} strokeWidth={2} />
                </div>

                {/* Title */}
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Allocations
                </h1>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Description */}
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>
                    Analyze your portfolio distribution
                </span>
            </div>

            {/* Main White Card Container */}
            <div style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                padding: '32px',
                boxShadow: 'var(--shadow-md)'
            }}>
                <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                    {/* 1. Breakdown By - Left Container */}
                    <div style={{
                        width: '180px',
                        flexShrink: 0,
                        background: 'var(--bg-primary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        padding: '16px',
                        height: '420px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '12px'
                        }}>
                            Breakdown By
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                            {['Portfolio', 'Type', 'Exchange', 'Currency', 'Country', 'Sector', 'Platform', 'Positions'].map((type) => (
                                <div
                                    key={type}
                                    onClick={() => setSelectedType(type)}
                                    style={{
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        background: selectedType === type ? 'var(--accent)' : 'transparent',
                                        color: selectedType === type ? '#fff' : 'var(--text-primary)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {type}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Pie Chart - Center Container (Takes Remaining Space) */}
                    <div style={{
                        flex: 1,
                        height: '420px',
                        background: 'var(--bg-primary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        <AllocationCard
                            assets={processedAssets}
                            totalValueEUR={totalValueEUR}
                            isBlurred={false}
                            exchangeRates={exchangeRates}
                            onFilterSelect={() => { }}
                            activeFilters={{}}
                            selectedView={selectedType}
                            isFullScreen={true}
                        />
                    </div>

                    {/* 3. Legend - Right Container */}
                    <div style={{
                        width: '280px',
                        flexShrink: 0,
                        background: 'var(--bg-primary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        padding: '16px',
                        height: '420px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '12px'
                        }}>
                            Distribution
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {chartData.map((item) => {
                                const pct = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
                                const isHovered = hoveredSlice === item.name;

                                return (
                                    <div
                                        key={item.name}
                                        onMouseEnter={() => setHoveredSlice(item.name)}
                                        onMouseLeave={() => setHoveredSlice(null)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 10px',
                                            cursor: 'pointer',
                                            background: isHovered ? 'var(--bg-secondary)' : 'transparent',
                                            border: isHovered ? '1px solid var(--border)' : '1px solid transparent',
                                            borderRadius: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {/* Left: Color + Name */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '2px',
                                                backgroundColor: item.color,
                                                flexShrink: 0
                                            }}></div>
                                            <span style={{
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>{item.name}</span>
                                        </div>

                                        {/* Right: Amount + Percentage */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: 'var(--text-muted)',
                                                fontVariantNumeric: 'tabular-nums'
                                            }}>
                                                {showAmounts
                                                    ? `€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(item.value)}`
                                                    : '***'}
                                            </span>
                                            <span style={{
                                                fontSize: '13px',
                                                fontWeight: 800,
                                                color: 'var(--accent)',
                                                fontVariantNumeric: 'tabular-nums',
                                                minWidth: '40px',
                                                textAlign: 'right'
                                            }}>{Math.round(pct)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 3. Performance - Chart Only, No Tabs
function PerformanceFullScreen({ username, totalValueEUR, assets }: { username: string, totalValueEUR: number, assets?: any[] }) {
    // Select ALL benchmarks by default
    const allBenchmarkIds = React.useMemo(() => BENCHMARK_ASSETS.map(b => b.id), []);
    const [selectedBenchmarks, setSelectedBenchmarks] = React.useState<string[]>(allBenchmarkIds);
    const [isPortfolioVisible, setIsPortfolioVisible] = React.useState(true);
    const { showAmounts } = usePrivacy();

    // Calculate performance stats
    const [performanceStats, setPerformanceStats] = React.useState({
        changePercent: 0,
        change: 0
    });

    React.useEffect(() => {
        const fetchPerformanceData = async () => {
            try {
                const response = await fetch(`/api/portfolio/${username}/history?period=1D`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.data && data.data.length > 0) {
                        const latest = data.data[data.data.length - 1];
                        const first = data.data[0];
                        const changePercent = ((latest.value - first.value) / first.value) * 100;
                        const change = totalValueEUR * (changePercent / 100);
                        setPerformanceStats({ changePercent, change });
                    }
                }
            } catch (error) {
                console.error('Error fetching performance data:', error);
            }
        };
        fetchPerformanceData();
    }, [username, totalValueEUR]);

    const handleToggleBenchmark = (id: string) => {
        setSelectedBenchmarks(prev =>
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    const isPositive = performanceStats.changePercent >= 0;

    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Premium Header Card - Compact Single Line */}
            <div style={{
                marginBottom: '24px',
                padding: '12px 24px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                {/* Icon */}
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                }}>
                    <TrendingUp size={18} strokeWidth={2} />
                </div>

                {/* Title */}
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Performance
                </h1>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Stats on Right (Single Line) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {/* Change Stats (Row) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            color: isPositive ? 'var(--success)' : 'var(--danger)',
                            fontVariantNumeric: 'tabular-nums'
                        }}>
                            {isPositive ? '▲' : '▼'}{Math.abs(performanceStats.changePercent).toFixed(2)}%
                        </span>
                        <span style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: isPositive ? 'var(--success)' : 'var(--danger)',
                            fontVariantNumeric: 'tabular-nums',
                            opacity: 0.9
                        }}>
                            {showAmounts
                                ? `${isPositive ? '+' : ''}€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.abs(performanceStats.change))}`
                                : '***'}
                        </span>
                    </div>

                    {/* Divider */}
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

                    {/* Total Wealth (Row) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Total Wealth:
                        </span>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1
                        }}>
                            {showAmounts
                                ? `€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(totalValueEUR)}`
                                : '***'}
                        </span>
                    </div>
                </div>
            </div>

            <PortfolioPerformanceChart
                username={username}
                totalValueEUR={totalValueEUR}
                selectedBenchmarks={selectedBenchmarks}
                isPortfolioVisible={isPortfolioVisible}
                onToggleBenchmark={handleToggleBenchmark}
                onTogglePortfolio={() => setIsPortfolioVisible(!isPortfolioVisible)}
                showHistoryList={false}
                showTabs={false}
                showPortfolioValue={false}
                layoutMode="fullscreen"
            />
        </div>
    );
}

// 4. Insights
function InsightsFullScreen({ username }: { username: string }) {
    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                marginBottom: '24px',
                padding: '12px 24px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                }}>
                    <Lightbulb size={18} strokeWidth={2} />
                </div>
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Insights
                </h1>
            </div>

            <InsightsTab username={username} isFullScreen={true} />
        </div>
    );
}

// 5. Vision - My Wealth Projection
function VisionFullScreen({ username, totalValueEUR }: { username: string, totalValueEUR: number }) {
    const [selectedBenchmarks, setSelectedBenchmarks] = React.useState<string[]>([]);
    const [isPortfolioVisible, setIsPortfolioVisible] = React.useState(true);

    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Premium Header Card - Matching Other Pages */}
            <div style={{
                marginBottom: '24px',
                padding: '12px 24px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                }}>
                    <Eye size={18} strokeWidth={2} />
                </div>
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    My Wealth Projection
                </h1>
            </div>

            <PortfolioPerformanceChart
                username={username}
                totalValueEUR={totalValueEUR}
                selectedBenchmarks={selectedBenchmarks}
                isPortfolioVisible={isPortfolioVisible}
                onToggleBenchmark={(id) => setSelectedBenchmarks(prev =>
                    prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
                )}
                onTogglePortfolio={() => setIsPortfolioVisible(!isPortfolioVisible)}
                defaultRange="ALL"
                showHistoryList={false}
                showTabs={false}
                layoutMode="fullscreen"
                initialView="vision"
            />
        </div>
    );
}

// 6. Financial Goals - Enhanced Design
function FinancialGoalsFullScreen({ goals, totalValueEUR, exchangeRates, isOwner }: { goals: any[], totalValueEUR: number, exchangeRates?: Record<string, number>, isOwner: boolean }) {
    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
                    Financial Goals
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
                    Set and track your financial milestones. Visualize your progress towards achieving your investment objectives.
                </p>
            </div>

            {goals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {goals.map((goal: any) => {
                        const progress = totalValueEUR >= goal.targetAmount ? 100 : (totalValueEUR / goal.targetAmount) * 100;
                        const remaining = Math.max(0, goal.targetAmount - totalValueEUR);

                        return (
                            <div key={goal.id} style={{
                                background: 'linear-gradient(135deg, var(--surface) 0%, var(--bg-secondary) 100%)',
                                borderRadius: '20px',
                                padding: '40px',
                                border: '1px solid var(--border)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Background Pattern */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    width: '200px',
                                    height: '200px',
                                    background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
                                    opacity: 0.05,
                                    pointerEvents: 'none'
                                }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', position: 'relative' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            <Target size={24} style={{ color: 'var(--accent)' }} />
                                            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                                {goal.name}
                                            </h3>
                                        </div>
                                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                                            Target: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>€{goal.targetAmount.toLocaleString()}</span>
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                                            {progress.toFixed(1)}%
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Complete</div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div style={{
                                    height: '16px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    marginBottom: '20px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.min(progress, 100)}%`,
                                        background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                                        borderRadius: '8px',
                                        transition: 'width 0.5s ease-out',
                                        boxShadow: '0 0 10px var(--accent-glow)'
                                    }} />
                                </div>

                                {/* Stats Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Current</div>
                                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>€{totalValueEUR.toLocaleString()}</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Remaining</div>
                                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>€{remaining.toLocaleString()}</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Status</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: progress >= 100 ? '#34d399' : progress >= 50 ? '#f59e0b' : 'var(--text-muted)' }}>
                                            {progress >= 100 ? '✓ Achieved' : progress >= 50 ? 'In Progress' : 'Starting'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '20px',
                    padding: '80px 40px',
                    border: '1px solid var(--border)',
                    textAlign: 'center'
                }}>
                    <Target size={64} style={{ color: 'var(--text-muted)', margin: '0 auto 24px', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        No Goals Set Yet
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
                        Create your first financial goal to start tracking your progress towards your investment objectives.
                    </p>
                </div>
            )}
        </div>
    );
}

// 7. Top & Worst Performers - Table Format with Time Period Sorting
function TopPerformersFullScreen({ assets }: { assets: any[] }) {
    type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | '1Y';
    type SortOrder = 'asc' | 'desc';
    const [sortBy, setSortBy] = React.useState<TimePeriod>('1D');
    const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');

    // Mock performance data for different time periods (replace with real data)
    const getPerformance = (asset: any, period: TimePeriod): number => {
        // This should come from real historical data
        const mockData: Record<TimePeriod, number> = {
            '1D': (asset.plPercentage || 0) * 0.1,
            '1W': (asset.plPercentage || 0) * 0.3,
            '1M': (asset.plPercentage || 0) * 0.6,
            'YTD': (asset.plPercentage || 0) * 0.8,
            '1Y': asset.plPercentage || 0
        };
        return mockData[period];
    };

    const handleSort = (period: TimePeriod) => {
        if (sortBy === period) {
            // Toggle sort order if clicking the same period
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            // New period selected, default to descending
            setSortBy(period);
            setSortOrder('desc');
        }
    };

    const sortedAssets = [...assets]
        .sort((a, b) => {
            const perfA = getPerformance(a, sortBy);
            const perfB = getPerformance(b, sortBy);
            return sortOrder === 'desc' ? perfB - perfA : perfA - perfB;
        });

    return (
        <div style={{ padding: '12px 20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Premium Header Card - Compact */}
            <div style={{
                marginBottom: '12px',
                padding: '8px 16px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                {/* Icon */}
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                }}>
                    <Trophy size={16} strokeWidth={2} />
                </div>

                {/* Title */}
                <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Top & Worst Performers
                </h1>
            </div>

            <div style={{
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '60px' }}>Rank</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Asset</th>
                            {(['1D', '1W', '1M', 'YTD', '1Y'] as TimePeriod[]).map(period => (
                                <th
                                    key={period}
                                    onClick={() => handleSort(period)}
                                    style={{
                                        padding: '8px 12px',
                                        textAlign: 'right',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        color: sortBy === period ? 'var(--accent)' : 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        transition: 'color 0.2s'
                                    }}
                                >
                                    {period} {sortBy === period && (sortOrder === 'desc' ? '▼' : '▲')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAssets.map((asset, i) => (
                            <tr key={asset.id} style={{ borderBottom: i < sortedAssets.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                <td style={{ padding: '6px 12px' }}>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#f97316' : 'var(--bg-secondary)',
                                        border: i > 2 ? '1px solid var(--border)' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: i > 2 ? 'var(--text-muted)' : '#fff',
                                        fontWeight: 700,
                                        fontSize: '11px'
                                    }}>
                                        {i + 1}
                                    </div>
                                </td>
                                <td style={{ padding: '6px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                                            {asset.name || asset.symbol}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{asset.symbol}</div>
                                    </div>
                                </td>
                                {(['1D', '1W', '1M', 'YTD', '1Y'] as TimePeriod[]).map(period => {
                                    const perf = getPerformance(asset, period);
                                    return (
                                        <td
                                            key={period}
                                            style={{
                                                padding: '6px 12px',
                                                textAlign: 'right',
                                                fontWeight: sortBy === period ? 800 : 500,
                                                fontSize: '13px',
                                                color: perf >= 0 ? '#34d399' : '#f87171',
                                                background: sortBy === period ? 'var(--bg-secondary)' : 'transparent'
                                            }}
                                        >
                                            {perf >= 0 ? '+' : ''}{perf.toFixed(2)}%
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// 8. Closed Positions - Full Table (Matching Card View Design)
function ClosedPositionsFullScreen({ onOpenImport, onCountChange }: { onOpenImport: () => void, onCountChange: () => void }) {
    const [positions, setPositions] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedPositions, setExpandedPositions] = React.useState<Set<string>>(new Set());
    const [isBatchEditMode, setIsBatchEditMode] = React.useState(false);

    React.useEffect(() => {
        setLoading(true);
        import('@/app/actions/history').then(({ getClosedPositions }) => {
            getClosedPositions()
                .then(data => {
                    const closed = data.filter(p => Math.abs(p.totalQuantityBought - p.totalQuantitySold) < 0.01);
                    setPositions(closed);
                })
                .catch(err => console.error('[ClosedPositionsFullScreen] Error:', err))
                .finally(() => setLoading(false));
        });
    }, []);

    const toggleExpand = (symbol: string) => {
        setExpandedPositions(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) {
                next.delete(symbol);
            } else {
                next.add(symbol);
            }
            return next;
        });
    };

    const calculateReturn = (pos: any) => {
        if (pos.totalInvested === 0) return 0;
        return (pos.realizedPnl / pos.totalInvested) * 100;
    };

    const calculateHoldDays = (transactions: any[]) => {
        if (transactions.length < 2) return 0;
        const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstDate = new Date(sorted[0].date);
        const lastDate = new Date(sorted[sorted.length - 1].date);
        return Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    };

    const getAssetType = (pos: any) => {
        const ex = pos.exchange?.toUpperCase();
        if (ex === 'BINANCE' || ex === 'COINBASE') return 'CRYPTO';
        if (ex === 'TEFAS') return 'FUND';
        if (pos.name?.toLowerCase().includes('gold') || pos.symbol === 'XAU') return 'COMMODITY';
        return 'STOCK';
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatEUR = (value: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const RED = '#ef4444';
    const GREEN = '#22c55e';

    const handleDeletePosition = async (symbol: string) => {
        // Optimistically update UI
        setPositions(prev => prev.filter(p => p.symbol !== symbol));

        // Persist to database
        try {
            const { deleteAllTransactionsForSymbol } = await import('@/app/actions/history');
            const result = await deleteAllTransactionsForSymbol(symbol);
            if (result.error) {
                console.error('[handleDeletePosition] Error:', result.error);
            } else {
                // Refresh counts in parent component
                onCountChange();
            }
        } catch (error) {
            console.error('[handleDeletePosition] Failed to delete position:', error);
        }
    };

    const handleDeleteTransaction = async (symbol: string, txId: string) => {
        // Optimistically update UI
        setPositions(prev => {
            return prev.map(pos => {
                if (pos.symbol !== symbol) return pos;

                // Filter out the transaction
                const updatedTransactions = pos.transactions.filter((t: any) => t.id !== txId);

                // If no transactions left, this position will be removed in effect (or we could handle it)
                if (updatedTransactions.length === 0) {
                    // We can return null here and filter it out later, or return empty object
                    // For simplicity, let's keep it but it will look empty
                    // Better: filter it out immediately if we can, but map expects 1:1
                    // Let's rely on re-rendering or we can filter after map.
                    return { ...pos, transactions: [], transactionCount: 0, totalQuantityBought: 0, totalQuantitySold: 0, totalInvested: 0, totalRealized: 0, realizedPnl: 0 };
                }

                // Recalculate stats
                const buys = updatedTransactions.filter((t: any) => t.type === 'BUY');
                const sells = updatedTransactions.filter((t: any) => t.type === 'SELL');

                const totalBought = buys.reduce((acc: number, t: any) => acc + t.quantity, 0);
                const totalSold = sells.reduce((acc: number, t: any) => acc + t.quantity, 0);
                const totalInvested = buys.reduce((acc: number, t: any) => acc + (t.quantity * t.price), 0);
                const totalRealized = sells.reduce((acc: number, t: any) => acc + (t.quantity * t.price), 0);
                const realizedPnl = totalRealized - totalInvested;

                return {
                    ...pos,
                    transactions: updatedTransactions,
                    transactionCount: updatedTransactions.length,
                    totalQuantityBought: totalBought,
                    totalQuantitySold: totalSold,
                    totalInvested,
                    totalRealized,
                    realizedPnl
                };
            }).filter(p => p.transactions.length > 0); // Remove positions with no transactions
        });

        // Persist to database
        try {
            const { deleteTransaction } = await import('@/app/actions/history');
            const result = await deleteTransaction(txId);
            if (result.error) {
                console.error('[handleDeleteTransaction] Error:', result.error);
            } else {
                // Refresh counts in parent component
                onCountChange();
            }
        } catch (error) {
            console.error('[handleDeleteTransaction] Failed to delete transaction:', error);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{
                        margin: '0 auto 1rem',
                        width: '24px',
                        height: '24px',
                        border: '2px solid var(--border)',
                        borderTopColor: 'var(--text-primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <p style={{ fontSize: '0.9rem' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Premium Header Card */}
            <div style={{
                marginBottom: '24px',
                padding: '12px 24px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }
            }>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                }}>
                    <XCircle size={18} strokeWidth={2} />
                </div>
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Closed Positions ({positions.length})
                </h1>
                <div style={{ flex: 1 }} />
                <button
                    onClick={onOpenImport}
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.borderColor = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                    title="Import CSV"
                >
                    <FileSpreadsheet size={16} />
                </button>

                {/* Divider */}
                < div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div >

                {/* Batch Edit Button */}
                < button
                    onClick={() => setIsBatchEditMode(!isBatchEditMode)
                    }
                    style={{
                        background: isBatchEditMode ? 'var(--accent)' : 'transparent',
                        border: isBatchEditMode ? '1px solid var(--accent)' : '1px dashed var(--border)',
                        borderRadius: '8px',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        color: isBatchEditMode ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minWidth: isBatchEditMode ? '72px' : '36px',
                        height: '36px',
                        flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                        if (!isBatchEditMode) {
                            e.currentTarget.style.borderColor = 'var(--text-primary)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isBatchEditMode) {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                        }
                    }}
                    title={isBatchEditMode ? "Done" : "Batch Edit"} >
                    {
                        isBatchEditMode ? (
                            <>
                                <Save size={16} />
                            </>
                        ) : (
                            <Pencil size={16} />
                        )}
                </button >

                {/* Cancel Button - Only show in batch edit mode */}
                {
                    isBatchEditMode && (
                        <button
                            onClick={() => setIsBatchEditMode(false)}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                width: '36px',
                                height: '36px',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#ef4444';
                                e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                            title="Cancel">
                            <X size={16} />
                        </button>
                    )
                }
            </div >

            {
                positions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {/* Table Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `minmax(200px, 3fr) 80px 70px 100px 120px 40px ${isBatchEditMode ? '40px' : '0px'}`,
                            gap: '0.5rem',
                            alignItems: 'center',
                            padding: '0 1rem 0.5rem 1rem',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            <div>Asset</div>
                            <div style={{ textAlign: 'right' }}>TX</div>
                            <div style={{ textAlign: 'right' }}>Held</div>
                            <div style={{ textAlign: 'right' }}>P&L %</div>
                            <div style={{ textAlign: 'right' }}>P&L €</div>
                            <div></div>
                            <div style={{ transition: 'all 0.3s ease', opacity: isBatchEditMode ? 1 : 0 }}></div>
                        </div>

                        {/* Position Rows */}
                        {positions
                            .sort((a, b) => new Date(b.lastTradeDate).getTime() - new Date(a.lastTradeDate).getTime())
                            .map((pos) => {
                                const isExpanded = expandedPositions.has(pos.symbol);
                                const holdDays = calculateHoldDays(pos.transactions);
                                const returnPercent = calculateReturn(pos);
                                const pnl = pos.realizedPnl;
                                const isProfit = pnl >= 0;

                                return (
                                    <div key={pos.symbol} style={{
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s ease',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}>
                                        {/* Summary Row */}
                                        <div
                                            onClick={() => toggleExpand(pos.symbol)}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: `minmax(200px, 3fr) 80px 70px 100px 120px 40px ${isBatchEditMode ? '40px' : '0px'}`,
                                                gap: '0.5rem',
                                                alignItems: 'center',
                                                padding: '0.6rem 1rem',
                                                cursor: 'pointer',
                                                background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            {/* Asset */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                <img
                                                    src={getLogoUrl(pos.symbol, getAssetType(pos), pos.exchange) || ''}
                                                    alt={pos.symbol}
                                                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pos.symbol}&background=random`;
                                                    }}
                                                />
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden' }} title={pos.name || pos.symbol}>
                                                        {pos.name || pos.symbol}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {pos.symbol}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* TX */}
                                            <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {pos.transactions.length}
                                            </div>

                                            {/* Held */}
                                            <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {holdDays}d
                                            </div>

                                            {/* P&L % */}
                                            <div style={{
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: isProfit ? GREEN : RED,
                                                fontSize: '13px'
                                            }}>
                                                {isProfit ? '+' : ''}{returnPercent.toFixed(1)}%
                                            </div>

                                            {/* P&L Amount */}
                                            <div style={{
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: isProfit ? GREEN : RED,
                                                fontSize: '13px'
                                            }}>
                                                {isProfit ? '+' : ''}{formatEUR(pnl)}
                                            </div>

                                            {/* Icon */}
                                            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>

                                            {/* Delete Action */}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); handleDeletePosition(pos.symbol); }}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    opacity: isBatchEditMode ? 1 : 0,
                                                    width: isBatchEditMode ? 'auto' : 0,
                                                    overflow: 'hidden',
                                                    transition: 'all 0.3s ease',
                                                    cursor: 'pointer',
                                                    color: '#ef4444'
                                                }}
                                            >
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '6px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: 'rgba(239, 68, 68, 0.1)'
                                                }} title="Delete All">
                                                    <Trash2 size={15} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Transaction Details */}
                                        {isExpanded && (
                                            <div style={{
                                                borderTop: '1px solid var(--border)',
                                                background: 'var(--bg-secondary)',
                                                padding: '0.5rem 1rem',
                                                animation: 'fadeIn 0.2s ease-out'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                                    {[...pos.transactions]
                                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                        .map((tx, idx) => (
                                                            <div key={idx} style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: `minmax(200px, 3fr) 80px 70px 100px 120px 40px ${isBatchEditMode ? '40px' : '0px'}`,
                                                                gap: '0.5rem',
                                                                alignItems: 'center',
                                                                height: '32px',
                                                                borderBottom: idx === pos.transactions.length - 1 ? 'none' : '1px solid var(--border)',
                                                                opacity: 0.9,
                                                                fontSize: '12px'
                                                            }}>
                                                                {/* Col 1: Current Price (first row only) */}
                                                                <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '38px' }}>
                                                                    {idx === 0 && pos.currentPrice && (
                                                                        <div style={{
                                                                            display: 'flex',
                                                                            gap: '6px',
                                                                            alignItems: 'center'
                                                                        }}>
                                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current:</span>
                                                                            <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '11px' }}>
                                                                                <span style={{ opacity: 0.6, marginRight: '2px' }}>@</span>
                                                                                {pos.currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Col 2: Date */}
                                                                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '11px' }}>
                                                                    {formatDate(tx.date)}
                                                                </div>

                                                                {/* Col 3: Type */}
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <span style={{
                                                                        fontWeight: 600,
                                                                        fontSize: '11px',
                                                                        color: tx.type === 'BUY' ? GREEN : RED,
                                                                    }}>
                                                                        {tx.type}
                                                                    </span>
                                                                </div>

                                                                {/* Col 4: Qty */}
                                                                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '11px' }}>
                                                                    <span style={{ opacity: 0.6, marginRight: '2px' }}>x</span>
                                                                    {tx.quantity.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                                                </div>

                                                                {/* Col 5: Price */}
                                                                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '11px' }}>
                                                                    <span style={{ opacity: 0.6, marginRight: '2px' }}>@</span>
                                                                    {tx.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>

                                                                {/* Col 6: Empty */}
                                                                <div></div>

                                                                {/* Col 7: Delete Transaction */}
                                                                <div style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    opacity: isBatchEditMode ? 1 : 0,
                                                                    width: isBatchEditMode ? 'auto' : 0,
                                                                    overflow: 'hidden',
                                                                    transition: 'all 0.3s ease'
                                                                }}>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteTransaction(pos.symbol, tx.id);
                                                                        }}
                                                                        style={{
                                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                                            border: 'none',
                                                                            borderRadius: '4px',
                                                                            width: '24px', height: '24px',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            color: '#ef4444'
                                                                        }}
                                                                        title="Delete Transaction"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div style={{
                        background: 'var(--surface)',
                        borderRadius: '16px',
                        padding: '80px 40px',
                        border: '1px solid var(--border)',
                        textAlign: 'center'
                    }}>
                        <XCircle size={64} style={{ color: 'var(--text-muted)', margin: '0 auto 24px', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                            No Closed Positions
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Your closed positions will appear here once you sell any assets
                        </p>
                    </div>
                )
            }

            < style jsx > {`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style >
        </div >
    );
}

// 9. Share
function ShareFullScreen({ assets, username, totalValueEUR }: { assets: any[], username: string, totalValueEUR: number }) {
    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <ShareHub assets={assets} username={username} totalValueEUR={totalValueEUR} />
        </div>
    );
}

// 10. Settings - All Navbar Settings
function SettingsFullScreen({ preferences }: { preferences?: any }) {
    const [localPrefs, setLocalPrefs] = React.useState({
        theme: preferences?.theme || 'light',
        currency: preferences?.currency || 'EUR',
        language: preferences?.language || 'English',
        defaultViewMode: preferences?.defaultViewMode || 'fullscreen',
        priceAlerts: preferences?.priceAlerts !== false,
        goalUpdates: preferences?.goalUpdates !== false,
        marketNews: preferences?.marketNews === true
    });
    const [saving, setSaving] = React.useState(false);
    const [showSuccess, setShowSuccess] = React.useState(false);

    const savePreference = async (key: string, value: any) => {
        setSaving(true);
        try {
            const { updateUserPreferences } = await import('@/lib/actions');
            await updateUserPreferences({ [key]: value });
            setLocalPrefs(prev => ({ ...prev, [key]: value }));
            console.log(`Saved ${key}:`, value);

            // Show success notification
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to save preference:', error);
            alert('Failed to save setting. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
                        Settings
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        Customize your portfolio preferences and account settings
                    </p>
                </div>
                {/* Success Notification */}
                {showSuccess && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <Save size={16} />
                        <span>Changes Saved</span>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                {/* Display Settings */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '32px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
                        Display
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Theme */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Theme
                            </span>
                            <select
                                value={localPrefs.theme}
                                onChange={(e) => savePreference('theme', e.target.value)}
                                disabled={saving}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-primary)',
                                    fontWeight: 500,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="system">System</option>
                            </select>
                        </div>

                        {/* Currency */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Currency
                            </span>
                            <select
                                value={localPrefs.currency}
                                onChange={(e) => savePreference('currency', e.target.value)}
                                disabled={saving}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-primary)',
                                    fontWeight: 500,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="EUR">EUR (€)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="TRY">TRY (₺)</option>
                            </select>
                        </div>

                        {/* Language */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Language
                            </span>
                            <select
                                value={localPrefs.language}
                                onChange={(e) => savePreference('language', e.target.value)}
                                disabled={saving}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-primary)',
                                    fontWeight: 500,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="English">English</option>
                                <option value="Turkish">Türkçe</option>
                                <option value="German">Deutsch</option>
                            </select>
                        </div>

                        {/* Default View Mode */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Default View Mode
                            </span>
                            <select
                                value={localPrefs.defaultViewMode}
                                onChange={(e) => savePreference('defaultViewMode', e.target.value)}
                                disabled={saving}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-primary)',
                                    fontWeight: 500,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="fullscreen">Full Screen</option>
                                <option value="card">Card View</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Account Settings */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '32px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
                        Account
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Profile
                            </span>
                            <button
                                onClick={() => alert('Profile editing coming soon!')}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--accent)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0
                                }}
                            >
                                Edit
                            </button>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Privacy
                            </span>
                            <button
                                onClick={() => alert('Privacy settings coming soon!')}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--accent)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0
                                }}
                            >
                                Manage
                            </button>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Security
                            </span>
                            <button
                                onClick={() => alert('Security settings coming soon!')}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--accent)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0
                                }}
                            >
                                Configure
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '32px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
                        Notifications
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                            { key: 'priceAlerts', label: 'Price Alerts' },
                            { key: 'goalUpdates', label: 'Goal Updates' },
                            { key: 'marketNews', label: 'Market News' }
                        ].map((setting) => (
                            <div key={setting.key} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {setting.label}
                                </span>
                                <button
                                    onClick={() => savePreference(setting.key, !localPrefs[setting.key as keyof typeof localPrefs])}
                                    disabled={saving}
                                    style={{
                                        width: '40px',
                                        height: '20px',
                                        borderRadius: '10px',
                                        background: localPrefs[setting.key as keyof typeof localPrefs] ? 'var(--accent)' : 'var(--border)',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        border: 'none',
                                        padding: 0,
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        background: '#fff',
                                        position: 'absolute',
                                        top: '2px',
                                        left: localPrefs[setting.key as keyof typeof localPrefs] ? '22px' : '2px',
                                        transition: 'left 0.2s',
                                        pointerEvents: 'none'
                                    }} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data & Privacy */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '32px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
                        Data & Privacy
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Export Data
                            </span>
                            <button
                                onClick={() => alert('Export data functionality coming soon!')}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--accent)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0
                                }}
                            >
                                Download
                            </button>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Delete Account
                            </span>
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                                        alert('Account deletion functionality coming soon!');
                                    }
                                }}
                                style={{
                                    fontSize: '13px',
                                    color: '#f87171',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0
                                }}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
