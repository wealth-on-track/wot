"use client";

import React, { useState } from "react";
import {
    Briefcase, PieChart, TrendingUp, Lightbulb, Eye,
    Target, Trophy, XCircle, Share2, Settings, Hash, Monitor, Pencil, Wallet, Save, X,
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, Trash2, GripVertical, Upload, ListChecks, SlidersHorizontal, Search,
    LayoutGrid, List, PanelLeftClose, PanelLeft, ChevronsLeft, ChevronsRight, Menu
} from "lucide-react";
import { useRouter } from "next/navigation";
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

import { ImportCSVInline } from "./ImportCSVInline";
import { TransactionsFullScreen } from "./TransactionsFullScreen";
import { getLogoUrl } from "@/lib/logos";
import { ShareHub } from "./share/ShareHub";
import { TransactionHistory } from '@/components/TransactionHistory';
import { InsightsTab } from "./InsightsTab";
import { AllocationCard } from "./PortfolioSidebarComponents";
import { PerformanceChart } from "./charts/PerformanceChart";
import { VisionChart } from "./charts/VisionChart";
import { usePrivacy } from "@/context/PrivacyContext";
import { useTheme } from "@/context/ThemeContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage } from "@/context/LanguageContext";
import { BENCHMARK_ASSETS } from "@/lib/benchmarkApi";
import { getPortfolioStyle } from "@/lib/portfolioStyles";
import { deleteAccount, saveBESData, getBESData } from "@/lib/actions";
import { lookupTefasFund } from "@/app/actions/search";
import { signOut } from "next-auth/react";
// BESPortfolioItem no longer needed - BES shown inline in table
import { BESMetadata } from "@/lib/besTypes";

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

    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <tr
            ref={setNodeRef}
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Drag Handle Column */}
            <td style={{
                width: '30px',
                padding: '0',
                textAlign: 'center',
                verticalAlign: 'middle',
                borderBottom: '1px solid var(--border)',
                cursor: isBatchEditMode ? 'default' : 'grab',
                background: isHovered ? 'var(--bg-secondary)' : 'transparent',
                transition: 'background 0.15s ease'
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
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child) && child.type === 'td') {
                    const tdChild = child as React.ReactElement<React.TdHTMLAttributes<HTMLTableCellElement>>;
                    return React.cloneElement(tdChild, {
                        style: {
                            ...tdChild.props.style,
                            background: isHovered ? 'var(--bg-secondary)' : (tdChild.props.style?.background || 'transparent'),
                            transition: 'background 0.15s ease'
                        }
                    });
                }
                return child;
            })}
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
    | 'share'
    | 'settings';

interface MenuItem {
    id: SectionId;
    label: string;
    icon: React.ElementType;
}

const MENU_ITEMS: MenuItem[] = [
    { id: 'open-positions', label: 'Positions', icon: Briefcase },
    { id: 'allocations', label: 'Allocations', icon: PieChart },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'vision', label: 'Vision', icon: Eye },
    { id: 'financial-goals', label: 'Financial Goals', icon: Target },
    { id: 'top-performers', label: 'Top & Worst Performers', icon: Trophy },
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
    userEmail?: string;
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
    userEmail,
    defaultSection = 'open-positions'
}: FullScreenLayoutProps) {
    const [activeSection, setActiveSection] = useState<SectionId>(defaultSection);
    const [hoveredItem, setHoveredItem] = useState<SectionId | null>(null);
    const [closedPositionsCount, setClosedPositionsCount] = useState<number>(0);
    const [openPositionsCount, setOpenPositionsCount] = useState<number>(assets.length);
    const [activePositionTab, setActivePositionTab] = useState<'open' | 'closed'>('open');
    const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(true);
    const [isToggleHovered, setIsToggleHovered] = useState(false);

    // Restore sidebar state preference
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedState = localStorage.getItem('sidebarExpanded');
            if (savedState !== null) {
                setSidebarExpanded(savedState === 'true');
            }
        }
    }, []);

    // Sync open positions count with assets prop updates (e.g. after import)
    React.useEffect(() => {
        setOpenPositionsCount(assets.length);
    }, [assets]);

    // Fetch closed positions count only on initial mount (not on every section change)
    // Open positions count is already synced from assets prop
    React.useEffect(() => {
        // Only fetch closed positions count once on mount
        import('@/app/actions/history').then(({ getClosedPositions }) => {
            getClosedPositions()
                .then(data => {
                    // No additional filter - getClosedPositions() returns only closed positions
                    setClosedPositionsCount(data.length);
                })
                .catch(err => console.error('[FullScreenLayout] Error fetching closed positions count:', err));
        });
    }, []); // Empty dependency - only run on mount

    // sectionKey removed - unnecessary forced remounts were causing performance issues

    const router = useRouter();

    // Function to refresh counts (called after save/delete operations)
    const refreshCounts = React.useCallback(() => {
        // Trigger server data refresh to get latest assets and transactions
        router.refresh();

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
                    // No additional filter - getClosedPositions() returns only closed positions
                    setClosedPositionsCount(data.length);
                })
                .catch(err => console.error('[refreshCounts] Error fetching closed positions count:', err));
        });
    }, [router]);

    const renderContent = () => {
        switch (activeSection) {
            case 'open-positions':
                return <OpenPositionsFullScreen key="open-positions" assets={assets} exchangeRates={exchangeRates} globalCurrency={preferences?.currency || 'EUR'} onCountChange={refreshCounts} closedPositionsCount={closedPositionsCount} isOwner={isOwner} />;
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
            case 'share':
                return <ShareFullScreen key={activeSection} assets={assets} username={username} totalValueEUR={totalValueEUR} />;
            case 'settings':
                return <SettingsFullScreen key={activeSection} preferences={preferences} username={username} userEmail={userEmail} />;
            default:
                return null;
        }
    };

    return (
        <div style={{
            display: 'flex',
            minHeight: 'calc(100vh - 5rem)',
            marginTop: '5rem', // CONTROL TOP GAP HERE (Distance from top)
            background: 'var(--bg-primary)',
            position: 'relative'
        }}>
            {/* Sidebar Menu - Collapsible */}
            <div style={{
                width: sidebarExpanded ? '90px' : '56px',
                background: 'var(--surface)',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 0',
                position: 'relative',
                zIndex: 10,
                boxShadow: 'var(--shadow-sm)',
                overflowY: sidebarExpanded ? 'auto' : 'visible',
                transition: 'width 0.2s ease'
            }}>
                {/* Toggle Button */}
                <button
                    onClick={() => {
                        const newState = !sidebarExpanded;
                        setSidebarExpanded(newState);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('sidebarExpanded', String(newState));
                        }
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: sidebarExpanded ? 'flex-end' : 'center',
                        padding: sidebarExpanded ? '6px 10px' : '8px',
                        margin: '0 8px 6px 8px',
                        background: isToggleHovered ? 'var(--bg-secondary)' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: isToggleHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                        height: '28px'
                    }}
                    title={sidebarExpanded ? 'Collapse menu' : 'Expand menu'}
                    onMouseEnter={() => setIsToggleHovered(true)}
                    onMouseLeave={() => setIsToggleHovered(false)}
                >
                    {sidebarExpanded ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hide</span>
                            <ChevronsLeft size={16} />
                        </div>
                    ) : (
                        <ChevronsRight size={18} />
                    )}
                </button>

                {/* Custom Premium Tooltip for Toggle */}
                {!sidebarExpanded && isToggleHovered && (
                    <div style={{
                        position: 'absolute',
                        left: '60px',
                        top: '24px', // Aligned with button center (approx)
                        transform: 'translateY(-50%)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-primary)'
                        }}>
                            Open Menu
                        </div>
                        {/* Arrow */}
                        <div style={{
                            position: 'absolute',
                            left: '-6px',
                            top: '50%',
                            transform: 'translateY(-50%) rotate(-45deg)',
                            width: '10px',
                            height: '10px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRight: 'none',
                            borderBottom: 'none'
                        }} />
                    </div>
                )}

                {/* Divider after toggle */}
                <div style={{
                    height: '1px',
                    background: 'var(--border)',
                    margin: '0 8px 20px 8px'
                }} />

                {MENU_ITEMS.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    const isHovered = hoveredItem === item.id;
                    const showCount = item.id === 'open-positions' && openPositionsCount > 0;
                    const isLast = index === MENU_ITEMS.length - 1;

                    return (
                        <React.Fragment key={item.id}>
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setActiveSection(item.id)}
                                    onMouseEnter={() => setHoveredItem(item.id)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: sidebarExpanded ? '2px' : '0',
                                        padding: sidebarExpanded ? '6px 4px' : '10px 4px',
                                        background: isActive ? 'var(--accent)' : isHovered ? 'var(--bg-secondary)' : 'transparent',
                                        color: isActive ? '#fff' : 'var(--text-muted)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    <Icon size={16} style={{ flexShrink: 0 }} />
                                    {sidebarExpanded && (
                                        <span style={{
                                            fontSize: '9px',
                                            fontWeight: 600,
                                            textAlign: 'center',
                                            lineHeight: 1.2,
                                            maxWidth: '80px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {item.label}
                                        </span>
                                    )}
                                    {isActive && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: '3px',
                                            background: '#fff',
                                            borderRadius: '0 3px 3px 0'
                                        }} />
                                    )}
                                </button>

                                {/* Tooltip - only when collapsed */}
                                {!sidebarExpanded && isHovered && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '60px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                                        zIndex: 1000,
                                        whiteSpace: 'nowrap',
                                        pointerEvents: 'none'
                                    }}>
                                        <div style={{
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)'
                                        }}>
                                            {item.label}
                                        </div>
                                        {/* Arrow */}
                                        <div style={{
                                            position: 'absolute',
                                            left: '-6px',
                                            top: '50%',
                                            transform: 'translateY(-50%) rotate(-45deg)',
                                            width: '10px',
                                            height: '10px',
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            borderRight: 'none',
                                            borderBottom: 'none'
                                        }} />
                                    </div>
                                )}
                            </div>
                            {/* Divider line between items */}
                            {!isLast && (
                                <div style={{
                                    height: '1px',
                                    background: 'var(--border)',
                                    margin: sidebarExpanded ? '6px 12px' : '6px 8px',
                                    opacity: 0.5
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                background: 'var(--bg-primary)',
                minHeight: '100%',
                overflowY: 'auto'
            }}>
                <div key={activeSection} style={{ animation: 'fadeIn 0.4s ease-out' }}>
                    {renderContent()}
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

        </div>
    );
}

