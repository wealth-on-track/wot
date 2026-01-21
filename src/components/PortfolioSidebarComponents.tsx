"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePrivacy } from "@/context/PrivacyContext";
import { PortfolioChart } from "./PortfolioChart";
import { ASSET_COLORS } from "@/lib/constants";
import { ALLOCATION_VIEWS, TABS } from "@/lib/portfolioConstants";

import { createPortal } from "react-dom";
import { Plus, Trash2, X, Check, Lock, ExternalLink, Save, Eye, EyeOff, Target, SlidersHorizontal, GripVertical, ChevronDown, ChevronRight, ChevronLeft, TrendingUp as TrendingUpIcon, Award, Rocket, Home, Car, Palmtree, GraduationCap, Heart, Plane, Briefcase, ShoppingBag, Gift, Sparkles } from "lucide-react";
import { DndContext, closestCenter, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BENCHMARK_ASSETS } from "@/lib/benchmarkApi";
import { createGoal, updateGoal, deleteGoal } from "@/lib/goalActions";
import { getLogoUrl } from "@/lib/logos";
import { trackLogoRequest } from "@/lib/actions";
import Image from "next/image";
import TopPerformers from './TopPerformers';
export { TopPerformers as TopPerformersCard };
import { MilestoneTrigger } from './share/ShareTriggers';

// --- Shared Constants & Helpers ---
interface Goal {
    id: string;
    name: string;
    type?: string;
    targetAmount: number;
    currentAmount: number;
    currency: string;
    isCompleted: boolean;
    createdAt: Date;
    icon?: string;
}

// Goal Icon Options
const GOAL_ICONS = [
    { id: 'target', label: 'Target', Icon: Target, color: '#6366f1' },
    { id: 'rocket', label: 'Rocket', Icon: Rocket, color: '#ec4899' },
    { id: 'home', label: 'Home', Icon: Home, color: '#10b981' },
    { id: 'car', label: 'Car', Icon: Car, color: '#f59e0b' },
    { id: 'palmtree', label: 'Vacation', Icon: Palmtree, color: '#14b8a6' },
    { id: 'graduation', label: 'Education', Icon: GraduationCap, color: '#8b5cf6' },
    { id: 'heart', label: 'Family', Icon: Heart, color: '#ef4444' },
    { id: 'plane', label: 'Travel', Icon: Plane, color: '#06b6d4' },
    { id: 'briefcase', label: 'Business', Icon: Briefcase, color: '#64748b' },
    { id: 'shopping', label: 'Shopping', Icon: ShoppingBag, color: '#f97316' },
    { id: 'gift', label: 'Gift', Icon: Gift, color: '#a855f7' },
    { id: 'sparkles', label: 'Dream', Icon: Sparkles, color: '#fbbf24' },
];
// const TABS = ["1D", "1W", "1M", "YTD", "1Y", "ALL"];
// const ALLOCATION_VIEWS = ["Type", "Sector", "Platform", "Country"];
const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6', '#f97316'];

const getCountryFromExchange = (exchange?: string): string => {
    if (!exchange) return 'Unknown';
    const ex = exchange.toUpperCase();
    if (ex.includes('BIST') || ex.includes('IST')) return 'Turkey';
    if (ex.includes('NASDAQ') || ex.includes('NYSE')) return 'USA';
    if (ex.includes('LON') || ex.includes('LSE')) return 'UK';
    if (ex.includes('FRA')) return 'Germany';
    if (ex.includes('PAR')) return 'France';
    return 'Other';
};

interface BaseProps {
    totalValueEUR: number;
    isMock?: boolean;
    isBlurred?: boolean;
}

// Helper to format currency values with Turkish style (thousands separator . and decimal ,)
const formatAmount = (val: number) => {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val);
};

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", GBP: "£", ORG: "€" };

const getNextSmartMilestone = (value: number) => {
    if (value <= 0) return 50000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    // Denser multipliers to ensure we can always find a target where progress is >= 75%
    // Steps are small enough that if we skip one (due to >95% proximity), the next one is still within range.
    const multipliers = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5, 6, 7.5, 9, 10];

    for (const m of multipliers) {
        const threshold = m * magnitude;
        if (threshold > value) {
            // Proximity check: if we're very close (95%), jump to next
            if (value / threshold > 0.95) continue;
            return threshold;
        }
    }
    return 10 * magnitude;
};

// --- Unified Component: Total Value + Returns ---
interface SidebarComponentProps extends BaseProps {
    exchangeRates?: Record<string, number>;
}

export function UnifiedPortfolioSummary({ totalValueEUR, isMock = false, isBlurred = false, exchangeRates }: SidebarComponentProps) {
    const [activeTab, setActiveTab] = useState("1D");
    const { currency } = useCurrency();
    const { t } = useLanguage();

    const currencySymbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", GBP: "£" };

    const convert = (amount: number) => {
        if (currency === 'EUR') return amount;
        const rate = exchangeRates?.[currency] || (currency === 'USD' ? 1.05 : currency === 'TRY' ? 38.5 : 1);
        return amount * rate;
    };

    const sym = currencySymbols[currency] || "€";
    const displayBalance = convert(totalValueEUR);

    // Derived Stats
    const totalReturnAmtEUR = isMock ? 1245.50 : (totalValueEUR * 0.12);
    const totalReturnPct = isMock ? 15.4 : 12.0;

    const factor = activeTab === "1D" ? 0.05 : activeTab === "1W" ? 0.3 : activeTab === "1M" ? 0.5 : activeTab === "YTD" ? 0.7 : activeTab === "1Y" ? 0.9 : 1;
    const periodReturnAmtEUR = totalReturnAmtEUR * factor;
    const periodReturnPct = totalReturnPct * factor;
    const displayPeriodReturn = convert(periodReturnAmtEUR);
    const isPositive = periodReturnAmtEUR >= 0;

    return (
        <div className="neo-card" style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            position: 'relative'
        }}>
            {/* Top Section: Title and Balance */}
            <div>
                <p style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.5rem'
                }}>
                    {t('total_wealth')}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <h2 style={{
                        fontSize: '2rem',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        filter: isBlurred ? 'blur(12px)' : 'none',
                        lineHeight: 1,
                        letterSpacing: '-0.06em',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: "'Inter Tight', var(--font-sans)"
                    }}>
                        {sym}{new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(displayBalance)}
                    </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                    <div style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        backgroundColor: isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isPositive ? '#22C55E' : '#EF4444',
                        border: `1px solid ${isPositive ? '#22C55E' : '#EF4444'}20`,
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        {isPositive ? '+' : ''}{periodReturnPct.toFixed(2)}%
                    </div>
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        color: isPositive ? '#22C55E' : '#EF4444',
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        {isPositive ? '+' : ''}{sym}{new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(displayPeriodReturn)}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: '6px', fontSize: '0.75rem' }}>({activeTab})</span>
                    </span>
                </div>
            </div>

            {/* Tabs for Period Toggle */}
            <div style={{
                display: 'flex',
                background: 'var(--bg-secondary)',
                padding: '0.3rem',
                borderRadius: 'var(--radius-md)',
                width: '100%',
                border: '1px solid var(--border)'
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1,
                            background: activeTab === tab ? 'var(--surface)' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                            padding: '0.45rem 0',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>
    );
}


// --- Component 3: AllocationCard ---
export interface AllocationCardProps {
    assets: any[];
    totalValueEUR: number;
    exchangeRates?: Record<string, number>;
    isBlurred?: boolean;
    variant?: 'default' | 'mobile';
    onFilterSelect?: (view: string, value: string) => void;
    activeFilters?: Record<string, string | null>;
    onShare?: (data: any) => void;
    selectedView?: string;
    isFullScreen?: boolean;
}

export interface GoalsCardProps {
    goals: Goal[];
    isOwner: boolean;
    exchangeRates?: Record<string, number>;
    totalValueEUR: number;
    onShare?: (data: any) => void;
}

// All available allocation views
const ALL_ALLOCATION_VIEWS = [
    { id: 'Portfolio', label: 'Portfolio' },
    { id: 'Type', label: 'Type' },
    { id: 'Exchange', label: 'Exchange' },
    { id: 'Currency', label: 'Currency' },
    { id: 'Country', label: 'Country' },
    { id: 'Sector', label: 'Sector' },
    { id: 'Platform', label: 'Platform' }
];