// Import Progress Overlay Component
function ImportProgressOverlay({ progress, phase, icon, successStats }: {
    progress: number;
    phase: string;
    icon: string;
    successStats?: { open: number; closed: number; statement: number } | null;
}) {
    const isComplete = successStats !== null && successStats !== undefined;

    return (
        <div style={{
            position: 'fixed',
            top: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            minWidth: '420px',
            backdropFilter: 'blur(20px)',
            animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            {!isComplete ? (
                <>
                    {/* Progress Mode */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        marginBottom: '16px'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            boxShadow: '0 8px 24px var(--accent-glow)',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }}>
                            {icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '15px',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: '4px'
                            }}>
                                Importing your wealth...
                            </div>
                            <div style={{
                                fontSize: '13px',
                                color: 'var(--text-secondary)',
                                fontWeight: 500
                            }}>
                                {phase}
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        marginBottom: '8px'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                            borderRadius: '3px',
                            transition: 'width 0.15s ease-out',
                            boxShadow: '0 0 10px var(--accent-glow)'
                        }} />
                    </div>

                    {/* Progress Percentage */}
                    <div style={{
                        textAlign: 'right',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontWeight: 600
                    }}>
                        {Math.round(progress)}%
                    </div>
                </>
            ) : (
                <>
                    {/* Success Mode */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
                        }}>
                            ✅
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '15px',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: '4px'
                            }}>
                                Import Complete!
                            </div>
                            <div style={{
                                fontSize: '13px',
                                color: 'var(--text-secondary)',
                                fontWeight: 500
                            }}>
                                {(() => {
                                    const parts = [];
                                    if (successStats.open > 0) parts.push(`${successStats.open} Open`);
                                    if (successStats.closed > 0) parts.push(`${successStats.closed} Closed`);
                                    if (successStats.statement > 0) parts.push(`${successStats.statement} Statement`);
                                    return parts.join(', ') + ' Imported';
                                })()}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <style jsx>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.05);
                        opacity: 0.9;
                    }
                }
            `}</style>
        </div>
    );
}

// Full Screen Section Components

// BES Expanded Details - Shows funds and contracts when BES row is expanded
function BESExpandedDetails({ besMeta, besKP, besDK }: { besMeta: BESMetadata; besKP: number; besDK: number }) {
    const [showContracts, setShowContracts] = React.useState(false);
    const [fundPrices, setFundPrices] = React.useState<Record<string, number>>({});
    const [loadingPrices, setLoadingPrices] = React.useState(true);
    const fmt = (v: number) => new Intl.NumberFormat('tr-TR').format(v);

    // Fetch TEFAS prices on mount
    React.useEffect(() => {
        const fetchPrices = async () => {
            try {
                const codes = besMeta.katkiPayiFunds?.map(f => f.code) || [];
                if (codes.length === 0) return;

                const response = await fetch('/api/tefas/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codes })
                });

                if (response.ok) {
                    const data = await response.json();
                    setFundPrices(data.prices || {});
                }
            } catch (error) {
                console.error('Failed to fetch TEFAS prices:', error);
            } finally {
                setLoadingPrices(false);
            }
        };

        fetchPrices();
    }, [besMeta.katkiPayiFunds]);

    return (
        <div style={{ marginLeft: '0px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Fon Dağılımı Tablosu */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Kod</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Fon Adı</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>%</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Avg. Price</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Price</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {besMeta.katkiPayiFunds?.map((f: any, idx: number) => {
                        const kpValue = Math.round(besKP * f.percentage / 100);
                        const currentPrice = fundPrices[f.code];
                        return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--accent)' }}>{f.code}</td>
                                <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{f.name}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{f.percentage}%</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{f.avgPrice ? f.avgPrice.toFixed(6) : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{loadingPrices ? '...' : (currentPrice ? currentPrice.toFixed(6) : '-')}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(kpValue)} ₺</td>
                            </tr>
                        );
                    })}
                    {/* Devlet Katkısı Fonu - AET */}
                    <tr style={{ background: 'rgba(34,197,94,0.05)', borderLeft: '3px solid var(--success)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--success)' }}>AET</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                            Devlet Katkısı Fonu
                            <span style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(34,197,94,0.15)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>DK</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>100%</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--success)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(besDK)} ₺</td>
                    </tr>
                </tbody>
            </table>

            {/* Kontratlar - Collapsible */}
            <div style={{ borderTop: '1px solid var(--border)' }}>
                <button
                    onClick={() => setShowContracts(!showContracts)}
                    style={{
                        width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600
                    }}
                >
                    <span>KONTRATLAR ({besMeta.contracts?.length || 0})</span>
                    <ChevronDown size={16} style={{ transform: showContracts ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>
                {showContracts && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: 'var(--surface)' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Kontrat</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Katkı Payı</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Devlet Katkısı</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Toplam</th>
                            </tr>
                        </thead>
                        <tbody>
                            {besMeta.contracts?.map((c: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.katkiPayi)} ₺</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.devletKatkisi)} ₺</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.katkiPayi + c.devletKatkisi)} ₺</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// Inline BES Editor - Clean compact design
function BESInlineEditor({ initialData, onSave, onCancel, availablePortfolios = [], availablePlatforms = [] }: {
    initialData: BESMetadata | null;
    onSave: (data: BESMetadata, portfolio: string, platform: string) => Promise<void>;
    onCancel: () => void;
    availablePortfolios?: { id: string; name: string }[];
    availablePlatforms?: string[];
}) {
    const [contracts, setContracts] = React.useState<Array<{ id: string; name: string; katkiPayi: number; devletKatkisi: number }>>([
        { id: '1', name: 'BEH 1', katkiPayi: 0, devletKatkisi: 0 }
    ]);
    const [funds, setFunds] = React.useState<Array<{ code: string; name: string; percentage: number; price?: number }>>([
        { code: '', name: '', percentage: 25 },
        { code: '', name: '', percentage: 25 },
        { code: '', name: '', percentage: 25 },
        { code: '', name: '', percentage: 25 },
    ]);

    const [loadingFund, setLoadingFund] = React.useState<number | null>(null);
    const [portfolioName, setPortfolioName] = React.useState('');
    const [platformName, setPlatformName] = React.useState('');
    const [showPortfolioDropdown, setShowPortfolioDropdown] = React.useState(false);
    const [showPlatformDropdown, setShowPlatformDropdown] = React.useState(false);
    const [validationErrors, setValidationErrors] = React.useState({ portfolio: false, platform: false });

    // Get display value for fund (CODE - NAME or just what user typed)
    const getFundDisplay = (fund: { code: string; name: string }) => {
        if (fund.code && fund.name) return `${fund.code} - ${fund.name}`;
        return fund.code;
    };

    // Handle fund input change - extract code and lookup from TEFAS
    const handleFundInputChange = async (index: number, value: string) => {
        // Extract code from input (first word before " - " or entire input if no dash)
        const code = value.split(' - ')[0].toUpperCase().trim();

        const u = [...funds];
        // If user is clearing or typing new code, reset name
        if (!value || !value.includes(' - ')) {
            u[index].code = code;
            u[index].name = '';
            u[index].price = undefined;
        }
        setFunds(u);

        // Only search if code is 3-4 characters and doesn't already have a name
        if (code.length >= 3 && code.length <= 4 && !value.includes(' - ')) {
            setLoadingFund(index);
            try {
                const result = await lookupTefasFund(code);
                if (result) {
                    setFunds(prev => {
                        const updated = [...prev];
                        if (updated[index].code === code) {
                            updated[index].name = result.name;
                            updated[index].price = result.price;
                        }
                        return updated;
                    });
                }
            } catch (e) {
                console.error('Fund lookup error:', e);
            } finally {
                setLoadingFund(null);
            }
        }
    };
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (initialData) {
            setContracts(initialData.contracts);
            setFunds(initialData.katkiPayiFunds);
        }
    }, [initialData]);

    const totalPct = funds.reduce((s, f) => s + f.percentage, 0);
    const valid = Math.abs(totalPct - 100) < 0.01;
    const totalKP = contracts.reduce((s, c) => s + c.katkiPayi, 0);
    const totalDK = contracts.reduce((s, c) => s + c.devletKatkisi, 0);
    const fmt = (v: number) => v ? new Intl.NumberFormat('tr-TR').format(v) : '';
    const parse = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

    const save = async () => {
        // Validate portfolio and platform
        const errors = { portfolio: !portfolioName.trim(), platform: !platformName.trim() };
        setValidationErrors(errors);
        if (errors.portfolio || errors.platform) return;
        if (!valid || !contracts.length) return;

        setSaving(true);
        try { await onSave({ contracts, katkiPayiFunds: funds, lastUpdated: new Date().toISOString() }, portfolioName.trim(), platformName.trim()); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(167,139,250,0.05) 100%)' }}>
                {/* Left: BES Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '11px' }}>BES</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>BES Emeklilik</span>
                        <span style={{ color: 'var(--border)', fontSize: '14px' }}>|</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{contracts.length} BEH</span>
                        <span style={{ color: 'var(--border)', fontSize: '14px' }}>|</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent)' }}>{fmt(totalKP + totalDK)} TL</span>
                    </div>
                </div>

                {/* Right: Portfolio, Platform, Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Portfolio Input */}
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '8px',
                            border: `2px solid ${validationErrors.portfolio ? '#ef4444' : 'var(--border)'}`,
                            background: 'var(--bg-primary)',
                            height: '32px',
                            animation: validationErrors.portfolio ? 'shake 0.5s ease' : 'none',
                            boxShadow: validationErrors.portfolio ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none'
                        }}>
                            <div style={{ background: 'rgba(120, 120, 120, 0.08)', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px', borderRight: '1px solid var(--border)', borderRadius: '6px 0 0 6px' }}>
                                <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PORTFOLIO</label>
                            </div>
                            <input
                                type="text"
                                placeholder={validationErrors.portfolio ? "Required!" : "Select..."}
                                value={portfolioName}
                                onFocus={() => setShowPortfolioDropdown(true)}
                                onBlur={() => setTimeout(() => setShowPortfolioDropdown(false), 200)}
                                onChange={(e) => { setPortfolioName(e.target.value); if (e.target.value.trim()) setValidationErrors(p => ({ ...p, portfolio: false })); }}
                                style={{ border: 'none', background: 'transparent', color: validationErrors.portfolio ? '#ef4444' : 'var(--text-primary)', fontSize: '12px', fontWeight: 600, outline: 'none', width: '90px', padding: '0 8px' }}
                            />
                        </div>
                        {showPortfolioDropdown && availablePortfolios.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, width: '150px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 50, marginTop: '4px', padding: '4px' }}>
                                {availablePortfolios.filter(p => p.name.toLowerCase().includes(portfolioName.toLowerCase())).map(p => (
                                    <div key={p.id} onClick={() => { setPortfolioName(p.name); setShowPortfolioDropdown(false); setValidationErrors(prev => ({ ...prev, portfolio: false })); }} style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{p.name}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <span style={{ color: 'var(--border)', opacity: 0.5 }}>|</span>

                    {/* Platform Input */}
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '8px',
                            border: `2px solid ${validationErrors.platform ? '#ef4444' : 'var(--border)'}`,
                            background: 'var(--bg-primary)',
                            height: '32px',
                            animation: validationErrors.platform ? 'shake 0.5s ease' : 'none',
                            boxShadow: validationErrors.platform ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none'
                        }}>
                            <div style={{ background: 'rgba(120, 120, 120, 0.08)', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px', borderRight: '1px solid var(--border)', borderRadius: '6px 0 0 6px' }}>
                                <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PLATFORM</label>
                            </div>
                            <input
                                type="text"
                                placeholder={validationErrors.platform ? "Required!" : "e.g. Anadolu..."}
                                value={platformName}
                                onFocus={() => setShowPlatformDropdown(true)}
                                onBlur={() => setTimeout(() => setShowPlatformDropdown(false), 200)}
                                onChange={(e) => { setPlatformName(e.target.value); if (e.target.value.trim()) setValidationErrors(p => ({ ...p, platform: false })); }}
                                style={{ border: 'none', background: 'transparent', color: validationErrors.platform ? '#ef4444' : 'var(--text-primary)', fontSize: '12px', fontWeight: 600, outline: 'none', width: '90px', padding: '0 8px' }}
                            />
                        </div>
                        {showPlatformDropdown && availablePlatforms.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, width: '150px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 50, marginTop: '4px', padding: '4px' }}>
                                {availablePlatforms.filter(p => p.toLowerCase().includes(platformName.toLowerCase())).map(p => (
                                    <div key={p} onClick={() => { setPlatformName(p); setShowPlatformDropdown(false); setValidationErrors(prev => ({ ...prev, platform: false })); }} style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{p}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <span style={{ color: 'var(--border)', opacity: 0.5 }}>|</span>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={onCancel} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Iptal</button>
                        <button onClick={save} disabled={!valid || saving} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: valid ? 'var(--accent)' : 'var(--bg-secondary)', color: valid ? '#fff' : 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed' }}>{saving ? '...' : 'Kaydet'}</button>
                    </div>
                </div>
            </div>

            {/* Content - Two framed panels 50/50 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                {/* LEFT: Contracts Section */}
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bireysel Emeklilik Hesaplari</span>
                    </div>
                    {/* Table Container */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {/* Header Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 1fr 1fr 20px', gap: '8px', padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            <div>Hesap</div>
                            <div style={{ textAlign: 'right' }}>Katki Payi</div>
                            <div style={{ textAlign: 'right' }}>Devlet Katkisi</div>
                            <div style={{ textAlign: 'right' }}>Toplam</div>
                            <div></div>
                        </div>
                        {/* Data Rows */}
                        {contracts.map((c, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 1fr 1fr 20px', gap: '8px', alignItems: 'center', padding: '8px 12px', borderBottom: i < contracts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <input value={c.name} onChange={e => { const u = [...contracts]; u[i].name = e.target.value; setContracts(u); }} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                                <input value={fmt(c.katkiPayi)} onChange={e => { const u = [...contracts]; u[i].katkiPayi = parse(e.target.value); setContracts(u); }} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                                <input value={fmt(c.devletKatkisi)} onChange={e => { const u = [...contracts]; u[i].devletKatkisi = parse(e.target.value); setContracts(u); }} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                                <div style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surface)', fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textAlign: 'right', minWidth: 0, boxSizing: 'border-box' }}>{fmt(c.katkiPayi + c.devletKatkisi)} ₺</div>
                                <button onClick={() => setContracts(contracts.filter((_, x) => x !== i))} style={{ padding: '2px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.5, fontSize: '14px', lineHeight: 1 }}>×</button>
                            </div>
                        ))}
                        {/* Add Button */}
                        <div style={{ padding: '8px 12px', borderTop: contracts.length > 0 ? '1px solid var(--border)' : 'none' }}>
                            <button onClick={() => setContracts([...contracts, { id: `${contracts.length + 1}`, name: `BEH ${contracts.length + 1}`, katkiPayi: 0, devletKatkisi: 0 }])} style={{ padding: '6px 12px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', borderRadius: '5px', width: '100%' }}>+ Yeni Hesap</button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Funds Section */}
                <div style={{ padding: '16px 20px', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fon Dagilimi</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: valid ? 'var(--success)' : 'var(--danger)', padding: '4px 10px', background: valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>%{totalPct} {valid && '✓'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {funds.map((f, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 80px 24px', gap: '8px', alignItems: 'center', padding: '8px 12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <input
                                    value={loadingFund === i ? `${f.code} - Araniyor...` : getFundDisplay(f)}
                                    onChange={e => handleFundInputChange(i, e.target.value)}
                                    placeholder="Fon kodu girin (orn: AH2)"
                                    disabled={loadingFund === i}
                                    style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', fontStyle: loadingFund === i ? 'italic' : 'normal' }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>%</span>
                                    <input type="number" value={f.percentage} onChange={e => { const u = [...funds]; u[i].percentage = parseFloat(e.target.value) || 0; setFunds(u); }} style={{ padding: '6px 4px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right', width: '40px' }} />
                                </div>
                                <div style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)', fontSize: '11px', color: f.price ? 'var(--accent)' : 'var(--text-muted)', textAlign: 'right', fontWeight: f.price ? 600 : 400 }}>{f.price ? f.price.toFixed(6) : 'Fiyat'}</div>
                                <button onClick={() => setFunds(funds.filter((_, x) => x !== i))} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.5, fontSize: '14px', lineHeight: 1 }}>×</button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setFunds([...funds, { code: '', name: '', percentage: 0 }])} style={{ marginTop: '10px', padding: '8px 14px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', width: '100%' }}>+ Yeni Fon</button>
                </div>
            </div>
        </div>
    );
}

// 1. Open Positions - Table Only, No Tabs
function OpenPositionsFullScreen({ assets: initialAssets, exchangeRates, globalCurrency = 'EUR', onCountChange, closedPositionsCount, isOwner = true }: { assets: any[], exchangeRates?: Record<string, number>, globalCurrency?: string, onCountChange: () => void, closedPositionsCount: number, isOwner?: boolean }) {
    // Use stable ID to prevent hydration mismatch with Turbopack
    const dndId = 'open-positions-dnd';
    const [activePositionTab, setActivePositionTab] = React.useState<'open' | 'closed' | 'import' | 'transactions'>('open');
    const [transViewMode, setTransViewMode] = React.useState<'group' | 'date'>('group');
    const [isBatchEditMode, setIsBatchEditMode] = React.useState(false);
    const [isClosedBatchEditMode, setIsClosedBatchEditMode] = React.useState(false);
    const [editedAssets, setEditedAssets] = React.useState<Record<string, any>>({});
    const [assets, setAssets] = React.useState(() => initialAssets.filter(a => Math.abs(a.quantity) > 0.000001 || a.type === 'BES'));
    const [expandedAssets, setExpandedAssets] = React.useState<Set<string>>(new Set());

    const toggleExpand = (assetId: string) => {
        setExpandedAssets(prev => {
            const next = new Set(prev);
            if (next.has(assetId)) next.delete(assetId);
            else next.add(assetId);
            return next;
        });
    };

    const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);

    // Sync state with props when data is refreshed (e.g. after import)
    React.useEffect(() => {
        const filteredAssets = initialAssets.filter(a => Math.abs(a.quantity) > 0.000001 || a.type === 'BES');
        setAssets(filteredAssets);
    }, [initialAssets]);

    const [showSuccessNotification, setShowSuccessNotification] = React.useState(false);
    const [successMessage, setSuccessMessage] = React.useState('Saved');

    // Import progress overlay state
    const [importProgress, setImportProgress] = React.useState<{
        isActive: boolean;
        progress: number;
        phase: string;
        icon: string;
    } | null>(null);
    const [importSuccessStats, setImportSuccessStats] = React.useState<{
        open: number;
        closed: number;
        statement: number;
    } | null>(null);

    // BES State
    const [showBESEditor, setShowBESEditor] = React.useState(false);
    const [besMetadata, setBesMetadata] = React.useState<BESMetadata | null>(null);

    // Extract BES asset from assets (if exists)
    const besAsset = React.useMemo(() => assets.find(a => a.type === 'BES' && a.symbol === 'BES'), [assets]);
    // Display all assets including BES
    const displayAssets = React.useMemo(() => assets, [assets]);

    // Load BES metadata from asset
    React.useEffect(() => {
        if (besAsset?.metadata) {
            setBesMetadata(besAsset.metadata as BESMetadata);
        }
    }, [besAsset]);

    // Extract unique portfolios and platforms from assets
    const availablePortfolios = React.useMemo(() => {
        const portfolioSet = new Set<string>();
        assets.forEach(a => {
            if (a.customGroup) portfolioSet.add(a.customGroup);
        });
        return Array.from(portfolioSet).map(name => ({ id: name, name }));
    }, [assets]);

    const availablePlatforms = React.useMemo(() => {
        const platforms = new Set<string>();
        assets.forEach(a => {
            if (a.platform) platforms.add(a.platform);
        });
        return Array.from(platforms);
    }, [assets]);

    // Handle BES save
    const handleBESSave = async (data: BESMetadata, portfolio: string, platform: string) => {
        const result = await saveBESData(data, portfolio, platform);
        if (result.success) {
            setBesMetadata(data);
            setShowBESEditor(false); // Close editor after save
            onCountChange(); // Refresh portfolio
        } else {
            throw new Error(result.error);
        }
    };

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

    /* 
    // LOADING STATE REMOVED - Rely on SSR 'initialAssets' for immediate render
    React.useEffect(() => {
        // Redundant fetch removed. 
        // We already have data from server (initialAssets).
    }, []); 
    */

    // Recalculate total value dynamically based on current prices and rates
    const totalPortfolioValue = assets.reduce((sum, asset) => {
        // Special handling for BES - value comes from metadata
        if (asset.type === 'BES' && asset.metadata) {
            const besMeta = asset.metadata as BESMetadata;
            const totalKP = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.katkiPayi || 0), 0) || 0;
            const totalDK = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.devletKatkisi || 0), 0) || 0;
            const besTotal = totalKP + totalDK;
            const tryToEur = exchangeRates?.['TRY'] || 1;
            return sum + (besTotal / tryToEur);
        }

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

    /* Loading block removed */

    const handleBatchSaveOrToggle = () => {
        if (activePositionTab === 'closed') {
            setIsClosedBatchEditMode(!isClosedBatchEditMode);
            return;
        }

        // Open Positions Logic
        if (isBatchEditMode) {
            // Apply edits to assets
            const updatedAssets = assets.map(asset => {
                if (editedAssets[asset.id]) {
                    const edits = editedAssets[asset.id];
                    return {
                        ...asset,
                        ...edits,
                        buyPrice: edits.averageBuyPrice !== undefined ? Number(edits.averageBuyPrice) : asset.buyPrice,
                        averageBuyPrice: edits.averageBuyPrice !== undefined ? Number(edits.averageBuyPrice) : asset.averageBuyPrice,
                        avgPrice: edits.averageBuyPrice !== undefined ? Number(edits.averageBuyPrice) : asset.avgPrice,
                        customGroup: edits.portfolio !== undefined ? edits.portfolio : asset.customGroup,
                        portfolio: edits.portfolio !== undefined ? edits.portfolio : asset.portfolio,
                        quantity: edits.quantity !== undefined ? Number(edits.quantity) : asset.quantity,
                        name: edits.name !== undefined ? edits.name : asset.name,
                        platform: edits.platform !== undefined ? edits.platform : asset.platform
                    };
                }
                return asset;
            });

            setAssets(updatedAssets);

            const saveChanges = async () => {
                const { updateAsset } = await import('@/lib/actions');
                const promises = Object.entries(editedAssets).map(([id, data]) => {
                    return updateAsset(id, {
                        quantity: data.quantity,
                        buyPrice: data.averageBuyPrice,
                        name: data.name,
                        platform: data.platform,
                        customGroup: data.portfolio
                    });
                });
                await Promise.all(promises);
                onCountChange();
            };
            saveChanges().catch(err => console.error("Batch save failed:", err));

            setSuccessMessage('Changes Saved');
            setShowSuccessNotification(true);
            setTimeout(() => {
                setShowSuccessNotification(false);
            }, 2000);

            setEditedAssets({});
            setIsBatchEditMode(false);
        } else {
            // Enter edit mode
            const initialEdits: Record<string, any> = {};
            assets.forEach(asset => {
                initialEdits[asset.id] = {
                    portfolio: asset.customGroup || 'Main',
                    platform: asset.platform || 'Interactive Brokers',
                    name: asset.name || asset.symbol,
                    quantity: asset.quantity,
                    averageBuyPrice: asset.buyPrice || asset.averageBuyPrice || asset.avgPrice || 0
                };
            });
            setEditedAssets(initialEdits);
            setIsBatchEditMode(true);
        }
    };

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
                gap: '16px',
                height: '60px'
            }}>
                {/* Positions Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setActivePositionTab('open')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: activePositionTab === 'open' ? 'var(--bg-secondary)' : 'transparent',
                            color: activePositionTab === 'open' ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '13px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Open Positions
                    </button>
                    <button
                        onClick={() => setActivePositionTab('closed')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: activePositionTab === 'closed' ? 'var(--bg-secondary)' : 'transparent',
                            color: activePositionTab === 'closed' ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '13px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Closed Positions
                    </button>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '4px',
                        paddingRight: activePositionTab === 'transactions' ? '8px' : '4px',
                        background: activePositionTab === 'transactions' ? 'var(--bg-secondary)' : 'transparent',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                    }}>
                        <button
                            onClick={() => setActivePositionTab('transactions')}
                            style={{
                                padding: '6px 12px',
                                background: 'transparent',
                                color: activePositionTab === 'transactions' ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer',
                            }}
                        >
                            Account Statement
                        </button>

                        {activePositionTab === 'transactions' && (
                            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', padding: '2px', borderRadius: '6px' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setTransViewMode('group'); }}
                                    style={{
                                        padding: '4px', borderRadius: '4px',
                                        background: transViewMode === 'group' ? 'var(--bg-secondary)' : 'transparent',
                                        color: transViewMode === 'group' ? 'var(--text-primary)' : 'var(--text-muted)',
                                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                    }}
                                    title="Group View"
                                >
                                    <LayoutGrid size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setTransViewMode('date'); }}
                                    style={{
                                        padding: '4px', borderRadius: '4px',
                                        background: transViewMode === 'date' ? 'var(--bg-secondary)' : 'transparent',
                                        color: transViewMode === 'date' ? 'var(--text-primary)' : 'var(--text-muted)',
                                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                    }}
                                    title="Date View"
                                >
                                    <List size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setActivePositionTab('import')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: activePositionTab === 'import' ? 'var(--bg-secondary)' : 'transparent',
                            color: activePositionTab === 'import' ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '13px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Import CSV
                    </button>
                    {/* Add BES Button */}
                    {isOwner && (
                        <button
                            onClick={() => setShowBESEditor(true)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: showBESEditor ? 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' : 'transparent',
                                color: showBESEditor ? 'white' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '13px',
                                border: showBESEditor ? 'none' : '1px dashed var(--border)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {besMetadata ? 'BES' : '+ BES'}
                        </button>
                    )}
                </div>

                {/* Spacer */}
                <div style={{ flex: 1 }}></div>

                {/* Total Wealth */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Total Wealth:
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: 'var(--accent)' }}>€</span>{formatNumber(totalPortfolioValue, 0)}
                    </span>
                </div>

                {/* Adjust/Batch Edit Button */}
                <button
                    onClick={handleBatchSaveOrToggle}
                    style={{
                        width: '32px', height: '32px',
                        borderRadius: '8px',
                        background: (isBatchEditMode || isClosedBatchEditMode) ? 'var(--accent)' : 'transparent',
                        border: (isBatchEditMode || isClosedBatchEditMode) ? '1px solid var(--accent)' : '1px solid var(--border)',
                        color: (isBatchEditMode || isClosedBatchEditMode) ? '#fff' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginLeft: '8px'
                    }}
                    title={(isBatchEditMode || isClosedBatchEditMode) ? "Save/Finish" : "Adjust / Batch Edit"}
                >
                    {(isBatchEditMode || isClosedBatchEditMode) ? <Save size={16} /> : <SlidersHorizontal size={16} />}
                </button>
            </div>

            {activePositionTab === 'open' && assets.length === 0 && !besMetadata && !showBESEditor && (
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    marginTop: '20px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    textAlign: 'center'
                }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--accent)' }}>
                        <Search size={28} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>No Open Positions</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '350px' }}>
                        Start by adding assets, importing CSV, or adding your BES pension portfolio.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button onClick={() => { const input = document.getElementById('global-search-input'); if (input) { input.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={16} /> Search Assets
                        </button>
                        <button onClick={() => setActivePositionTab('import')} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Upload size={16} /> Import CSV
                        </button>
                    </div>
                </div>
            )}

            {activePositionTab === 'open' && (assets.length > 0 || besMetadata || showBESEditor) && (
                <>
                    {/* Success Notification Toast */}
                    {showSuccessNotification && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            marginBottom: '16px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            animation: 'fadeIn 0.3s ease-out'
                        }}>
                            <Save size={16} />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* BES Inline Editor (when adding/editing) */}
                    {showBESEditor && (
                        <div style={{ marginBottom: '16px' }}>
                            <BESInlineEditor
                                initialData={besMetadata}
                                onSave={handleBESSave}
                                onCancel={() => setShowBESEditor(false)}
                                availablePortfolios={availablePortfolios}
                                availablePlatforms={availablePlatforms}
                            />
                        </div>
                    )}

                    {/* Assets Table (includes BES) */}
                    {(assets.length > 0 || besMetadata) && !showBESEditor && (
                        <div style={{
                            background: 'var(--surface)',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            boxShadow: 'var(--shadow-md)'
                        }}>
                            <DndContext
                                id={dndId}
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={() => setExpandedAssets(new Set())}
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
                                            <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', minWidth: '100px' }}>
                                                <div>Value</div>
                                                <div style={{ opacity: 0.5, fontWeight: 500 }}>Cost</div>
                                            </th>
                                            {/* Total Value Global */}
                                            <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', minWidth: '110px', whiteSpace: 'nowrap' }}>
                                                <div>Value ({getCurrencySymbol(globalCurrency)})</div>
                                                <div style={{ opacity: 0.5, fontWeight: 500 }}>Cost ({getCurrencySymbol(globalCurrency)})</div>
                                            </th>
                                            {/* Weight */}
                                            <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                                Weight
                                            </th>
                                            {/* P&L */}
                                            <th style={{ padding: '0 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', minWidth: '100px', whiteSpace: 'nowrap' }}>
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
                                            {/* Expand Toggle */}
                                            <th style={{ width: '30px', borderBottom: '1px solid var(--border)' }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <SortableContext
                                            items={displayAssets.map(a => a.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {displayAssets.map((asset, i) => {
                                                const isLast = i === displayAssets.length - 1;

                                                // Calculations per row for consistent display
                                                const calculateValues = () => {
                                                    const price = asset.currentPrice || asset.price || asset.previousClose || 0;
                                                    let cost = asset.buyPrice || asset.averageBuyPrice || asset.avgPrice || 0;

                                                    // OVERRIDE: Use transaction history average cost if available
                                                    // This ensures the main row matches the transaction grid logic
                                                    if (asset.transactions && asset.transactions.length > 0) {
                                                        const sorted = [...asset.transactions].sort((a: any, b: any) => new Date(a.date).getTime() - b.date.getTime());
                                                        let rQty = 0;
                                                        let tCost = 0;
                                                        for (const tx of sorted) {
                                                            const q = Number(tx.quantity);
                                                            const p = Number(tx.price);
                                                            if (tx.type === 'BUY') {
                                                                rQty += q;
                                                                tCost += (q * p);
                                                            } else if (tx.type === 'SELL') {
                                                                const ratio = rQty > 0 ? q / rQty : 0;
                                                                tCost = tCost * (1 - ratio);
                                                                rQty -= q;
                                                            }
                                                        }
                                                        // If we have a remaining position, use the calculated WAC
                                                        if (rQty > 0.000001) {
                                                            cost = tCost / rQty;
                                                        }
                                                    }
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

                                                // BES-specific values
                                                const isBES = asset.type === 'BES';
                                                const besMeta = isBES ? asset.metadata as BESMetadata : null;
                                                const besKP = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.katkiPayi || 0), 0) || 0;
                                                const besDK = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.devletKatkisi || 0), 0) || 0;
                                                const besTotal = besKP + besDK;
                                                const tryToEur = exchangeRates?.['TRY'] || 1;
                                                const besTotalEur = besTotal / tryToEur;
                                                const besGlobalRate = (globalCurrency !== 'EUR' && exchangeRates?.[globalCurrency]) ? exchangeRates[globalCurrency] : 1;
                                                const besTotalGlobal = besTotalEur * besGlobalRate;
                                                const besWeight = totalPortfolioValue > 0 ? (besTotalEur / totalPortfolioValue) * 100 : 0;

                                                return (
                                                    <React.Fragment key={asset.id}>
                                                        <SortableRow
                                                            key={asset.id}
                                                            id={asset.id}
                                                            isBatchEditMode={isBatchEditMode}
                                                        >
                                                            {/* Portfolio Pill */}
                                                            <td style={{ padding: sizing.rowPadding, textAlign: 'center', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                {isBatchEditMode ? (
                                                                    <input
                                                                        type="text"
                                                                        value={getCurrentValue(asset.id, 'portfolio', asset.customGroup || 'Main')}
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
                                                                    (() => {
                                                                        const name = (asset.customGroup || 'Main').toUpperCase();
                                                                        const style = getPortfolioStyle(name);
                                                                        return (
                                                                            <div style={{
                                                                                display: 'inline-flex', padding: sizing.pillPadding,
                                                                                borderRadius: '6px',
                                                                                background: style.bg,
                                                                                border: `1px solid ${style.border}`,
                                                                                fontSize: sizing.pillFontSize, fontWeight: 700,
                                                                                color: style.text,
                                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                                                                whiteSpace: 'nowrap',
                                                                                textTransform: 'uppercase',
                                                                                fontFamily: 'var(--font-mono)'
                                                                            }}>
                                                                                {name}
                                                                            </div>
                                                                        );
                                                                    })()
                                                                )}
                                                            </td>
                                                            {/* Platform Pill */}
                                                            <td style={{ padding: sizing.rowPadding, textAlign: 'center', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
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
                                                            <td style={{ padding: `${sizing.rowPadding} ${sizing.rowPaddingLR}`, verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                    {isBES ? (
                                                                        <div style={{
                                                                            width: `${sizing.logoSize}px`, height: `${sizing.logoSize}px`,
                                                                            borderRadius: '12px',
                                                                            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            color: 'white', fontWeight: 700, fontSize: '10px',
                                                                            flexShrink: 0, cursor: 'pointer',
                                                                            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                                                                        }}
                                                                            onClick={() => toggleExpand(asset.id)}
                                                                        >
                                                                            BES
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{
                                                                            width: `${sizing.logoSize}px`, height: `${sizing.logoSize}px`,
                                                                            borderRadius: '50%', overflow: 'hidden',
                                                                            background: '#fff',
                                                                            border: '1px solid var(--border)',
                                                                            flexShrink: 0,
                                                                            padding: '2px',
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                                                                            cursor: 'default'
                                                                        }}>
                                                                            <img
                                                                                src={getLogoUrl(asset.symbol, asset.type || 'STOCK', asset.exchange, asset.country) || undefined}
                                                                                alt={asset.symbol}
                                                                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                                                                                onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${asset.symbol}&background=random` }}
                                                                            />
                                                                        </div>
                                                                    )}
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
                                                                            <div>
                                                                                <div style={{ fontSize: sizing.assetNameSize, fontWeight: 700, color: isBES ? 'var(--accent)' : 'var(--text-primary)' }}>{isBES ? 'BES' : (asset.name || asset.symbol)}</div>
                                                                                {!isBES && <div style={{ fontSize: sizing.symbolSize, color: 'var(--text-muted)', fontWeight: 500 }}>{asset.symbol}</div>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {/* Quantity */}
                                                            <td style={{ padding: `${sizing.rowPaddingLR} 12px`, textAlign: 'right', verticalAlign: 'top', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                {isBES ? (
                                                                    <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-muted)' }}>-</div>
                                                                ) : isBatchEditMode ? (
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
                                                                        {formatNumber(asset.quantity, asset.quantity % 1 === 0 ? 0 : 2)}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            {/* Price / Cost */}
                                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                {isBES ? (
                                                                    <>
                                                                        <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                                            ₺{formatNumber(besTotal, 0)}
                                                                        </div>
                                                                        <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px' }}>-</div>
                                                                    </>
                                                                ) : (
                                                                    <>
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
                                                                    </>
                                                                )}
                                                            </td>
                                                            {/* Value / Cost (Local) */}
                                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                {isBES ? (
                                                                    <>
                                                                        <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-muted)' }}>-</div>
                                                                        <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px' }}>-</div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                                            {currency !== globalCurrency && value > 0 ? `${getCurrencySymbol(currency)}${formatNumber(value, 0)}` : '-'}
                                                                        </div>
                                                                        <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                                                            {currency !== globalCurrency && costValue > 0 ? `${getCurrencySymbol(currency)}${formatNumber(costValue, 0)}` : '-'}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </td>
                                                            {/* Value / Cost (Global) */}
                                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                {isBES ? (
                                                                    <>
                                                                        <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                                            {getCurrencySymbol(globalCurrency)}{formatNumber(besTotalGlobal, 0)}
                                                                        </div>
                                                                        <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>-</div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                                                            {valueGlobal > 0 ? `${getCurrencySymbol(globalCurrency)}${formatNumber(valueGlobal, 0)}` : '-'}
                                                                        </div>
                                                                        <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                                                            {costGlobal > 0 ? `${getCurrencySymbol(globalCurrency)}${formatNumber(costGlobal, 0)}` : '-'}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </td>
                                                            {/* Weight */}
                                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'top', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                                                                    {isBES ? `${Math.round(besWeight)}%` : `${Math.round(weight)}%`}
                                                                </div>
                                                            </td>
                                                            {/* P&L */}
                                                            <td style={{ padding: sizing.rowPaddingLR, textAlign: 'right', verticalAlign: 'middle', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                {isBES ? (
                                                                    <>
                                                                        <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: 'var(--text-muted)' }}>-</div>
                                                                        <div style={{ fontSize: sizing.smallNumberSize, color: 'var(--text-muted)', marginTop: '2px' }}>-</div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div style={{ fontSize: sizing.numberSize, fontWeight: 700, color: (asset.plPercentage || 0) >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                                                                            {(asset.plPercentage || 0) >= 0 ? '+' : ''}{Math.round(asset.plPercentage || 0)}%
                                                                        </div>
                                                                        <div style={{ fontSize: sizing.smallNumberSize, color: plAmount >= 0 ? '#34d399' : '#f87171', marginTop: '2px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                                                            {plAmount >= 0 ? '+' : ''}{getCurrencySymbol(globalCurrency)}{formatNumber(plAmount, 0)}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </td>
                                                            {/* Action Buttons (Edit for BES + Delete) */}
                                                            <td style={{
                                                                padding: isBatchEditMode ? sizing.rowPadding : 0,
                                                                width: isBatchEditMode ? (isBES ? '80px' : '60px') : '0px',
                                                                maxWidth: isBatchEditMode ? (isBES ? '80px' : '60px') : '0px',
                                                                opacity: isBatchEditMode ? 1 : 0,
                                                                textAlign: 'center',
                                                                verticalAlign: 'middle',
                                                                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                                                                transition: 'all 0.3s ease',
                                                                overflow: 'hidden',
                                                                visibility: isBatchEditMode ? 'visible' : 'hidden'
                                                            }}>
                                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                                    {/* Edit Button for BES */}
                                                                    {isBES && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setShowBESEditor(true);
                                                                            }}
                                                                            style={{
                                                                                background: 'var(--bg-secondary)',
                                                                                border: '1px solid var(--border)',
                                                                                borderRadius: '8px',
                                                                                width: '32px', height: '32px',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                cursor: 'pointer',
                                                                                color: 'var(--accent)',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.background = 'var(--accent-muted)';
                                                                                e.currentTarget.style.borderColor = 'var(--accent)';
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.background = 'var(--bg-secondary)';
                                                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                                            }}
                                                                            title="Edit BES"
                                                                        >
                                                                            <Pencil size={16} />
                                                                        </button>
                                                                    )}
                                                                    {/* Delete Button */}
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
                                                                </div>
                                                            </td>
                                                            <td
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleExpand(asset.id);
                                                                }}
                                                                style={{
                                                                    padding: 0,
                                                                    width: '30px',
                                                                    textAlign: 'center',
                                                                    verticalAlign: 'middle',
                                                                    borderBottom: isLast && !expandedAssets.has(asset.id) ? 'none' : '1px solid var(--border)',
                                                                    cursor: 'pointer',
                                                                    color: 'var(--text-secondary)'
                                                                }}
                                                            >
                                                                {expandedAssets.has(asset.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </td>
                                                        </SortableRow>

                                                        {
                                                            expandedAssets.has(asset.id) && (
                                                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                                                    <td colSpan={100} style={{ padding: '0 0.8rem 0.8rem 0.8rem', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                                                                        <div style={{ marginTop: '0.8rem' }}>
                                                                            {isBES && besMeta ? (
                                                                                <BESExpandedDetails besMeta={besMeta} besKP={besKP} besDK={besDK} />
                                                                            ) : (
                                                                                <TransactionHistory
                                                                                    symbol={asset.symbol}
                                                                                    transactions={asset.transactions || []}
                                                                                    onUpdate={onCountChange}
                                                                                    isBatchEditMode={isBatchEditMode}
                                                                                    isOwner={isOwner}
                                                                                    defaultCurrency={asset.currency}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        }
                                                    </React.Fragment>
                                                );
                                            })}
                                        </SortableContext>
                                    </tbody>
                                </table>
                            </DndContext>
                        </div >
                    )}
                </>
            )
            }
            {
                activePositionTab === 'closed' && (
                    <div style={{ marginTop: '0', width: '100%' }}>
                        <ClosedPositionsFullScreen
                            onCountChange={onCountChange}
                            hideHeader={true}
                            isBatchEditMode={isClosedBatchEditMode}
                            isOwner={isOwner}
                            sizing={sizing}
                        />
                    </div>
                )
            }
            {
                activePositionTab === 'transactions' && (
                    <div style={{ marginTop: '0', width: '100%' }}>
                        <TransactionsFullScreen viewMode={transViewMode} assets={assets} />
                    </div>
                )
            }
            {
                activePositionTab === 'import' && (
                    <div style={{ marginTop: '0', width: '100%' }}>
                        <ImportCSVInline

                            onSuccess={async (stats) => {
                                onCountChange();

                                // Poll for data update if we expect open positions
                                if (stats && stats.open > 0) {
                                    const { getOpenPositions } = await import('@/lib/actions');
                                    let attempts = 0;
                                    const maxAttempts = 20; // 10 seconds max (20 * 500ms)

                                    const checkData = async () => {
                                        try {
                                            const positions = await getOpenPositions();
                                            // If we found positions, or we ran out of attempts, switch tab
                                            if ((positions && positions.length > 0) || attempts >= maxAttempts) {
                                                setActivePositionTab('open');
                                            } else {
                                                attempts++;
                                                setTimeout(checkData, 500);
                                            }
                                        } catch (e) {
                                            console.error("Polling error:", e);
                                            setActivePositionTab('open'); // Fallback
                                        }
                                    };

                                    checkData();
                                } else {
                                    // No open positions to wait for, switch immediately
                                    setActivePositionTab('open');
                                }
                            }}
                            onCancel={() => setActivePositionTab('open')}
                        />
                    </div>
                )
            }

        </div >
    );
}

// 2. Allocations - Single Card with Side Options
function AllocationsFullScreen({ assets, exchangeRates }: { assets: any[], exchangeRates?: Record<string, number> }) {
    const [selectedType, setSelectedType] = React.useState('Type');
    const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);
    const { showAmounts } = usePrivacy();

    // Reset expanded category when view changes
    React.useEffect(() => {
        setExpandedCategory(null);
    }, [selectedType]);

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

    // Helper to get assets for a specific category (for drill-down)
    const getAssetsForCategory = (categoryName: string) => {
        if (categoryName === 'Other') {
            const topNames = rawChartData.slice(0, 5).map(d => d.name);
            return processedAssets.filter(asset => {
                let assetCategory = 'Unknown';
                switch (selectedType) {
                    case "Portfolio": assetCategory = asset.customGroup || asset.ownerCode || 'Main'; break;
                    case "Type": assetCategory = (asset.symbol === 'EUR' || asset.type === 'Cash') ? 'Cash' : (asset.type || 'Uncategorized'); break;
                    case "Exchange": assetCategory = asset.exchange || 'Unknown'; break;
                    case "Currency": assetCategory = asset.currency || 'Unknown'; break;
                    case "Country": assetCategory = asset.country || 'Unknown'; break;
                    case "Sector": assetCategory = asset.sector || 'Unknown'; break;
                    case "Platform": assetCategory = asset.platform || 'Unknown'; break;
                }
                return !topNames.includes(assetCategory);
            });
        }

        return processedAssets.filter(asset => {
            switch (selectedType) {
                case "Portfolio": return (asset.customGroup || asset.ownerCode || 'Main').toLowerCase() === categoryName.toLowerCase();
                case "Type": {
                    const typeName = (asset.symbol === 'EUR' || asset.type === 'Cash') ? 'Cash' : (asset.type || 'Uncategorized');
                    return typeName === categoryName;
                }
                case "Exchange": return (asset.exchange || 'Unknown') === categoryName;
                case "Currency": return (asset.currency || 'Unknown') === categoryName;
                case "Country": return (asset.country || 'Unknown') === categoryName;
                case "Sector": return (asset.sector || 'Unknown') === categoryName;
                case "Platform": return (asset.platform || 'Unknown') === categoryName;
                default: return false;
            }
        }).sort((a, b) => b.totalValueEUR - a.totalValueEUR);
    };

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {chartData.map((item) => {
                                const pct = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
                                const isHovered = hoveredSlice === item.name;
                                const isExpanded = expandedCategory === item.name;
                                const categoryAssets = isExpanded ? getAssetsForCategory(item.name) : [];

                                return (
                                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column' }}>
                                        {/* Category Header */}
                                        <div
                                            onClick={() => setExpandedCategory(isExpanded ? null : item.name)}
                                            onMouseEnter={() => setHoveredSlice(item.name)}
                                            onMouseLeave={() => setHoveredSlice(null)}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 10px',
                                                cursor: 'pointer',
                                                background: isExpanded ? 'var(--bg-secondary)' : isHovered ? 'var(--bg-secondary)' : 'transparent',
                                                border: isExpanded ? '1px solid var(--accent)' : isHovered ? '1px solid var(--border)' : '1px solid transparent',
                                                borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {/* Left: Chevron + Color + Name */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                                                <ChevronDown
                                                    size={12}
                                                    style={{
                                                        color: 'var(--text-muted)',
                                                        transition: 'transform 0.2s ease',
                                                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                                        flexShrink: 0
                                                    }}
                                                />
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '2px',
                                                    backgroundColor: item.color,
                                                    flexShrink: 0
                                                }}></div>
                                                <span style={{
                                                    fontSize: '12px',
                                                    fontWeight: isExpanded ? 800 : 700,
                                                    color: isExpanded ? 'var(--accent)' : 'var(--text-primary)',
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
                                                    color: isExpanded ? 'var(--accent)' : 'var(--accent)',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    minWidth: '40px',
                                                    textAlign: 'right'
                                                }}>{Math.round(pct)}%</span>
                                            </div>
                                        </div>

                                        {/* Expanded Assets List */}
                                        {isExpanded && (
                                            <div style={{
                                                background: 'var(--surface)',
                                                border: '1px solid var(--accent)',
                                                borderTop: 'none',
                                                borderRadius: '0 0 8px 8px',
                                                padding: '8px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px'
                                            }}>
                                                {categoryAssets.length === 0 ? (
                                                    <div style={{
                                                        padding: '8px',
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                        textAlign: 'center'
                                                    }}>
                                                        No assets found
                                                    </div>
                                                ) : (
                                                    categoryAssets.slice(0, 8).map((asset, assetIndex) => {
                                                        const assetPct = totalValueEUR > 0 ? (asset.totalValueEUR / totalValueEUR) * 100 : 0;
                                                        return (
                                                            <div
                                                                key={asset.id || assetIndex}
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '6px 8px',
                                                                    borderRadius: '6px',
                                                                    background: 'var(--bg-primary)',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-primary)';
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                                                    <div style={{
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        borderRadius: '6px',
                                                                        background: `${item.color}20`,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        <span style={{
                                                                            fontSize: '9px',
                                                                            fontWeight: 800,
                                                                            color: item.color
                                                                        }}>
                                                                            {(asset.symbol || asset.name || '?').substring(0, 3)}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                                        <span style={{
                                                                            fontSize: '11px',
                                                                            fontWeight: 700,
                                                                            color: 'var(--text-primary)',
                                                                            whiteSpace: 'nowrap',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis'
                                                                        }}>
                                                                            {asset.symbol || asset.name}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                                    <span style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: 700,
                                                                        color: 'var(--text-primary)',
                                                                        fontVariantNumeric: 'tabular-nums'
                                                                    }}>
                                                                        {showAmounts ? `€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(asset.totalValueEUR)}` : '***'}
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: '10px',
                                                                        color: 'var(--text-muted)',
                                                                        fontVariantNumeric: 'tabular-nums'
                                                                    }}>
                                                                        {assetPct.toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                                {categoryAssets.length > 8 && (
                                                    <div style={{
                                                        padding: '4px',
                                                        fontSize: '10px',
                                                        color: 'var(--text-muted)',
                                                        textAlign: 'center'
                                                    }}>
                                                        +{categoryAssets.length - 8} more
                                                    </div>
                                                )}
                                            </div>
                                        )}
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

// 3. Performance - New Clean Component
function PerformanceFullScreen({ username, totalValueEUR }: { username: string, totalValueEUR: number }) {
    const allBenchmarkIds = React.useMemo(() => BENCHMARK_ASSETS.map(b => b.id), []);
    const [selectedBenchmarks, setSelectedBenchmarks] = React.useState<string[]>(allBenchmarkIds);
    const [isPortfolioVisible, setIsPortfolioVisible] = React.useState(true);

    const handleToggleBenchmark = (id: string) => {
        setSelectedBenchmarks(prev =>
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 80px)' }}>
            <PerformanceChart
                username={username}
                totalValueEUR={totalValueEUR}
                selectedBenchmarks={selectedBenchmarks}
                isPortfolioVisible={isPortfolioVisible}
                onToggleBenchmark={handleToggleBenchmark}
                onTogglePortfolio={() => setIsPortfolioVisible(!isPortfolioVisible)}
                defaultRange="1Y"
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

// 5. Vision - New Clean Component
function VisionFullScreen({ username, totalValueEUR }: { username: string, totalValueEUR: number }) {
    return (
        <div style={{ padding: '24px 40px 40px 40px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 80px)' }}>
            <VisionChart
                username={username}
                totalValueEUR={totalValueEUR}
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

    // Deduplicate assets by symbol
    const uniqueAssets = React.useMemo(() => {
        const seen = new Set();
        return assets.filter(asset => {
            const key = asset.symbol;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [assets]);

    const sortedAssets = [...uniqueAssets]
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
                            <tr key={asset.id} style={{ borderBottom: i < sortedAssets.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
function ClosedPositionsFullScreen({ onCountChange, hideHeader = false, isBatchEditMode: externalBatchEditMode, isOwner = true, sizing }: { onCountChange: () => void, hideHeader?: boolean, isBatchEditMode?: boolean, isOwner?: boolean, sizing: any }) {
    const [positions, setPositions] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedPositions, setExpandedPositions] = React.useState<Set<string>>(new Set());
    const [internalBatchEditMode, setInternalBatchEditMode] = React.useState(false);

    // Use external prop if provided, otherwise internal state
    const isBatchEditMode = externalBatchEditMode !== undefined ? externalBatchEditMode : internalBatchEditMode;

    React.useEffect(() => {
        setLoading(true);
        import('@/app/actions/history').then(({ getClosedPositions }) => {
            getClosedPositions()
                .then(data => {
                    // No additional filter needed - getClosedPositions() already returns only closed positions
                    // (positions where currentQty <= 0.000001 from the asset table)
                    setPositions(data);
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
        // Priority: Trust explicit valid types from DB
        if (pos.type === 'CRYPTO' || pos.type === 'FUND') return pos.type;

        const ex = pos.exchange?.toUpperCase() || '';
        const pl = pos.platform?.toUpperCase() || '';

        // Robust Crypto Detection
        if (pl === 'KRAKEN' || ex === 'KRAKEN' || ex === 'CCC' || ex === 'BINANCE' || ex === 'COINBASE') return 'CRYPTO';

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
        <div style={{ padding: hideHeader ? '0' : '24px 40px 40px 40px', maxWidth: '1200px', margin: hideHeader ? '0' : '0 auto', width: '100%' }}>
            {/* Premium Header Card */}
            {!hideHeader && (
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
                        <XCircle size={18} strokeWidth={2} />
                    </div>
                    <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Closed Positions ({positions.length})
                    </h1>
                    <div style={{ flex: 1 }} />


                    {/* Divider */}
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>

                    {/* Batch Edit Button */}
                    <button
                        onClick={() => {
                            if (externalBatchEditMode === undefined) {
                                setInternalBatchEditMode(!isBatchEditMode);
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
                            height: '32px',
                            fontSize: '12px',
                            fontWeight: 600
                        }}
                    >
                        <ListChecks size={16} />
                        {isBatchEditMode ? 'Done' : 'Select'}
                    </button>
                </div>
            )}

            {
                positions.length > 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        background: 'var(--surface)',
                        borderRadius: '16px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        {/* Table Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `80px 90px minmax(180px, 3fr) 90px 80px 70px 100px 120px 40px ${isBatchEditMode ? '40px' : '0px'}`,
                            gap: '0.5rem',
                            alignItems: 'center',
                            padding: '0.75rem 1rem',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            background: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--border)'
                        }}>
                            <div style={{ textAlign: 'center' }}><Wallet size={14} /></div>
                            <div style={{ textAlign: 'center' }}><Monitor size={14} /></div>
                            <div>Asset</div>
                            <div style={{ textAlign: 'right' }}>Price</div>
                            <div style={{ textAlign: 'right' }}>TX</div>
                            <div style={{ textAlign: 'right' }}>Held</div>
                            <div style={{ textAlign: 'right' }}>P&L %</div>
                            <div style={{ textAlign: 'right' }}>P&L Amt</div>
                            <div></div>
                            <div style={{ transition: 'all 0.3s ease', opacity: isBatchEditMode ? 1 : 0 }}></div>
                        </div>

                        {/* Position Rows */}
                        {positions
                            .sort((a, b) => new Date(b.lastTradeDate).getTime() - new Date(a.lastTradeDate).getTime())
                            .map((pos, index, array) => {
                                const isExpanded = expandedPositions.has(`${pos.symbol}-${pos.customGroup || 'Main'}`);
                                const holdDays = calculateHoldDays(pos.transactions);
                                const returnPercent = calculateReturn(pos);
                                const pnl = pos.realizedPnl;
                                const isProfit = pnl >= 0;
                                const isLast = index === array.length - 1;

                                return (
                                    <div key={`${pos.symbol}-${pos.customGroup || 'Main'}`} style={{
                                        overflow: 'hidden'
                                    }}>
                                        {/* Summary Row */}
                                        <div
                                            onClick={() => toggleExpand(`${pos.symbol}-${pos.customGroup || 'Main'}`)}
                                            onMouseEnter={(e) => {
                                                if (!isExpanded) {
                                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isExpanded) {
                                                    e.currentTarget.style.background = 'transparent';
                                                }
                                            }}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: `80px 90px minmax(180px, 3fr) 90px 80px 70px 100px 120px 40px ${isBatchEditMode ? '40px' : '0px'}`,
                                                gap: '0.5rem',
                                                alignItems: 'center',
                                                padding: '0.6rem 1rem',
                                                cursor: 'pointer',
                                                background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                                                transition: 'background 0.15s ease',
                                                borderBottom: isLast ? 'none' : '1px solid var(--border)'
                                            }}
                                        >
                                            {/* Portfolio */}
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                {(() => {
                                                    const name = (pos.customGroup || 'Main').toUpperCase();
                                                    const style = getPortfolioStyle(name);
                                                    return (
                                                        <div style={{
                                                            display: 'inline-flex',
                                                            padding: sizing.pillPadding,
                                                            borderRadius: '6px',
                                                            background: style.bg,
                                                            border: `1px solid ${style.border}`,
                                                            fontSize: sizing.pillFontSize,
                                                            fontWeight: 700,
                                                            color: style.text,
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                                            whiteSpace: 'nowrap',
                                                            textTransform: 'uppercase',
                                                            fontFamily: 'var(--font-mono)'
                                                        }}>
                                                            {name}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Platform */}
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                {pos.platform ? (
                                                    <div title={pos.platform} style={{
                                                        display: 'inline-flex',
                                                        padding: sizing.pillPadding,
                                                        borderRadius: '6px',
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border)',
                                                        fontSize: sizing.pillFontSize,
                                                        fontWeight: 700,
                                                        color: 'var(--text-secondary)',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                                        maxWidth: '70px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {pos.platform}
                                                    </div>
                                                ) : (
                                                    <Monitor size={sizing.iconSize} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                                                )}
                                            </div>

                                            {/* Asset */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                <img
                                                    src={pos.logoUrl || getLogoUrl(pos.symbol, getAssetType(pos), pos.exchange) || ''}
                                                    alt={pos.symbol}
                                                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pos.symbol}&background=random`;
                                                    }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden' }} title={pos.name || pos.symbol}>
                                                            {pos.name || pos.symbol}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {pos.symbol}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                {pos.currentPrice ? pos.currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
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
                                            <TransactionHistory
                                                symbol={pos.symbol}
                                                transactions={pos.transactions}
                                                onUpdate={onCountChange}
                                                isBatchEditMode={isBatchEditMode}
                                                isOwner={isOwner}
                                                defaultCurrency={pos.currency}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                    </div >
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
function SettingsFullScreen({ preferences, username, userEmail }: { preferences?: any, username: string, userEmail?: string }) {
    // Import context hooks for instant UI updates
    const { theme, setTheme } = useTheme();
    const { currency, setCurrency } = useCurrency();
    const { language, setLanguage } = useLanguage();

    const [localPrefs, setLocalPrefs] = React.useState({
        theme: preferences?.theme || theme || 'light',
        currency: preferences?.currency || currency || 'EUR',
        language: preferences?.language || language || 'ENG',
        priceAlerts: preferences?.priceAlerts !== false,
        goalUpdates: preferences?.goalUpdates !== false,
        marketNews: preferences?.marketNews === true
    });
    const [saving, setSaving] = React.useState(false);
    const [showSuccess, setShowSuccess] = React.useState(false);

    const savePreference = async (key: string, value: any) => {
        setSaving(true);
        try {
            // Update React context FIRST for instant UI change
            if (key === 'theme') {
                setTheme(value as 'light' | 'dark');
            } else if (key === 'currency') {
                setCurrency(value as any);
            } else if (key === 'language') {
                // Map display names to context values
                const langMap: Record<string, 'ENG' | 'TR'> = {
                    'English': 'ENG',
                    'Turkish': 'TR',
                    'German': 'ENG' // Fallback to ENG for now
                };
                setLanguage(langMap[value] || 'ENG');
            }

            // Then persist to database
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
                    <Settings size={18} strokeWidth={2} />
                </div>

                {/* Title */}
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Settings
                </h1>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* User Info - Right Side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-primary)'
                    }}>
                        {username}
                    </span>

                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border)' }}></span>

                    <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(var(--accent-rgb), 0.1)',
                        color: 'var(--accent)',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        border: '1px solid rgba(var(--accent-rgb), 0.2)'
                    }}>
                        Active Account
                    </span>

                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border)' }}></span>

                    <span style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)'
                    }}>
                        {userEmail || 'No email linked'}
                    </span>
                </div>

                {/* Success Notification (Toast style inside header or absolutely positioned) */}
                {showSuccess && (
                    <div style={{
                        position: 'absolute',
                        top: '80px',
                        right: '40px',
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
                        zIndex: 100
                    }}>
                        <Save size={16} />
                        <span>Settings saved</span>
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
                alignItems: 'start'
            }}>
                {/* 1. Display Settings */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Monitor size={16} /> Display
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Theme */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Theme</span>
                            <select
                                value={localPrefs.theme}
                                onChange={(e) => savePreference('theme', e.target.value)}
                                disabled={saving}
                                className="glass-select"
                                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                        </div>

                        {/* Currency */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Currency</span>
                            <select
                                value={localPrefs.currency}
                                onChange={(e) => savePreference('currency', e.target.value)}
                                disabled={saving}
                                className="glass-select"
                                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                                <option value="EUR">EUR (€)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="TRY">TRY (₺)</option>
                            </select>
                        </div>

                        {/* Language */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Language</span>
                            <select
                                value={localPrefs.language}
                                onChange={(e) => savePreference('language', e.target.value)}
                                disabled={saving}
                                className="glass-select"
                                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                                <option value="English">English</option>
                                <option value="Turkish">Türkçe</option>
                                <option value="German">Deutsch</option>
                            </select>
                        </div>


                    </div>
                </div>

                {/* 2. Notifications */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Share2 size={16} /> Notifications
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                            { key: 'priceAlerts', label: 'Price Alerts' },
                            { key: 'goalUpdates', label: 'Goal Updates' },
                            { key: 'marketNews', label: 'Market News' }
                        ].map((setting) => (
                            <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                                        pointerEvents: 'none',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Account & Security (Merged) */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GripVertical size={16} /> Account & Data
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Profile */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Profile</span>
                            <button
                                onClick={() => alert('Profile editing coming soon!')}
                                style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                            >
                                Edit
                            </button>
                        </div>
                        {/* Privacy */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Privacy</span>
                            <button
                                onClick={() => alert('Privacy settings coming soon!')}
                                style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                            >
                                Manage
                            </button>
                        </div>
                        {/* Security */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Security</span>
                            <button
                                onClick={() => alert('Security settings coming soon!')}
                                style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                            >
                                Configure
                            </button>
                        </div>

                        <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }}></div>

                        {/* Export */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Export Data</span>
                            <button
                                onClick={() => alert('Export data functionality coming soon!')}
                                style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                            >
                                Download
                            </button>
                        </div>
                        {/* Delete */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>Delete Account</span>
                            <button
                                onClick={async () => {
                                    if (confirm('Are you sure you want to delete your account? This will permanently remove all your data including assets, transactions, and portfolio history. This action cannot be undone.')) {
                                        const result = await deleteAccount();
                                        if (result.success) {
                                            await signOut({ callbackUrl: '/' });
                                        } else {
                                            alert(result.error || 'Failed to delete account');
                                        }
                                    }
                                }}
                                style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
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