export function AllocationCard({ assets, totalValueEUR, isBlurred = false, exchangeRates, onFilterSelect, activeFilters, variant = 'default', selectedView, isFullScreen = false }: AllocationCardProps) {
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
    const [allocationView, setAllocationView] = useState(selectedView || "Portfolio");

    useEffect(() => {
        if (selectedView) {
            setAllocationView(selectedView);
        }
    }, [selectedView]);

    const [viewOrder, setViewOrder] = useState(['Portfolio', 'Type', 'Exchange', 'Currency', 'Country', 'Sector', 'Platform', 'Positions']);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [allocationPage, setAllocationPage] = useState(0); // 0 = First 5, 1 = Rest
    const { currency } = useCurrency();
    const { t } = useLanguage();
    const { showAmounts: showAmountsPrivacy } = usePrivacy();

    // Sensors for drag and drop
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
    );

    const currencySymbols: Record<string, string> = { EUR: "€", USD: "$", TRY: "₺", GBP: "£" };
    // Convert logic using passed rates
    const convert = (amount: number) => {
        if (currency === 'EUR') return amount;
        const rate = exchangeRates?.[currency] || (currency === 'USD' ? 1.05 : currency === 'TRY' ? 38.5 : 1);
        return amount * rate;
    };
    const sym = currencySymbols[currency] || "€";

    const displayBalance = convert(totalValueEUR);

    // Chart Data Logic
    const getChartData = () => {
        let data: { name: string; value: number; color?: string }[] = [];
        switch (allocationView) {
            case "Portfolio":
                data = assets.reduce((acc: typeof data, asset) => {
                    const rawName = asset.customGroup || asset.ownerCode || 'Main';
                    // Normalize to lowercase for case-insensitive grouping
                    const normalizedName = rawName.toLowerCase();
                    const existing = acc.find(item => item.name.toLowerCase() === normalizedName);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name: rawName, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Type":
                data = assets.reduce((acc: typeof data, asset) => {
                    const rawType = asset.type || 'Uncategorized';
                    const typeName = (asset.symbol === 'EUR' || rawType === 'Cash') ? 'Cash' : rawType;
                    const existing = acc.find(item => item.name === typeName);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name: typeName, value: asset.totalValueEUR, color: ASSET_COLORS[typeName] || ASSET_COLORS['DEFAULT'] }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Exchange":
                data = assets.reduce((acc: typeof data, asset) => {
                    const name = asset.exchange || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Currency":
                data = assets.reduce((acc: typeof data, asset) => {
                    const name = asset.currency || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; }
                    else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Positions":
                data = assets.reduce((acc: typeof data, asset) => {
                    const name = asset.symbol || asset.name || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; } else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Country":
                data = assets.reduce((acc: typeof data, asset) => {
                    const name = asset.country || getCountryFromExchange(asset.exchange);
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; } else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Sector":
                data = assets.reduce((acc: typeof data, asset) => {
                    const name = asset.sector || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; } else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
            case "Platform":
                data = assets.reduce((acc: typeof data, asset) => {
                    const name = asset.platform || 'Unknown';
                    const existing = acc.find(item => item.name === name);
                    if (existing) { existing.value += asset.totalValueEUR; } else { acc.push({ name, value: asset.totalValueEUR }); }
                    return acc;
                }, [] as typeof data);
                break;
        }
        return data.sort((a, b) => b.value - a.value);
    };

    const rawChartData = getChartData();

    // Group small assets into "Other"
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
                name: t('Other') || 'Other',
                value: otherValue,
                color: '#94a3b8' // Slate-400 for neutral "Other"
            });
        }

        return processed;
    };

    const chartData = processChartData();
    const totalVal = chartData.reduce((sum, item) => sum + item.value, 0);

    const hoveredItem = hoveredSlice ? chartData.find(i => i.name === hoveredSlice) : null;
    const hoveredValue = hoveredItem ? convert(hoveredItem.value) : displayBalance;
    const hoveredPct = hoveredItem ? (hoveredItem.value / totalVal * 100) : null;

    // Mobile Pagination Logic
    const [mobilePage, setMobilePage] = useState(0); // 0 or 1

    const getVisibleCategories = () => {
        const all = viewOrder.filter(v => v !== 'Positions');
        // Define specific split based on user request
        if (mobilePage === 0) {
            // Page 1: Everything EXCEPT Country, Sector, Platform
            return all.filter(v => !['Country', 'Sector', 'Platform'].includes(v));
        } else {
            // Page 2: ONLY Country, Sector, Platform
            return all.filter(v => ['Country', 'Sector', 'Platform'].includes(v));
        }
    };


    // Privacy Mode Logic
    const [showAmounts, setShowAmounts] = useState(true);

    if (variant === 'mobile') {
        const groups = [
            viewOrder.filter(v => !['Country', 'Sector', 'Platform', 'Positions'].includes(v)),
            viewOrder.filter(v => ['Country', 'Sector', 'Platform', 'Positions'].includes(v))
        ];

        const handleMobilePageToggle = () => setMobilePage(prev => prev === 0 ? 1 : 0);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 1. Category Selector (New Modern Style) */}
                <div className="neo-card" style={{ padding: '0.85rem 1rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '0.8rem',
                        marginBottom: '0.2rem'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.2rem',
                            flex: 1,
                            overflowX: 'auto',
                            scrollbarWidth: 'none'
                        }}>
                            {groups[mobilePage].map(view => (
                                <button
                                    key={view}
                                    onClick={() => setAllocationView(view)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '0',
                                        fontSize: '0.85rem',
                                        fontWeight: allocationView === view ? 800 : 500,
                                        color: allocationView === view ? 'var(--accent)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'color 0.2s',
                                        position: 'relative',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {view}
                                    {allocationView === view && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '-0.95rem',
                                            left: 0,
                                            right: 0,
                                            height: '2px',
                                            background: 'var(--accent)',
                                            borderRadius: '2px 2px 0 0'
                                        }} />
                                    )}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleMobilePageToggle}
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                                marginLeft: '0.5rem'
                            }}
                        >
                            {mobilePage === 0 ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </button>
                    </div>
                </div>

                {/* 2. Chart & Details (Separate Card) - Ultra Compact */}
                <div className="neo-card" style={{
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0', // Zero gap between sections
                    position: 'relative' // For absolute positioning of eye icon
                }}>
                    {/* Privacy Toggle Button - Moved to top right of card */}
                    <button
                        onClick={() => setShowAmounts(!showAmounts)}
                        style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 20,
                            color: 'var(--text-muted)'
                        }}
                    >
                        {showAmounts ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>

                        {/* Chart Area */}
                        <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                            <PortfolioChart
                                assets={chartData}
                                totalValueEUR={totalValueEUR}
                                showLegend={false}
                                onHover={setHoveredSlice}
                                onClick={(name) => onFilterSelect?.(allocationView, name)}
                                activeSliceName={hoveredSlice}
                            />
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                                textAlign: 'center',
                                gap: '0'
                            }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {hoveredSlice || 'Net Worth'}
                                </span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', filter: isBlurred ? 'blur(12px)' : 'none', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                    {showAmounts
                                        ? (hoveredPct !== null
                                            ? `${Math.round(hoveredPct)}%`
                                            : `${sym}${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(displayBalance)}`)
                                        : (hoveredPct !== null ? `${Math.round(hoveredPct)}%` : '****')
                                    }
                                </span>
                            </div>
                        </div>

                        {/* Breakdown List (Legend) - Ultra Compact */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            {chartData.slice(0, 8).map((item, index) => {
                                const pct = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
                                const activeFilterValue = activeFilters?.[allocationView] || null;
                                const isSelected = activeFilterValue === item.name;
                                const isHovered = hoveredSlice === item.name;

                                return (
                                    <div
                                        key={item.name}
                                        onClick={() => onFilterSelect?.(allocationView, item.name)}
                                        onMouseEnter={() => setHoveredSlice(item.name)}
                                        onMouseLeave={() => setHoveredSlice(null)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.35rem 0.5rem',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.12)' : isHovered ? 'var(--bg-secondary)' : 'var(--surface)',
                                            border: isSelected ? '1px solid var(--accent)' : isHovered ? '1px solid var(--border)' : '1px solid var(--border-light)',
                                            borderRadius: '6px',
                                            transition: 'all 0.2s',
                                            opacity: hoveredSlice && hoveredSlice !== item.name ? 0.4 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{
                                                width: '0.6rem',
                                                height: '0.6rem',
                                                borderRadius: '2px',
                                                backgroundColor: item.color,
                                            }}></div>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                                            }}>{item.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: 'var(--text-muted)',
                                                fontVariantNumeric: 'tabular-nums'
                                            }}>
                                                {showAmounts
                                                    ? `${sym}${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(convert(item.value))}`
                                                    : '****'}
                                            </span>
                                            <span style={{
                                                fontSize: '0.8rem',
                                                fontWeight: 800,
                                                color: 'var(--text-primary)',
                                                fontVariantNumeric: 'tabular-nums',
                                                minWidth: '32px',
                                                textAlign: 'right'
                                            }}>{Math.round(pct)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Total Wealth Summary - Minimized */}
                        <div style={{
                            marginTop: '0.25rem',
                            paddingTop: '0.25rem',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            paddingLeft: '0.25rem',
                            paddingRight: '0.25rem'
                        }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Total
                            </span>
                            <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                {showAmounts
                                    ? `${sym}${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(displayBalance)}`
                                    : '****'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isFullScreen) {
        return (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {chartData.length > 0 ? (
                    <>
                        <PortfolioChart
                            assets={chartData}
                            totalValueEUR={totalValueEUR}
                            showLegend={false}
                            onHover={setHoveredSlice}
                            onClick={(name) => onFilterSelect?.(allocationView, name)}
                            activeSliceName={hoveredSlice}
                        />
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            textAlign: 'center',
                            gap: '4px'
                        }}>
                            <span style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {hoveredSlice || 'Net Worth'}
                            </span>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', filter: isBlurred ? 'blur(12px)' : 'none', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                {hoveredPct !== null
                                    ? `${Math.round(hoveredPct)}%`
                                    : (showAmountsPrivacy
                                        ? `${sym}${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(displayBalance)}`
                                        : '***')}
                            </span>
                        </div>
                    </>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--text-muted)',
                        fontSize: '14px'
                    }}>
                        No data available
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="neo-card" style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                height: 'fit-content'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.02em', margin: 0 }}>{t('allocation')}</h3>

                    {/* Sliding Filter Bar - Optimized Spacing */}
                    <div style={{
                        display: 'flex',
                        gap: '0px',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        flex: 1,                 // Take all remaining space
                        marginLeft: '1rem',      // Space from title
                        minWidth: 0              // Allow shrinking
                    }}>

                        {/* Left Arrow */}
                        <div style={{
                            width: '20px',
                            display: 'flex',
                            justifyContent: 'center',
                            flexShrink: 0  // Never shrink arrows
                        }}>
                            <button
                                onClick={() => setAllocationPage(p => Math.max(0, p - 1))}
                                disabled={allocationPage === 0}
                                style={{
                                    height: '24px', // Slightly larger hit area
                                    width: '24px',
                                    padding: 0,
                                    background: allocationPage > 0 ? 'var(--bg-secondary)' : 'transparent',
                                    border: allocationPage > 0 ? '1px solid var(--border)' : 'none',
                                    borderRadius: '50%',
                                    color: 'var(--text-primary)',
                                    cursor: allocationPage > 0 ? 'pointer' : 'default',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: allocationPage > 0 ? 1 : 0,
                                    transition: 'all 0.3s',
                                    transform: allocationPage > 0 ? 'scale(1)' : 'scale(0.8)'
                                }}
                            >
                                <ChevronLeft size={14} />
                            </button>
                        </div>

                        {/* Animated Filter Items Container */}
                        <div style={{
                            display: 'flex',
                            flex: 1,
                            justifyContent: 'space-evenly', // Distribute evenly
                            gap: '2px', // Minimal gap
                            overflow: 'hidden',
                            padding: '0 2px'
                        }}>
                            {viewOrder.map((view, index) => {
                                const ITEMS_PER_PAGE = 3;
                                const isVisible = index >= allocationPage * ITEMS_PER_PAGE && index < (allocationPage + 1) * ITEMS_PER_PAGE;

                                if (!isVisible) return null;

                                return (
                                    <div key={view} style={{
                                        flex: '1 1 0px',
                                        minWidth: 0,
                                        animation: 'fadeIn 0.5s ease-out forwards',
                                        display: 'flex',
                                        justifyContent: 'center'
                                    }}>
                                        <button
                                            onClick={() => setAllocationView(view)}
                                            title={view}
                                            style={{
                                                background: allocationView === view ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                                                border: 'none',
                                                borderRadius: '6px',
                                                color: allocationView === view ? 'var(--accent)' : 'var(--text-muted)',
                                                padding: '0.35rem 0.1rem', // Minimal padding
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                width: '100%',
                                                textAlign: 'center',
                                                transition: 'background 0.2s',
                                            }}
                                        >
                                            {view}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right Arrow */}
                        <div style={{
                            width: '20px',
                            display: 'flex',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <button
                                onClick={() => setAllocationPage(p => p + 1)}
                                disabled={(allocationPage + 1) * 3 >= viewOrder.length}
                                style={{
                                    height: '24px',
                                    width: '24px',
                                    padding: 0,
                                    background: (allocationPage + 1) * 3 < viewOrder.length ? 'var(--bg-secondary)' : 'transparent',
                                    border: (allocationPage + 1) * 3 < viewOrder.length ? '1px solid var(--border)' : 'none',
                                    borderRadius: '50%',
                                    color: 'var(--text-primary)',
                                    cursor: (allocationPage + 1) * 3 < viewOrder.length ? 'pointer' : 'default',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: (allocationPage + 1) * 3 < viewOrder.length ? 1 : 0,
                                    transition: 'all 0.3s',
                                    transform: (allocationPage + 1) * 3 < viewOrder.length ? 'scale(1)' : 'scale(0.8)'
                                }}
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>

                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                        <PortfolioChart
                            assets={chartData}
                            totalValueEUR={totalValueEUR}
                            showLegend={false}
                            onHover={setHoveredSlice}
                            onClick={(name) => onFilterSelect?.(allocationView, name)}
                            activeSliceName={hoveredSlice}
                        />
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            textAlign: 'center',
                            gap: '0.1rem'
                        }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {hoveredSlice || 'Net Worth'}
                            </span>
                            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', filter: isBlurred ? 'blur(12px)' : 'none', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                {hoveredPct !== null
                                    ? `${Math.round(hoveredPct)}%`
                                    : `${sym}${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(displayBalance)}`
                                }
                            </span>
                        </div>
                    </div>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {chartData.slice(0, 6).map((item, index) => {
                            const pct = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
                            const activeFilterValue = activeFilters?.[allocationView] || null;
                            const isSelected = activeFilterValue === item.name;
                            const isHovered = hoveredSlice === item.name;

                            return (
                                <div
                                    key={item.name}
                                    onClick={() => onFilterSelect?.(allocationView, item.name)}
                                    onMouseEnter={() => setHoveredSlice(item.name)}
                                    onMouseLeave={() => setHoveredSlice(null)}
                                    title={t('click_to_filter')}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        opacity: hoveredSlice && hoveredSlice !== item.name ? 0.3 : 1,
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        width: '100%',
                                        padding: '0.35rem 0.6rem',
                                        cursor: 'pointer',
                                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : isHovered ? 'var(--bg-secondary)' : 'transparent',
                                        border: isSelected ? '1px solid var(--accent)' : isHovered ? '1px solid var(--border)' : '1px solid transparent',
                                        borderRadius: '12px',
                                        transform: isHovered ? 'translateX(4px)' : 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <div style={{
                                            width: '0.6rem',
                                            height: '0.6rem',
                                            borderRadius: '3px',
                                            backgroundColor: item.color,
                                            boxShadow: isSelected || isHovered ? `0 0 12px ${item.color}60` : 'none',
                                            transition: 'all 0.2s'
                                        }}></div>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            fontWeight: isSelected || isHovered ? 800 : 600,
                                            color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                                            transition: 'all 0.2s'
                                        }}>{item.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
                                            color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>{Math.round(pct)}%</span>
                                        {isSelected && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }}></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div >

            {/* Adjust Modal */}
            {isAdjustModalOpen && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 10001,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }} onClick={() => setIsAdjustModalOpen(false)}>
                    <div style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        width: '100%',
                        maxWidth: '400px',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '1.5rem'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Customize Allocation Views</h3>
                                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drag to reorder. Top 3 will be visible in the main bar.</p>
                            </div>
                            <button
                                onClick={() => setIsAdjustModalOpen(false)}
                                style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <DndContext
                            collisionDetection={closestCenter}
                            sensors={sensors}
                            onDragEnd={(event) => {
                                const { active, over } = event;
                                if (over && active.id !== over.id) {
                                    setViewOrder((items) => {
                                        const oldIndex = items.indexOf(active.id as string);
                                        const newIndex = items.indexOf(over.id as string);
                                        return arrayMove(items, oldIndex, newIndex);
                                    });
                                }
                            }}
                        >
                            <SortableContext items={viewOrder} strategy={verticalListSortingStrategy}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {viewOrder.map((id, index) => (
                                        <SortableAllocationItem key={id} id={id} label={id} isPinned={index < 3} />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>

                        <button
                            onClick={() => setIsAdjustModalOpen(false)}
                            style={{
                                width: '100%',
                                marginTop: '1.5rem',
                                padding: '0.8rem',
                                background: 'var(--accent)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px var(--accent-glow)'
                            }}
                        >
                            Save Settings
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

// Sortable Allocation Item Component (for drag & drop)
const SortableAllocationItem = ({ id, label, isPinned }: { id: string, label: string, isPinned: boolean }) => {
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
        background: isDragging ? 'var(--bg-secondary)' : 'var(--surface)',
        border: `1px solid ${isPinned ? 'rgba(99, 102, 241, 0.2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'grab',
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20000 : 1,
        boxShadow: isDragging ? 'var(--shadow-md)' : 'none'
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {isPinned && <div title="Visible in main bar" style={{ background: 'var(--accent)', width: '6px', height: '6px', borderRadius: '50%' }} />}
                <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
        </div>
    );
};

// --- Component 4: GoalsCard ---

export function GoalsCard({ goals = [], isOwner, exchangeRates, totalValueEUR, onShare }: { goals: Goal[], isOwner: boolean, exchangeRates?: Record<string, number>, totalValueEUR: number, onShare: (data: any) => void }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const { t } = useLanguage();

    return (
        <div className="neo-card" style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{t('financial_goals')}</h3>
                {isOwner && (
                    <button
                        onClick={() => { setEditingGoal(null); setIsModalOpen(true); }}
                        style={{
                            background: 'transparent',
                            color: 'var(--accent)',
                            border: 'none',
                            padding: '0.2rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                        }}
                        title="Add New Goal"
                    >
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: 'var(--accent-glow)',
                            color: 'var(--accent)'
                        }}>
                            <Plus size={16} strokeWidth={3} />
                        </div>
                    </button>
                )}
            </div>

            {/* Goals List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {goals.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                        <p style={{ opacity: 0.5, fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
                            Start your wealth journey.
                        </p>
                    </div>
                )}
                {goals.map(goal => (
                    <GoalItem
                        key={goal.id}
                        goal={goal}
                        isOwner={isOwner}
                        exchangeRates={exchangeRates}
                        onClick={() => {
                            if (isOwner) {
                                setEditingGoal(goal);
                                setIsModalOpen(true);
                            }
                        }}
                    />
                ))}
            </div>

            {/* Goal Modal (Add/Edit) */}
            {
                isModalOpen && createPortal(
                    <GoalModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        existingGoal={editingGoal}
                        exchangeRates={exchangeRates}
                        totalValueEUR={totalValueEUR}
                    />,
                    document.body
                )
            }
        </div >
    );
}

function GoalItem({ goal, isOwner, exchangeRates, onClick, onShare }: { goal: Goal, isOwner: boolean, exchangeRates?: Record<string, number>, onClick: () => void, onShare?: (data: any) => void }) {
    const { currency } = useCurrency();

    const convertValue = (amount: number, fromCurrency: string) => {
        if (fromCurrency === currency) return amount;
        const eurValue = fromCurrency === 'EUR' ? amount : amount / (exchangeRates?.[fromCurrency] || 1);
        if (currency === 'EUR') return eurValue;
        const rate = exchangeRates?.[currency] || (currency === 'USD' ? 1.05 : currency === 'TRY' ? 38.5 : 1);
        return eurValue * rate;
    };

    const displayCurrent = convertValue(goal.currentAmount, goal.currency || 'EUR');
    const displayTarget = goal.type === 'SYSTEM_THRESHOLD'
        ? getNextSmartMilestone(displayCurrent)
        : convertValue(goal.targetAmount, goal.currency || 'EUR');

    const progress = Math.min(100, Math.round((displayCurrent / displayTarget) * 100));
    const sym = CURRENCY_SYMBOLS[currency] || "€";
    const isCompleted = progress >= 100;

    // Circular Progress Props
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div style={{
            padding: '0.75rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            cursor: isOwner ? 'pointer' : 'default',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
        }}
            onClick={onClick}
            onMouseEnter={(e) => {
                if (isOwner) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }
            }}
            onMouseLeave={(e) => {
                if (isOwner) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                }
            }}
        >
            {/* Left: Circular Progress */}
            <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
                {/* Background Circle */}
                <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        cx="22"
                        cy="22"
                        r={radius}
                        stroke="var(--border)"
                        strokeWidth="4"
                        fill="transparent"
                        opacity={0.3}
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="22"
                        cy="22"
                        r={radius}
                        stroke={isCompleted ? '#22c55e' : 'var(--accent)'}
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                    />
                </svg>
                {/* Center Percentage or Icon */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: isCompleted ? '#22c55e' : 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums'
                }}>
                    {isCompleted ? <Check size={16} strokeWidth={4} /> : `${progress}%`}
                </div>
            </div>

            {/* Right: Text Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {goal.name}
                        </span>
                        {goal.type === 'SYSTEM_THRESHOLD' && <TrendingUpIcon size={12} color="var(--accent)" />}
                    </div>
                    {/* Share Trigger */}
                    <MilestoneTrigger
                        onShare={onShare}
                        data={{
                            goal: {
                                name: goal.name,
                                target: goal.targetAmount,
                                current: goal.currentAmount,
                                percent: progress
                            }
                        }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{sym}{formatAmount(displayCurrent)}</span>
                    <span style={{ opacity: 0.5 }}>/</span>
                    <span>{formatAmount(displayTarget)}</span>
                </div>
            </div>

            {/* Far Right: Selected Icon */}
            <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isCompleted ? '#22c55e' : 'var(--text-secondary)',
                flexShrink: 0,
                border: '1px solid var(--border)'
            }}>
                {(() => {
                    if (goal.type === 'SYSTEM_THRESHOLD') return <TrendingUpIcon size={16} strokeWidth={2} />;
                    const selectedIcon = GOAL_ICONS.find(i => i.id === goal.icon);
                    if (selectedIcon) {
                        const IconComponent = selectedIcon.Icon;
                        return <IconComponent size={16} strokeWidth={2} />;
                    }
                    return <Target size={16} />;
                })()}
            </div>
        </div>
    )
}

function SidebarAssetLogo({ symbol, type, name, size = '2.2rem' }: { symbol: string, type: string, name?: string, size?: string }) {
    const t = type.toUpperCase();
    const cleanSymbol = symbol.split('.')[0].toUpperCase();
    const [validUrl, setValidUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const potentialUrls = useMemo(() => {
        const list: string[] = [];
        // Add TradingView Fallback for Stocks/ETFs
        if ((t === 'STOCK' || t === 'ETF' || t === 'FUND')) {
            if (!symbol.includes('.IS')) {
                list.push(`https://s3-symbol-logo.tradingview.com/${cleanSymbol}--big.svg`);
            }
        }
        if (t === 'CRYPTO') {
            list.push(`https://assets.coincap.io/assets/icons/${cleanSymbol.toLowerCase()}@2x.png`);
        }
        return list;
    }, [cleanSymbol, t, symbol]);

    useEffect(() => {
        let isMounted = true;
        const tryLoad = async () => {
            for (const url of potentialUrls) {
                if (!isMounted) return;
                try {
                    await new Promise((resolve, reject) => {
                        const img = new window.Image();
                        img.src = url;
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    if (isMounted) {
                        setValidUrl(url);
                        setLoading(false);
                        return;
                    }
                } catch (e) { /* ignore */ }
            }
            if (isMounted) setLoading(false);
        };
        tryLoad();
        return () => { isMounted = false; };
    }, [potentialUrls]);

    if (!validUrl) {
        return (
            <div style={{
                width: size, height: size, borderRadius: '50%',
                background: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 900, color: 'var(--surface)',
                border: '1px solid var(--border)',
                flexShrink: 0
            }}>
                {symbol ? (symbol.length > 3 ? symbol.slice(0, 2) : symbol.slice(0, 3)).toUpperCase() : '??'}
            </div>
        );
    }

    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            overflow: 'hidden', background: 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)',
            flexShrink: 0
        }}>
            <img
                src={validUrl}
                style={{ width: '75%', height: '75%', objectFit: 'contain' }}
                alt=""
            />
        </div>
    );
}

function GoalModal({ isOpen, onClose, existingGoal, exchangeRates, totalValueEUR }: { isOpen: boolean, onClose: () => void, existingGoal: Goal | null, exchangeRates?: Record<string, number>, totalValueEUR: number }) {
    const { currency: globalCurrency } = useCurrency();
    const { t } = useLanguage();
    const [name, setName] = useState(existingGoal?.name || '');
    const [target, setTarget] = useState(existingGoal?.targetAmount?.toString() || '');
    const [current, setCurrent] = useState(existingGoal?.currentAmount?.toString() || totalValueEUR.toString());
    const [selectedIcon, setSelectedIcon] = useState(existingGoal?.icon || 'target');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const convertedPortfolio = (globalCurrency === 'ORG' || globalCurrency === 'EUR')
        ? (parseFloat(current) || 0)
        : (parseFloat(current) || 0) * (exchangeRates?.[globalCurrency] || 1);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSubmitting(true);
        try {
            if (existingGoal) {
                await updateGoal(existingGoal.id, {
                    name,
                    targetAmount: parseFloat(target),
                    currentAmount: parseFloat(current) || 0,
                    icon: selectedIcon
                });
            } else {
                await createGoal({
                    name,
                    targetAmount: parseFloat(target),
                    currentAmount: parseFloat(current) || 0,
                    currency: 'EUR', // Default currency for new goals
                    icon: selectedIcon
                });
            }
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!existingGoal || !confirm("Delete this goal?")) return;
        setIsSubmitting(true);
        try {
            await deleteGoal(existingGoal.id);
            onClose();
        } catch (err) { console.error(err); }
        finally { setIsSubmitting(false); }
    }

    const labelStyle = {
        fontSize: '0.75rem',
        fontWeight: 800,
        color: 'var(--text-muted)',
        marginBottom: '0.5rem',
        display: 'block',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em'
    };

    const inputStyle = {
        width: '100%',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.875rem 1.25rem',
        fontSize: '1rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        outline: 'none',
        transition: 'all 0.2s',
    };

    return createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
        }}>
            {/* Backdrop */}
            <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(12px)', animation: 'fadeIn 0.3s ease'
            }} onClick={onClose} />

            {/* Modal Card */}
            <div className="neo-card" style={{
                position: 'relative', width: '100%', maxWidth: '440px',
                background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)', animation: 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                                {existingGoal ? t('edit_goal') : t('create_goal')}
                            </h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 600 }}>{t('wealth_tracking')}</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                        }} onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={labelStyle}>Goal Name</label>
                        <input
                            autoFocus
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Early Retirement"
                            style={inputStyle}
                            required
                        />
                    </div>

                    {/* Icon Selector */}
                    <div>
                        <label style={labelStyle}>Choose Icon</label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(6, 1fr)',
                            gap: '0.75rem',
                            marginTop: '0.5rem'
                        }}>
                            {GOAL_ICONS.map(iconOption => {
                                const IconComponent = iconOption.Icon;
                                const isSelected = selectedIcon === iconOption.id;
                                return (
                                    <button
                                        key={iconOption.id}
                                        type="button"
                                        onClick={() => setSelectedIcon(iconOption.id)}
                                        style={{
                                            padding: '0.75rem',
                                            background: isSelected ? `${iconOption.color}15` : 'var(--bg-secondary)',
                                            border: isSelected ? `2px solid ${iconOption.color}` : '2px solid transparent',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            color: isSelected ? iconOption.color : 'var(--text-muted)',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={e => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = 'var(--surface)';
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = 'var(--bg-secondary)';
                                                e.currentTarget.style.borderColor = 'transparent';
                                            }
                                        }}
                                        title={iconOption.label}
                                    >
                                        <IconComponent size={20} strokeWidth={2.5} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Current Value</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={formatAmount(convertedPortfolio)}
                                    disabled
                                    style={{
                                        ...inputStyle,
                                        opacity: 0.6,
                                        cursor: 'not-allowed',
                                        background: 'var(--surface)',
                                        fontVariantNumeric: 'tabular-nums'
                                    }}
                                />
                                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                                    <Lock size={14} color="var(--text-muted)" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Target Amount</label>
                            <input
                                type="text"
                                value={existingGoal?.type === 'SYSTEM_THRESHOLD'
                                    ? formatAmount(getNextSmartMilestone(convertedPortfolio))
                                    : formatAmount(parseFloat(target) || 0)
                                }
                                onChange={e => {
                                    if (existingGoal?.type !== 'SYSTEM_THRESHOLD') {
                                        const raw = e.target.value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
                                        setTarget(raw);
                                    }
                                }}
                                disabled={existingGoal?.type === 'SYSTEM_THRESHOLD'}
                                placeholder="100.000"
                                style={{
                                    ...inputStyle,
                                    opacity: existingGoal?.type === 'SYSTEM_THRESHOLD' ? 0.6 : 1,
                                    cursor: existingGoal?.type === 'SYSTEM_THRESHOLD' ? 'not-allowed' : 'text',
                                    fontVariantNumeric: 'tabular-nums'
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        <button type="submit" disabled={isSubmitting} style={{
                            width: '100%', padding: '1rem', background: 'var(--accent)', color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-md)', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                            boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
                        }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                            {isSubmitting ? <div className="spinner" /> : <><Check size={18} /> {existingGoal ? 'Update Goal' : 'Save Goal'}</>}
                        </button>

                        {existingGoal && (
                            <button type="button" onClick={handleDelete} disabled={isSubmitting} style={{
                                width: '100%', padding: '1rem', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)40',
                                borderRadius: 'var(--radius-md)', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                transition: 'all 0.2s'
                            }}>
                                <Trash2 size={18} /> Delete Goal
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}


interface BenchmarkControlProps {
    isPortfolioVisible: boolean;
    setIsPortfolioVisible: (v: boolean) => void;
    selectedBenchmarks: string[];
    toggleBenchmark: (id: string) => void;
}

export function BenchmarkComparisonCard({
    isPortfolioVisible,
    setIsPortfolioVisible,
    selectedBenchmarks,
    toggleBenchmark
}: BenchmarkControlProps) {
    const { t } = useLanguage();
    return (
        <div className="neo-card" style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
        }}>
            <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('comparisons')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* 1. My Portfolio Toggle */}
                <div
                    onClick={() => setIsPortfolioVisible(!isPortfolioVisible)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: isPortfolioVisible ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                        border: isPortfolioVisible ? '1px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isPortfolioVisible ? 'var(--shadow-sm)' : 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '0.65rem', height: '0.65rem', borderRadius: '2px',
                            background: isPortfolioVisible ? 'var(--accent)' : 'var(--text-muted)',
                            boxShadow: isPortfolioVisible ? '0 0 10px var(--accent)' : 'none',
                            transition: 'all 0.3s'
                        }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isPortfolioVisible ? 'var(--text-primary)' : 'var(--text-secondary)' }}>My Portfolio</span>
                    </div>
                    <div style={{ color: isPortfolioVisible ? 'var(--accent)' : 'var(--text-muted)', display: 'flex' }}>
                        {isPortfolioVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '0.25rem 0' }} />

                {/* 2. Benchmark List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {BENCHMARK_ASSETS.map(benchmark => {
                        const isSelected = selectedBenchmarks.includes(benchmark.id);
                        return (
                            <div
                                key={benchmark.id}
                                onClick={() => toggleBenchmark(benchmark.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.85rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: isSelected ? `${benchmark.color}15` : 'transparent',
                                    border: isSelected ? `1px solid ${benchmark.color}60` : '1px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.background = 'var(--bg-secondary)';
                                        e.currentTarget.style.border = '1px solid var(--border)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.border = '1px solid transparent';
                                    }
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '0.5rem', height: '0.5rem', borderRadius: '1.5px',
                                        background: isSelected ? benchmark.color : 'var(--text-muted)',
                                        boxShadow: isSelected ? `0 0 10px ${benchmark.color}` : 'none',
                                        transition: 'all 0.3s'
                                    }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        {benchmark.name}
                                    </span>
                                </div>
                                <div style={{ color: isSelected ? benchmark.color : 'var(--text-muted)', opacity: isSelected ? 1 : 0.4, display: 'flex' }}>
                                    {isSelected ? <Eye size={16} /> : <EyeOff size={16} />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

}
