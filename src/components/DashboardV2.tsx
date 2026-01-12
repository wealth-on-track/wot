"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation"; // Added router
import { BENCHMARK_ASSETS } from "@/lib/benchmarkApi";
import { InlineAssetSearch } from "./InlineAssetSearch";
import { deleteAsset, updateAsset, refreshPortfolioPrices, reorderAssets, trackLogoRequest, updateUserPreferences } from "@/lib/actions";
import { AllocationCard, GoalsCard, TopPerformersCard } from "./PortfolioSidebarComponents";
import { EmptyPlaceholder } from "./EmptyPlaceholder";
import { Inbox } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor, // Switched to Mouse
    TouchSensor, // Switched    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    useDroppable
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ASSET_COLORS } from "@/lib/constants";
import { getLogoUrl } from "@/lib/logos";
const TIME_PERIODS = ["ALL"];
import { Bitcoin, Wallet, TrendingUp, PieChart, Gem, Coins, Layers, LayoutGrid, List, Save, X, Trash2, Settings, LayoutTemplate, Grid, Check, ChevronDown, ChevronRight, ChevronLeft, GripVertical, SlidersHorizontal, Briefcase, Banknote, MoreVertical, MoreHorizontal, Plus } from "lucide-react";
import { DetailedAssetCard } from "./DetailedAssetCard";
import { getCompanyName } from "@/lib/companyNames";
import { formatEUR, formatNumber } from "@/lib/formatters";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { RATES, getRate, getCurrencySymbol } from "@/lib/currency";
import { EditAssetModal } from "./EditAssetModal";

// Column Item UI (Presentational)
const ColumnItem = React.forwardRef(({ label, type, style, listeners, attributes, isOverlay }: { label: string, type: 'active' | 'passive', style?: React.CSSProperties, listeners?: any, attributes?: any, isOverlay?: boolean }, ref: React.Ref<HTMLDivElement>) => {
    return (
        <div ref={ref} style={{
            background: type === 'active' ? 'var(--surface)' : 'rgba(255,255,255,0.03)',
            border: type === 'active' ? '1px solid var(--border)' : '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: isOverlay ? 'grabbing' : 'grab',
            marginBottom: '0.5rem',
            boxShadow: isOverlay ? '0 8px 16px rgba(0,0,0,0.4)' : 'none',
            scale: isOverlay ? '1.02' : '1',
            ...style
        }} {...attributes} {...listeners}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <GripVertical size={16} style={{ color: type === 'active' ? 'var(--text-secondary)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: type === 'active' ? 600 : 500, color: type === 'active' ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
            </div>
            {type === 'active' && (
                <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                }} />
            )}
        </div>
    );
});
ColumnItem.displayName = "ColumnItem";

// Sortable Wrapper
const SortableColumnItem = ({ id, label, type }: { id: string, label: string, type: 'active' | 'passive' }) => {
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
        opacity: isDragging ? 0.3 : 1, // Dim the source item while dragging
    };

    return (
        <ColumnItem
            ref={setNodeRef}
            style={style}
            listeners={listeners}
            attributes={attributes}
            label={label}
            type={type}
        />
    );
};

const DroppableArea = ({ id, children, style }: { id: string, children: React.ReactNode, style?: React.CSSProperties }) => {
    const { setNodeRef } = useDroppable({ id });
    return (
        <div ref={setNodeRef} style={style}>
            {children}
        </div>
    );
};

const PORTFOLIO_COLORS = [
    { bg: 'rgba(59, 130, 246, 0.1)', text: '#1d4ed8', border: 'rgba(59, 130, 246, 0.2)' }, // Blue
    { bg: 'rgba(16, 185, 129, 0.1)', text: '#047857', border: 'rgba(16, 185, 129, 0.2)' }, // Emerald
    { bg: 'rgba(245, 158, 11, 0.1)', text: '#b45309', border: 'rgba(245, 158, 11, 0.2)' }, // Amber
    { bg: 'rgba(139, 92, 246, 0.1)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.2)' }, // Purple
    { bg: 'rgba(244, 63, 94, 0.1)', text: '#be123c', border: 'rgba(244, 63, 94, 0.2)' },  // Rose
    { bg: 'rgba(6, 182, 212, 0.1)', text: '#0e7490', border: 'rgba(6, 182, 212, 0.2)' }, // Cyan
];

function getPortfolioStyle(name: string) {
    if (!name || name === '-') return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'transparent' };
    let hash = 0;
    const cleanName = name.toUpperCase();
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        { bg: 'rgba(59, 130, 246, 0.08)', text: '#1d4ed8', border: 'rgba(59, 130, 246, 0.12)' }, // Blue
        { bg: 'rgba(16, 185, 129, 0.08)', text: '#047857', border: 'rgba(16, 185, 129, 0.12)' }, // Emerald
        { bg: 'rgba(245, 158, 11, 0.08)', text: '#b45309', border: 'rgba(245, 158, 11, 0.12)' }, // Amber
        { bg: 'rgba(139, 92, 246, 0.08)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.12)' }, // Purple
        { bg: 'rgba(244, 63, 94, 0.08)', text: '#be123c', border: 'rgba(244, 63, 94, 0.12)' },  // Rose
        { bg: 'rgba(6, 182, 212, 0.08)', text: '#0e7490', border: 'rgba(6, 182, 212, 0.12)' }, // Cyan
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

interface DashboardProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    goals?: any[]; // Passed from page
    isBlurred: boolean;
    showChangelog?: boolean;
    exchangeRates?: Record<string, number>;
    positionsViewCurrency?: string; // Currency for displaying positions
    preferences?: any;
}

// European number format removed (Imported)
// Company name mapping removed (Imported)

// Logo mapping for common symbols
// Systematic Logo Logic
// Local getLogoUrl removed. Imported from @/lib/logos.

// Helper to determine provider from URL for telemetry
const getProviderFromUrl = (url: string): string | null => {
    if (url.includes('logo.dev')) return 'LOGODEV';
    if (url.includes('ahmeterenodaci') || url.includes('Istanbul-Stock-Exchange')) return 'BIST_CDN';
    if (url.includes('flagcdn.com')) return 'FLAGCDN';
    if (url.includes('coincap.io')) return 'COINCAP';
    return null; // Don't track other sources
};

const AssetLogo = ({ symbol, type, name, exchange, logoUrl: primaryUrl, size = '3.5rem' }: { symbol: string, type: string, name?: string, exchange?: string, logoUrl?: string | null, size?: string }) => {
    // State to track the currently valid image URL. null means show placeholder.
    const [validUrl, setValidUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const t = type.toUpperCase();
    const cleanSymbol = symbol.split('.')[0].toUpperCase();

    // Construct the list of potential URLs
    const potentialUrls = useMemo(() => {
        const list: string[] = [];
        if (primaryUrl && primaryUrl.trim() !== '') list.push(primaryUrl);

        // Fallback for Stocks/ETFs - Only exclude if strictly safer
        if ((t === 'STOCK' || t === 'ETF' || t === 'FUND')) {
            // Only add TradingView if not BIST/BES to avoid noise, OR if it's a major known stock
            if (!symbol.includes('.IS') && !['BES', 'HISA'].some(prefix => symbol.startsWith(prefix))) {
                list.push(`https://s3-symbol-logo.tradingview.com/${cleanSymbol}--big.svg`);
            }
        }

        if (t === 'CRYPTO') {
            list.push(`https://assets.coincap.io/assets/icons/${cleanSymbol.toLowerCase()}@2x.png`);
        }

        // BACKUP: CASH/CURRENCY Fallback to FlagCDN if Icons8 fails
        if (t === 'CASH' || t === 'CURRENCY') {
            const currencyFlagMap: Record<string, string> = {
                'USD': 'us', 'EUR': 'eu', 'TRY': 'tr', 'GBP': 'gb',
                'JPY': 'jp', 'CNY': 'cn', 'CHF': 'ch', 'CAD': 'ca',
                'AUD': 'au', 'NZD': 'nz', 'INR': 'in', 'BRL': 'br',
                'RUB': 'ru', 'MXN': 'mx', 'SEK': 'se'
            };
            const code = currencyFlagMap[symbol.toUpperCase()];
            if (code) {
                list.push(`https://flagcdn.com/w80/${code}.png`);
            }
        }

        // Add a generic fallback service if needed, e.g. clearbit
        // list.push(`https://logo.clearbit.com/${cleanSymbol}.com`); 

        return list;
    }, [primaryUrl, cleanSymbol, t, symbol]);

    // PRELOAD LOGIC: Try to load images one by one until one success or all fail
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const tryLoadImages = async () => {
            for (const url of potentialUrls) {
                if (!isMounted) return;
                try {
                    await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.src = url;
                        img.onload = resolve;
                        img.onerror = reject;
                    });

                    // If we get here, image loaded successfully
                    if (isMounted) {
                        // Track successful logo load
                        const provider = getProviderFromUrl(url);
                        if (provider) {
                            // Success tracking enabled for Admin Activity Log
                            // trackLogoRequest(provider, true, symbol, type, exchange).catch(() => { /* ignore */ });
                        }

                        setValidUrl(url);
                        setLoading(false);
                        return; // Found a valid one, stop searching
                    }
                } catch (e) {
                    // Logo failed to load, try next URL
                    // Note: We don't track errors here to avoid spam, only track when logo is generated
                    continue;
                }
            }

            // If loop finishes without return, all failed
            if (isMounted) {
                setValidUrl(null); // Force placeholder
                setLoading(false);
            }
        };

        if (potentialUrls.length > 0) {
            tryLoadImages();
        } else {
            setValidUrl(null);
            setLoading(false);
        }

        return () => { isMounted = false; };
    }, [potentialUrls]);

    const logoStyle: React.CSSProperties = {
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'contain',
        background: 'var(--glass-shine)',
        border: '1px solid var(--glass-border)',
        overflow: 'hidden',
        flexShrink: 0
    };

    // Extract text for placeholder - show full ticker if 3-4 chars, else first letter
    const getPlaceholderText = (): string => {
        // PRIORITY: If the ticker is exactly 3 letters (e.g. TI2, NNF), use it directly.
        // This overrides the Name-based logic for TEFAS/Fund assets.
        const cleanSym = symbol.split('.')[0].trim().toUpperCase();
        if (cleanSym.length === 3) {
            return cleanSym;
        }

        // Fallback: Use Name (if available) or Symbol
        let text = name || symbol;
        if (!name && symbol.includes('-')) text = symbol.split('-')[1];

        const prefixes = ['BES-', 'BES_', 'TURKEY ', 'HISA-'];
        for (const prefix of prefixes) {
            if (text.toUpperCase().startsWith(prefix)) {
                text = text.substring(prefix.length);
                break;
            }
        }

        const trimmedText = text.trim().toUpperCase();



        // For longer symbols, show just the first character
        return trimmedText.charAt(0);
    };

    const getPlaceholderColor = () => {
        const colors = [
            'linear-gradient(135deg, #6366f1, #a855f7)',
            'linear-gradient(135deg, #3b82f6, #06b6d4)',
            'linear-gradient(135deg, #10b981, #3b82f6)',
            'linear-gradient(135deg, #f59e0b, #ef4444)',
            'linear-gradient(135deg, #ec4899, #8b5cf6)',
            'linear-gradient(135deg, #84cc16, #10b981)',
        ];
        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // RENDER
    if (validUrl) {
        return (
            <div style={logoStyle}>
                <img
                    src={validUrl}
                    alt={symbol}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        );
    }

    // Default to placeholder if loading or no valid url found
    const placeholderText = getPlaceholderText();
    const isMultiChar = placeholderText.length > 1;

    // Adjust font size based on whether it's a single char or multi-char
    const getFontSize = () => {
        if (size === '1.2rem') return isMultiChar ? '0.45rem' : '0.6rem';
        if (size === '1.4rem') return isMultiChar ? '0.5rem' : '0.7rem';
        if (size === '2rem') return isMultiChar ? '0.75rem' : '1rem';
        if (size === '2.8rem') return isMultiChar ? '0.85rem' : '1.2rem';
        if (size === '3.5rem') return isMultiChar ? '1.1rem' : '1.5rem';
        if (size === '4.5rem') return isMultiChar ? '1.5rem' : '2rem';
        return isMultiChar ? '1rem' : '1.2rem';
    };

    return (
        <div style={{
            ...logoStyle,
            background: getPlaceholderColor(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: getFontSize(),
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
            letterSpacing: isMultiChar ? '-0.02em' : '0'
        }}>
            {loading ? (
                <div style={{ // Tiny spinner or just the letter
                    width: '50%', height: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
            ) : (
                placeholderText
            )}
            <style jsx>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

const MarketStatusDot = ({ state, type }: { state?: string, type?: string }) => {
    if (!state) return null;

    if (type === 'CASH') {
        return (
            <div
                title="Cash / Liquid"
                style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-muted)',
                    opacity: 0.6,
                    flexShrink: 0
                }}
            />
        );
    }

    const isRegular = state.toUpperCase() === 'REGULAR';
    return (
        <div
            title={state}
            style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isRegular ? '#22c55e' : '#ef4444',
                boxShadow: `0 0 6px ${isRegular ? '#22c55e' : '#ef4444'}60`,
                flexShrink: 0
            }}
        />
    );
};

import { AssetDisplay } from "@/lib/types";
import { SortableAssetRow, SortableGroup, SortableAssetCard } from "./SortableWrappers";
import { PortfolioPerformanceChart } from "./PortfolioPerformanceChart";

// Column Configurations
// Column Configurations
type ColumnId = 'TYPE' | 'NAME' | 'TICKER' | 'EXCHANGE' | 'CURRENCY' | 'PRICE' | 'PRICE_EUR' | 'VALUE' | 'VALUE_EUR' | 'PL' | 'EARNINGS' | 'PORTFOLIO_NAME' | 'OWNER' | 'LOCATION' | 'PLATFORM' | 'ASSET_CLASS' | 'MARKET' | 'COUNTRY';

interface ColumnConfig {
    id: ColumnId;
    label: string;
    headerLabel?: string;
    isDefault: boolean;
}

// Simplified Columns as requested
const ALL_COLUMNS: ColumnConfig[] = [
    { id: 'PORTFOLIO_NAME', label: 'Portfolio', isDefault: true },
    { id: 'NAME', label: 'Name', isDefault: true },
    { id: 'PRICE', label: 'Price', isDefault: true },
    { id: 'VALUE', label: 'Total Value', isDefault: true },
    { id: 'VALUE_EUR', label: 'Total Value (€)', isDefault: true },
    { id: 'PL', label: 'P&L (€)', isDefault: true },
];

const COL_WIDTHS: Record<ColumnId, string> = {
    PORTFOLIO_NAME: 'minmax(65px, 0.6fr)',
    NAME: 'minmax(140px, 2fr)',
    PRICE: 'minmax(90px, 1fr)',
    VALUE: 'minmax(120px, 1.2fr)',
    PRICE_EUR: 'minmax(90px, 1fr)',
    VALUE_EUR: 'minmax(160px, 1.3fr)',
    PL: 'minmax(110px, 1.2fr)',
    LOCATION: '0px',
    OWNER: '0px',
    PLATFORM: '0px',
    COUNTRY: '0px',
    ASSET_CLASS: '0px',
    TYPE: '0px',
    MARKET: '0px',
    CURRENCY: '0px',
    TICKER: '0px',
    EXCHANGE: '0px',
    EARNINGS: '0px'
};

// ... (DraggableHeader remains similar, maybe adjusted for padding) ...



// ...



const DraggableHeader = ({ id, children, onToggle, columnsCount = 4 }: { id: string, children: React.ReactNode, onToggle?: () => void, columnsCount?: number }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    // Dynamic density
    const isUltraHighDensity = columnsCount >= 10;
    const isHighDensity = columnsCount >= 7;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 20 : 1,
        opacity: isDragging ? 0.8 : 1,
        touchAction: 'none',
        userSelect: 'none' as const
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            id={id}
            className={`col-${id.replace('col:', '').toLowerCase()}`}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: ['col:PRICE', 'col:PRICE_EUR', 'col:VALUE', 'col:VALUE_EUR', 'col:PL'].includes(id) ? 'flex-end' : 'flex-start',
                gap: 0,
                height: '100%',
                paddingLeft: isUltraHighDensity ? '0.05rem' : '0.2rem',
                paddingRight: ['col:PRICE', 'col:PRICE_EUR', 'col:VALUE', 'col:VALUE_EUR', 'col:PL'].includes(id) ? (isUltraHighDensity ? '0.1rem' : isHighDensity ? '0.2rem' : '0.4rem') : '0',
                borderRight: 'none',
                borderBottom: 'none',
                background: isDragging ? 'rgba(0,0,0,0.05)' : 'transparent',
                overflow: 'hidden'
            }}>
                {columnsCount < 12 && <span style={{ opacity: 0.1, cursor: 'grab' }}><GripVertical size={9} /></span>}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    flex: 1,
                    overflow: 'hidden',
                    lineHeight: 1.1,
                    fontSize: isUltraHighDensity ? '0.55rem' : isHighDensity ? '0.62rem' : '0.7rem',
                    textAlign: ['col:PRICE', 'col:PRICE_EUR', 'col:VALUE', 'col:VALUE_EUR', 'col:PL'].includes(id) ? 'right' : 'left',
                    alignItems: ['col:PRICE', 'col:PRICE_EUR', 'col:VALUE', 'col:VALUE_EUR', 'col:PL'].includes(id) ? 'flex-end' : 'flex-start'
                }}>
                    {children}
                </div>
            </div>
        </div>
    );
};


// Local Sortable Wrappers removed (Imported)

// Component for a single row in the data table (List View)
function AssetTableRow({
    asset,
    positionsViewCurrency,
    totalPortfolioValueEUR,
    isOwner,
    onDelete,
    timeFactor,
    timePeriod,
    rowIndex,
    columns = ['NAME', 'PRICE', 'VALUE', 'PL'],
    exchangeRates,
    isGlobalEditMode,
    onAssetClick
}: {
    asset: AssetDisplay,
    positionsViewCurrency: string,
    totalPortfolioValueEUR: number,
    isOwner: boolean,
    onDelete: (id: string) => void,
    timeFactor: number,
    rowIndex?: number,
    columns?: ColumnId[],
    timePeriod: string,
    exchangeRates?: Record<string, number>,
    isGlobalEditMode?: boolean,
    onAssetClick?: (asset: AssetDisplay) => void
}) {
    const router = useRouter();
    const [isHovered, setIsHovered] = useState(false);

    // Native (Original) Values for PRICE / VALUE columns
    const nativePrice = asset.previousClose;
    const nativeTotalValue = asset.previousClose * asset.quantity;
    const nativeCostBasis = asset.buyPrice * asset.quantity;
    const nativeSymbol = getCurrencySymbol(asset.currency);

    // Global (Converted) Values for PRICE_EUR / VALUE_EUR / PL columns
    const globalCurrency = positionsViewCurrency === 'ORG' ? 'EUR' : positionsViewCurrency;
    const globalRate = getRate(asset.currency, globalCurrency, exchangeRates);
    const globalSymbol = getCurrencySymbol(globalCurrency);

    const globalPrice = globalCurrency === 'EUR' && asset.totalValueEUR > 0
        ? (asset.totalValueEUR / asset.quantity)
        : asset.previousClose * globalRate;

    const globalTotalValue = globalCurrency === 'EUR' && asset.totalValueEUR > 0
        ? asset.totalValueEUR
        : nativeTotalValue * globalRate;

    // derived cost basis: Value / (1 + PL%)
    const globalCostBasis = globalCurrency === 'EUR' && asset.totalValueEUR > 0
        ? asset.totalValueEUR / (1 + (asset.plPercentage / 100))
        : nativeCostBasis * globalRate;

    const globalAvgPrice = globalCostBasis / asset.quantity;

    const totalProfitVal = globalTotalValue - globalCostBasis;
    const totalProfitPct = asset.plPercentage;

    let periodProfitVal = totalProfitVal;
    let periodProfitPct = totalProfitPct;

    // Simplified: Always use total profit
    // Removed 1D/1W/1M/YTD/1Y logic blocks
    // periodProfitVal matches totalProfitVal by default initialization

    const isPeriodProfit = periodProfitVal >= 0;

    const fmt = (val: number, min = 2, max = 2) => {
        let finalMin = min;
        let finalMax = max;

        // SMART FORMATTING STRATEGY
        // If value >= 100, decimals are usually noise. Hide them unless explicitly requested otherwise.
        // We only apply this auto-hide if the caller asked for the default 2 decimals.
        // If caller specifically asked for 0 or 4, we respect that.
        if (Math.abs(val) >= 100 && min === 2 && max === 2) {
            finalMin = 0;
            finalMax = 0;
        }

        return new Intl.NumberFormat('de-DE', { minimumFractionDigits: finalMin, maximumFractionDigits: finalMax }).format(val || 0);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(asset.id);
    };

    // Use logoUrl from database if available, otherwise generate it
    const logoUrl = (asset as any).logoUrl || getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);
    const originalName = (asset as any).originalName;

    // Dynamic Layout Logic
    const columnsCount = columns.length;
    const isUltraHighDensity = columnsCount >= 10;
    const isHighDensity = columnsCount >= 7;
    const isMediumDensity = columnsCount >= 5;

    const fontSizeMain = isUltraHighDensity ? '0.75rem' : isHighDensity ? '0.88rem' : isMediumDensity ? '0.98rem' : '1.1rem';
    const fontSizeSub = isUltraHighDensity ? '0.6rem' : isHighDensity ? '0.68rem' : isMediumDensity ? '0.75rem' : '0.85rem';

    // Premium Row Height & Padding

    const cellPadding = '1rem 0.5rem 0.5rem 0.5rem';
    const gridTemplate = columns.map(c => COL_WIDTHS[c]).join(' ') + ' 40px';

    const commonCellStyles = {
        padding: cellPadding,
        display: 'flex',
        alignItems: 'flex-start',
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap'
    };

    const renderCell = (colId: ColumnId) => {
        const isNumeric = ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId);

        let cellContent = null;
        switch (colId) {
            // SPARK case removed
            case 'PL':
                // For CASH, show "-" since there's no P&L
                if (asset.type === 'CASH') {
                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-start', alignItems: 'flex-end', width: '100%', gap: '4px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: '1.2' }}>-</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                        </div>
                    );
                } else {
                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-start', alignItems: 'flex-end', width: '100%', position: 'relative', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', gap: '4px' }}>
                            <span style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: isPeriodProfit ? 'var(--success)' : 'var(--danger)',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                lineHeight: '1.2'
                            }}>
                                {isPeriodProfit ? '▲' : '▼'} {Math.round(Math.abs(periodProfitPct))}%
                            </span>
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                color: 'var(--text-muted)',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap'
                            }}>
                                {isPeriodProfit ? '+' : ''}{globalSymbol}{fmt(periodProfitVal, 0, 0)}
                            </span>
                        </div>
                    );
                }
                break;
            case 'NAME':
                cellContent = (
                    <div className="col-name" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: 0, width: '100%' }}>
                        <AssetLogo symbol={asset.symbol} type={asset.type} exchange={asset.exchange} name={companyName} logoUrl={logoUrl} size="2.8rem" />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '4px', flex: 1 }}>
                            <>
                                <span
                                    title={originalName || companyName}
                                    style={{
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        lineHeight: '1.2',
                                        cursor: 'default'
                                    }}>
                                    {companyName}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                                        {asset.symbol}
                                    </span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        color: 'var(--accent)',
                                        background: 'var(--accent-glow)', // New var
                                        padding: '2px 6px',
                                        borderRadius: '6px'
                                    }}>
                                        {asset.quantity >= 1000000
                                            ? (asset.quantity / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
                                            : asset.quantity >= 1000
                                                ? (asset.quantity / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
                                                : asset.quantity.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                                    </span>
                                </div>
                            </>
                        </div>
                    </div>
                );
                break;
            case 'PRICE':
                {
                    const dateStr = asset.updatedAt
                        ? new Date(asset.updatedAt).toLocaleString('tr-TR', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                        })
                        : null;

                    if (asset.type === 'CASH') {
                        // CASH always shows "-" for price
                        cellContent = (
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: '1.2' }}>-</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                            </div>
                        );
                    } else {
                        // Show in native currency
                        cellContent = (
                            <div suppressHydrationWarning title={dateStr ? `Closing Price: ${dateStr}` : 'No market data available'} style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', fontVariantNumeric: 'tabular-nums', cursor: 'help', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.2' }}>{nativeSymbol}{fmt(nativePrice)}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{nativeSymbol}{fmt(asset.buyPrice)}</span>
                            </div>
                        );
                    }
                }
                break;

            case 'PRICE_EUR':
                {
                    const dateStr = asset.updatedAt
                        ? new Date(asset.updatedAt).toLocaleString('tr-TR', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                        })
                        : null;

                    // ALWAYS show converted price in global currency
                    if (asset.type === 'CASH') {
                        // CASH always shows "-" for price
                        cellContent = (
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: '1.2' }}>-</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                            </div>
                        );
                    } else {
                        cellContent = (
                            <div suppressHydrationWarning title={dateStr ? `Closing Price: ${dateStr}` : 'No market data available'} style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', fontVariantNumeric: 'tabular-nums', cursor: 'help', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.2' }}>{globalSymbol}{fmt(globalPrice)}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{globalSymbol}{fmt(globalAvgPrice)}</span>
                            </div>
                        );
                    }
                }
                break;
            case 'VALUE':
                // SYSTEMATIC FIX: Only show value if asset currency differs from global currency
                // If same currency, it will be shown in VALUE_EUR column to avoid duplication
                if (asset.currency === globalCurrency) {
                    // Same currency - show in VALUE_EUR column only
                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', fontVariantNumeric: 'tabular-nums', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: '1.2', opacity: 0.4 }}>-</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.4 }}>-</span>
                        </div>
                    );
                } else if (asset.type === 'CASH') {
                    // Different currency CASH - show in native currency
                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', fontVariantNumeric: 'tabular-nums', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.2' }}>{nativeSymbol}{fmt(asset.quantity, 0, 0)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{nativeSymbol}{fmt(asset.quantity, 0, 0)}</span>
                        </div>
                    );
                } else {
                    // Different currency asset - show in native currency
                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', fontVariantNumeric: 'tabular-nums', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.2' }}>{nativeSymbol}{fmt(nativeTotalValue, 0, 0)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{nativeSymbol}{fmt(nativeCostBasis, 0, 0)}</span>
                        </div>
                    );
                }
                break;

            case 'VALUE_EUR':
                // ALWAYS show EUR values regardless of toggle
                if (asset.type === 'CASH') {
                    const displayCashAmount = asset.quantity * globalRate;
                    // For CASH held in EUR, globalRate is 1 (if target EUR), so it works.
                    // Ideally check target currency, but globalRate is to globalCurrency (EUR).

                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', fontVariantNumeric: 'tabular-nums', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.2' }}>{globalSymbol}{fmt(displayCashAmount, 0, 0)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{globalSymbol}{fmt(displayCashAmount, 0, 0)}</span>
                        </div>
                    );
                } else {
                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%', fontVariantNumeric: 'tabular-nums', alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', gap: '4px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.2' }}>{globalSymbol}{fmt(globalTotalValue, 0, 0)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{globalSymbol}{fmt(globalCostBasis, 0, 0)}</span>
                        </div>
                    );
                }
                break;
            // 1D_CHANGE case removed

            case 'EARNINGS':
                cellContent = <div style={{ fontSize: fontSizeSub, opacity: 0.4, textAlign: 'right', width: '100%' }}>-</div>;
                break;
            case 'PORTFOLIO_NAME':
                {
                    const name = (asset.customGroup || '-').toUpperCase();
                    const colors = getPortfolioStyle(name);

                    cellContent = (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 0.8rem',
                            height: '22px',
                            borderRadius: '9999px',
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.02em',
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            {name}
                        </span>
                    );
                }
                break;
        }

        return cellContent;
    };

    return (
        <div
            className="asset-table-grid row-container"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => isGlobalEditMode && onAssetClick?.(asset)}
            style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                minHeight: isUltraHighDensity ? '3rem' : isHighDensity ? '4rem' : '4.8rem',
                borderBottom: 'none',
                padding: '0',
                margin: '0',
                position: 'relative',
                cursor: isGlobalEditMode ? 'pointer' : 'default',
                background: isHovered ? 'rgba(99, 102, 241, 0.08)' : 'transparent', // Unified Row Hover
                borderRadius: '12px', // Modern Card Look
                transition: 'all 0.2s ease',
                width: '100%',
                // alignItems: 'center' removed to allow top-align
                gap: '0'
            }}
        >
            {
                columns.map(colId => {
                    const isNumeric = ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId);
                    const cellContent = renderCell(colId);

                    return (
                        <div key={colId} style={{
                            ...commonCellStyles,
                            padding: cellPadding,
                            justifyContent: isNumeric ? 'flex-end' : 'flex-start',
                            alignItems: colId === 'PORTFOLIO_NAME' ? 'center' : 'flex-start',
                            background: 'transparent', // Handled by row
                            // transition removed from cell
                        }}>
                            {cellContent}
                        </div>
                    );
                })
            }

            {/* Actions Column (Sticky - Seamless) */}
            <div style={{
                ...commonCellStyles,
                justifyContent: 'center',
                position: 'sticky',
                right: 0,
                background: 'transparent',
                zIndex: 5,
                width: '40px',
                padding: 0,
                alignItems: 'center' // Center vertically
            }}>
                <button
                    onClick={(e) => { e.stopPropagation(); onAssetClick?.(asset); }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '6px',
                        cursor: 'pointer',
                        color: isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.2s',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Edit Asset"
                >
                    <MoreVertical size={20} />
                </button>
            </div>
        </div >
    );
}

// Reusable Asset Card Component
function AssetCard({ asset, positionsViewCurrency, totalPortfolioValueEUR, isBlurred, isOwner, onDelete, timeFactor, timePeriod, exchangeRates, isGlobalEditMode, onAssetClick }: {
    asset: AssetDisplay,
    positionsViewCurrency: string,
    totalPortfolioValueEUR: number,
    isBlurred: boolean,
    isOwner: boolean,
    onDelete: (id: string) => void,
    timeFactor: number,
    timePeriod: string,
    exchangeRates?: Record<string, number>,
    isGlobalEditMode?: boolean,
    onAssetClick?: (asset: AssetDisplay) => void
}) {
    const [isHovered, setIsHovered] = useState(false);

    let displayCurrency = positionsViewCurrency === 'ORG' ? asset.currency : positionsViewCurrency;
    const currencySymbol = getCurrencySymbol(displayCurrency);

    let totalVal = 0;
    let totalCost = 0;
    let unitPrice = 0;
    let unitCost = 0;

    if (positionsViewCurrency === 'ORG') {
        totalVal = asset.previousClose * asset.quantity;
        totalCost = asset.buyPrice * asset.quantity;
        unitPrice = asset.previousClose;
        unitCost = asset.buyPrice;
    } else {
        const targetRate = getRate('EUR', displayCurrency, exchangeRates);
        totalVal = asset.totalValueEUR * targetRate;
        const costEUR = asset.totalValueEUR / (1 + asset.plPercentage / 100);
        totalCost = costEUR * targetRate;
        unitPrice = (asset.totalValueEUR / asset.quantity) * targetRate;
        unitCost = (costEUR / asset.quantity) * targetRate;
    }

    const profit = totalVal - totalCost;
    const profitPct = asset.plPercentage;
    const weight = totalPortfolioValueEUR > 0 ? (asset.totalValueEUR / totalPortfolioValueEUR) * 100 : 0;

    let periodProfitVal = profit;
    let periodProfitPctVal = profitPct;

    // Simplified: Always use total profit
    // Removed 1D/1W/1M/YTD/1Y logic blocks

    const isPositive = periodProfitVal >= 0;
    // Use logoUrl from database if available, otherwise generate it
    const logoUrl = (asset as any).logoUrl || getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);
    const originalName = (asset as any).originalName;
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div
            className="neo-card"
            onClick={() => isGlobalEditMode && onAssetClick?.(asset)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'all 0.3s ease',
                filter: isBlurred ? 'blur(8px)' : 'none',
                height: '100%',
                cursor: isGlobalEditMode ? 'pointer' : 'default',
                transform: isGlobalEditMode && isHovered ? 'translateY(-4px)' : 'none',
                border: isGlobalEditMode ? (isHovered ? '2px solid var(--accent)' : '2px solid transparent') : '1px solid var(--border)',
                boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)'
            }}
        >
            {/* Header: Logo & Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <AssetLogo symbol={asset.symbol} type={asset.type} exchange={asset.exchange} name={companyName} logoUrl={logoUrl} size="2.5rem" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.1rem' }}>
                        {companyName}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{asset.symbol}</span>
                    </div>
                </div>

            </div>

            {/* Financials Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Value</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{currencySymbol}{fmt(totalVal)}</p>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Portfolio</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(weight)}%</p>
                </div>
            </div>

            {/* Performance Footer */}
            <div style={{
                marginTop: 'auto',
                background: isPositive ? 'var(--success-bg)' : 'var(--danger-bg)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: `1px solid ${isPositive ? 'var(--success-border)' : 'var(--danger-border)'}`
            }}>
                <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: isPositive ? 'var(--success)' : 'var(--danger)', textTransform: 'uppercase', opacity: 0.8 }}>Performance</p>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                        {isPositive ? '+' : ''}{currencySymbol}{fmt(Math.abs(periodProfitVal))}
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 900, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                        {isPositive ? '▲' : '▼'}{Math.abs(periodProfitPctVal).toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>
    );
}



const AssetGroupHeader = ({
    type,
    count,
    totalEUR,
    percentage,
    currencySymbol,
    rate,
    fmt,
    dragHandleProps,
    isExpanded,
    onToggle,
    gridTemplate,
    columns
}: {
    type: string,
    count: number,
    totalEUR: number,
    percentage: number,
    currencySymbol: string,
    rate: number,
    fmt: (val: number) => string,
    dragHandleProps?: any,
    isExpanded?: boolean,
    onToggle?: () => void,
    gridTemplate?: string,
    columns?: ColumnId[]
}) => {
    const [isHovered, setIsHovered] = useState(false);

    // Icon Mapping
    const getGroupIcon = (type: string) => {
        const t = type.toUpperCase();
        if (t.includes('CRYPTO')) return <Bitcoin size={16} />;
        if (t.includes('STOCK')) return <TrendingUp size={16} />;
        if (t.includes('CASH') || t.includes('FIAT')) return <Wallet size={16} />;
        if (t.includes('ETF') || t.includes('FUND')) return <PieChart size={16} />;
        if (t.includes('COMMODITY') || t.includes('GOLD')) return <Gem size={16} />;
        if (t.includes('CURRENCY')) return <Coins size={16} />;
        return <Layers size={16} />;
    };

    const cellPadding = '0 0.5rem';

    return (
        <div
            {...dragHandleProps}
            onClick={onToggle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="asset-group-header"
            style={{
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: gridTemplate || '1fr',
                alignItems: 'center',
                padding: '0',
                background: 'var(--bg-secondary)',
                borderRadius: '0',
                borderBottom: '1px solid var(--border)',
                marginBottom: '0',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                userSelect: 'none',
                minHeight: '3.2rem'
            }}
        >
            {/* Left Side: Group Info */}
            {columns?.map((colId, idx) => {
                const isFirst = idx === 0;
                const isName = colId === 'NAME';

                return (
                    <div key={colId} style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isFirst || isName ? 'flex-start' : 'center',
                        padding: cellPadding,
                        overflow: 'hidden'
                    }}>
                        {isFirst && (
                            <div style={{
                                color: isExpanded ? 'var(--accent)' : 'var(--text-muted)',
                                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                transition: 'transform 0.3s ease',
                                paddingLeft: '0.4rem'
                            }}>
                                <ChevronDown size={14} />
                            </div>
                        )}
                        {isName && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: isFirst ? '0.4rem' : '0' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '1.6rem', height: '1.6rem',
                                    background: 'var(--accent)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    boxShadow: '0 4px 6px rgba(79, 70, 229, 0.2)'
                                }}>
                                    {getGroupIcon(type)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{type}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{count} Assets</span>
                                </div>
                            </div>
                        )}
                        {idx === columns.length - 1 && (
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', paddingRight: '1rem' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 900, background: 'var(--surface)', color: 'var(--accent)', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                                    {percentage.toFixed(0)}%
                                </div>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{currencySymbol}{fmt(totalEUR * rate)}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// Actually simpler: Just accept the header props and grid children?
// Or just let this component render the header and children.

const AssetGroupGridWrapper = ({
    header,
    children,
    dragHandleProps
}: {
    header: React.ReactNode,
    children: React.ReactNode,
    dragHandleProps?: any
}) => {
    return (
        <div style={{ marginBottom: '0' }}>
            {/* Inject drag handle into header */}
            {React.isValidElement(header)
                ? React.cloneElement(header as React.ReactElement<any>, { dragHandleProps })
                : header}
            {children}
        </div>
    );
};

function AssetGroup({
    type,
    assets,
    totalEUR,
    positionsViewCurrency,
    totalPortfolioValueEUR,
    isOwner,
    onDelete,
    timeFactor,
    dragHandleProps,
    columns,
    timePeriod,
    exchangeRates,
    isGlobalEditMode,
    onAssetClick
}: {
    type: string,
    assets: AssetDisplay[],
    totalEUR: number,
    positionsViewCurrency: string,
    totalPortfolioValueEUR: number,
    isOwner: boolean,
    onDelete: (id: string) => void,
    timeFactor: number,
    dragHandleProps?: any,
    columns?: ColumnId[],
    timePeriod: string,
    exchangeRates?: Record<string, number>,
    isGlobalEditMode?: boolean,
    onAssetClick?: (asset: AssetDisplay) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false); // Default: Collapsed

    const rate = positionsViewCurrency === 'ORIGINAL' ? 1 : (exchangeRates?.[positionsViewCurrency] || 1);
    const displayCurrency = positionsViewCurrency === 'ORIGINAL' ? 'EUR' : positionsViewCurrency;
    const currencySymbol = getCurrencySymbol(displayCurrency);

    const fmt = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

    return (
        <div style={{ marginBottom: '0' }}>
            <AssetGroupHeader
                type={type}
                count={assets?.length || 0}
                totalEUR={totalEUR}
                percentage={(totalEUR / (totalPortfolioValueEUR || 1)) * 100}
                currencySymbol={currencySymbol}
                rate={rate}
                fmt={fmt}
                dragHandleProps={dragHandleProps}
                isExpanded={isExpanded}
                onToggle={() => setIsExpanded(!isExpanded)}
                gridTemplate={columns ? columns.map(c => COL_WIDTHS[c]).join(' ') : '1fr'}
                columns={columns}
            />

            {/* Assets in Group - Collapsible */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: isExpanded ? '2000px' : '0',
                opacity: isExpanded ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                paddingLeft: '0', // No Indent
                gap: '8px' // Increased row gap
            }}>
                <SortableContext items={(assets || []).map(a => a.id)} strategy={verticalListSortingStrategy}>
                    {(assets || []).map(asset => (
                        <SortableAssetRow key={asset.id} id={asset.id}>
                            <AssetTableRow
                                asset={asset}
                                positionsViewCurrency={positionsViewCurrency}
                                totalPortfolioValueEUR={totalPortfolioValueEUR}
                                isOwner={isOwner}
                                onDelete={onDelete}
                                timeFactor={timeFactor}
                                columns={columns}
                                timePeriod={timePeriod}
                                exchangeRates={exchangeRates}
                                isGlobalEditMode={isGlobalEditMode}
                                onAssetClick={onAssetClick}
                            />
                        </SortableAssetRow>
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}

// New Component for Grid View Groups (to handle expansion state)
function AssetGroupGrid({
    type,
    assets,
    groupTotal,
    totalPortfolioValueEUR,
    positionsViewCurrency,
    viewMode,
    gridColumns,
    isBlurred,
    isOwner,
    onDelete,
    timeFactor,
    dragHandleProps,
    timePeriod,
    exchangeRates,
    isGlobalEditMode,
    onAssetClick
}: {
    type: string,
    assets: AssetDisplay[],
    groupTotal: number,
    totalPortfolioValueEUR: number,
    positionsViewCurrency: string,
    viewMode: string,
    gridColumns: number,
    isBlurred: boolean,
    isOwner: boolean,
    onDelete: (id: string) => void,
    timeFactor: number,
    dragHandleProps?: any,
    timePeriod: string,
    exchangeRates?: Record<string, number>,
    isGlobalEditMode?: boolean,
    onAssetClick?: (asset: AssetDisplay) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false); // Default: Collapsed

    const rate = (positionsViewCurrency as string) === 'ORIGINAL' ? 1 : (exchangeRates?.[positionsViewCurrency] || 1);
    const displayCurrency = (positionsViewCurrency as string) === 'ORIGINAL' ? 'EUR' : positionsViewCurrency;
    const currencySymbol = getCurrencySymbol(displayCurrency);
    const fmt = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

    return (
        <div style={{ marginBottom: '1rem' }}>
            {/* Header */}
            <AssetGroupHeader
                type={type}
                count={assets?.length || 0}
                totalEUR={groupTotal}
                percentage={(groupTotal / (totalPortfolioValueEUR || 1)) * 100}
                currencySymbol={currencySymbol}
                rate={rate}
                fmt={fmt}
                dragHandleProps={dragHandleProps}
                isExpanded={isExpanded}
                onToggle={() => setIsExpanded(!isExpanded)}
            />

            {/* Grid Content - Collapsible */}
            <div style={{
                maxHeight: isExpanded ? '5000px' : '0',
                opacity: isExpanded ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'grid',
                gridTemplateColumns: viewMode === 'list'
                    ? '1fr'
                    : `repeat(${gridColumns}, 1fr)`,
                gap: '1rem',
                marginTop: isExpanded ? '0.5rem' : '0'
            }}>
                <SortableContext items={assets.map(i => i.id)} strategy={rectSortingStrategy}>
                    {assets.map((asset) => {
                        return (
                            <SortableAssetCard key={asset.id} id={asset.id}>
                                {viewMode === 'detailed' ? (
                                    <DetailedAssetCard
                                        asset={asset}
                                        positionsViewCurrency={positionsViewCurrency}
                                        totalPortfolioValueEUR={totalPortfolioValueEUR}
                                        isBlurred={isBlurred}
                                        isOwner={isOwner}
                                        onDelete={onDelete}
                                        timeFactor={timeFactor}
                                        timePeriod={timePeriod}
                                    />
                                ) : (
                                    <AssetCard
                                        asset={asset}
                                        positionsViewCurrency={positionsViewCurrency}
                                        totalPortfolioValueEUR={totalPortfolioValueEUR}
                                        isBlurred={isBlurred}
                                        isOwner={isOwner}
                                        onDelete={onDelete}
                                        timeFactor={timeFactor}
                                        timePeriod={timePeriod}
                                        isGlobalEditMode={isGlobalEditMode}
                                        onAssetClick={onAssetClick}
                                    />
                                )}
                            </SortableAssetCard>
                        );
                    })}
                </SortableContext>
            </div>
        </div>
    );
}




export default function Dashboard({ username, isOwner, totalValueEUR, assets, goals, isBlurred, showChangelog = false, exchangeRates, positionsViewCurrency: positionsViewCurrencyProp, preferences }: DashboardProps) {
    const { t } = useLanguage();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    const router = useRouter();
    // Initialize items with default sort (Weight Descending)
    // Initialize items with default sort (Rank then Value)
    // Fix: Initialize with assets prop to avoid hydration mismatch/flash
    const [items, setItems] = useState<AssetDisplay[]>(assets);
    const [orderedGroups, setOrderedGroups] = useState<string[]>([]);
    const [isGroupingEnabled, setIsGroupingEnabled] = useState(false);
    const viewMode = "list";
    const [gridColumns, setGridColumns] = useState<1 | 2>(2);

    const translatedColumns = useMemo(() => {
        return ALL_COLUMNS.map(col => {
            let label = col.label;
            if (col.id === 'NAME') label = t('name_col');
            else if (col.id === 'PRICE') label = t('price_col');
            else if (col.id === 'VALUE') label = t('value_col');
            else if (col.id === 'PL') label = t('pl_col');
            else if (col.id === 'PORTFOLIO_NAME') label = t('portfolio_cat');
            return { ...col, label };
        });
    }, [t]);
    const [timePeriod, setTimePeriod] = useState("ALL");

    // Global Edit Mode State
    const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
    const [editingAsset, setEditingAsset] = useState<AssetDisplay | null>(null);

    // DEBUG: Deployment Check
    const [isTimeSelectorHovered, setIsTimeSelectorHovered] = useState(false);
    const [isGroupingSelectorHovered, setIsGroupingSelectorHovered] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [periodDropdownPos, setPeriodDropdownPos] = useState({ top: 0, left: 0 });

    // Delete Confirmation State
    const [assetToDelete, setAssetToDelete] = useState<AssetDisplay | null>(null);

    // Column State
    // Fix: Initialize with preferences if available, else Defaults
    const [activeColumns, setActiveColumns] = useState<ColumnId[]>(
        (preferences?.columns && Array.isArray(preferences.columns))
            ? preferences.columns
            : translatedColumns.filter(c => c.isDefault).map(c => c.id)
    );
    const [isAdjustListOpen, setIsAdjustListOpen] = useState(false);
    const [filterPage, setFilterPage] = useState(0); // 0 = Default, 1 = Scrolled Right
    const [searchQuery, setSearchQuery] = useState("");

    // Persist Columns & Load from LocalStorage on Mount
    useEffect(() => {
        // Load from LocalStorage ONLY if no preferences from DB
        if (!preferences?.columns) {
            const saved = localStorage.getItem('user_columns');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        const validColumns = parsed.filter((id: string) => translatedColumns.some(c => c.id === id));
                        if (validColumns.length > 0) {
                            setActiveColumns(validColumns);
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse user columns", e);
                }
            }
        }
    }, [preferences?.columns]);

    useEffect(() => {
        // Save to LocalStorage AND Database
        if (activeColumns.length > 0) {
            localStorage.setItem('user_columns', JSON.stringify(activeColumns));

            // Debounce DB update to avoid spamming on rapid changes (if needed, but for now direct call on settling state is fine)
            // Using a timeout to debounce effectively
            const timer = setTimeout(() => {
                updateUserPreferences({ columns: activeColumns }).catch(e => console.error("Failed to save preferences", e));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [activeColumns]);

    const { currency: globalCurrency } = useCurrency();
    const positionsViewCurrency = positionsViewCurrencyProp || globalCurrency;

    // Update items when assets prop changes (initial load or refetch)
    useEffect(() => {
        // Assets are already sorted by sortOrder in the server query
        // Don't re-sort here to preserve user's custom order
        setItems(assets);
    }, [assets]);

    // Force List View on Mobile (Redundant as View Mode is hardcoded to List)
    // useEffect removed

    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Filter states
    const [activeFilterCategory, setActiveFilterCategory] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [exchangeFilter, setExchangeFilter] = useState<string | null>(null);
    const [currencyFilter, setCurrencyFilter] = useState<string | null>(null);
    const [countryFilter, setCountryFilter] = useState<string | null>(null);
    const [sectorFilter, setSectorFilter] = useState<string | null>(null);
    const [platformFilter, setPlatformFilter] = useState<string | null>(null);
    const [customGroupFilter, setCustomGroupFilter] = useState<string | null>(null);

    // Filter UI States

    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const [filterOrder, setFilterOrder] = useState(['customGroup', 'type', 'exchange', 'currency', 'country', 'sector', 'platform']);
    const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['NDX', 'SPX', 'BTC']);
    const [isPortfolioVisible, setIsPortfolioVisible] = useState(true);
    const [isCompareOpen, setIsCompareOpen] = useState(false);

    // Filter assets
    const filteredAssets = useMemo(() => {
        return items.filter(asset => {
            if (typeFilter && asset.type !== typeFilter) return false;
            if (exchangeFilter && asset.exchange !== exchangeFilter) return false;
            if (currencyFilter && asset.currency !== currencyFilter) return false;
            if (countryFilter && asset.country !== countryFilter) return false;
            if (sectorFilter && asset.sector !== sectorFilter) return false;
            if (platformFilter && asset.platform !== platformFilter) return false;
            if (customGroupFilter && (asset.customGroup || 'Main Portfolio') !== customGroupFilter) return false;
            return true;
        });
    }, [items, typeFilter, exchangeFilter, currencyFilter, countryFilter, sectorFilter, platformFilter, customGroupFilter]);

    // Memoize sorted assets
    const sortedAssets = useMemo(() => {
        // Assuming a sortConfig state exists or is defined elsewhere for sorting
        // For now, let's use a default sort or assume `items` are already sorted if no explicit sortConfig is provided.
        // If `sortConfig` is not defined, this will need to be adjusted.
        // For the purpose of this edit, I'll assume a `sortConfig` exists or use a placeholder.
        // Let's use the initial sort from `useEffect` for now if no `sortConfig` is available.
        // If `sortConfig` is meant to be a state, it should be declared.
        // For now, I'll use a placeholder sort that keeps the order from `filteredAssets`.
        return [...filteredAssets].sort((a, b) => {
            // Sort by Value (Descending) - rank field removed
            return b.totalValueEUR - a.totalValueEUR;
        });
    }, [filteredAssets]); // Add sortConfig to dependencies if it becomes a state

    // Grouping State: 'none' | 'customGroup' | 'type' | 'country' | 'sector' | 'platform'
    const [groupingKey, setGroupingKey] = useState<string>('none');

    // ... (rest of imports)

    // Grouping Logic
    const groupedAssets = useMemo(() => {
        if (groupingKey === 'none') return { 'All Assets': sortedAssets };

        return sortedAssets.reduce((acc, asset) => {
            let key = 'Other';

            if (groupingKey === 'customGroup') key = asset.customGroup || 'Main Portfolio';
            else if (groupingKey === 'type') key = asset.type;
            else if (groupingKey === 'country') key = asset.country || 'Unknown';
            else if (groupingKey === 'sector') key = asset.sector || 'Unknown';
            else if (groupingKey === 'platform') key = asset.platform || 'Unknown';

            if (!acc[key]) acc[key] = [];
            acc[key].push(asset);
            return acc;
        }, {} as Record<string, AssetDisplay[]>);
    }, [sortedAssets, groupingKey]);


    const groupTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        Object.keys(groupedAssets).forEach(type => {
            totals[type] = groupedAssets[type].reduce((sum, a) => sum + a.totalValueEUR, 0);
        });
        return totals;
    }, [groupedAssets]);

    // Initial group order sorted by total value
    useEffect(() => {
        if (orderedGroups.length === 0 || Object.keys(groupTotals).length !== orderedGroups.length) {
            const sortedGroups = Object.keys(groupTotals).sort((a, b) => groupTotals[b] - groupTotals[a]);
            setOrderedGroups(sortedGroups);
        }
    }, [groupTotals, orderedGroups.length]);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over) return;

        if (active.id.toString().startsWith('group:')) {
            const oldGroup = active.id.toString().replace('group:', '');
            const newGroup = over.id.toString().replace('group:', '');
            const oldIndex = orderedGroups.indexOf(oldGroup);
            const newIndex = orderedGroups.indexOf(newGroup);
            if (oldIndex !== -1 && newIndex !== -1) {
                setOrderedGroups(arrayMove(orderedGroups, oldIndex, newIndex));
            }
        } else if (active.id !== over.id) {
            // Check if dragging columns config
            if (active.id.toString().startsWith('col:')) {
                const oldId = active.id.toString().replace('col:', '') as ColumnId;
                const newId = over.id.toString().replace('col:', '') as ColumnId;

                setActiveColumns((items) => {
                    const oldIndex = items.indexOf(oldId);
                    const newIndex = items.indexOf(newId);
                    return arrayMove(items, oldIndex, newIndex);
                });
                return;
            }

            // Asset reordering: Save new positions to database
            const activeAssetId = active.id.toString();
            const overAssetId = over.id.toString();

            // Find the assets in the current list (use items state, not props)
            const oldIndex = items.findIndex(a => a.id === activeAssetId);
            const newIndex = items.findIndex(a => a.id === overAssetId);

            if (oldIndex !== -1 && newIndex !== -1) {
                // Reorder the assets array
                const reorderedAssets = arrayMove(items, oldIndex, newIndex);

                // Update local state immediately for smooth UX
                setItems(reorderedAssets);

                // Extract the new order of IDs
                const newOrder = reorderedAssets.map(a => a.id);

                // Save to database in background (no page refresh)
                reorderAssets(newOrder).catch(err => {
                    console.error('Failed to save asset order:', err);
                    // Revert on error
                    setItems(items);
                });
            }
        }
    }

    const handleDelete = (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset) setAssetToDelete(asset);
    };

    const confirmDelete = async () => {
        if (!assetToDelete) return;
        await deleteAsset(assetToDelete.id);
        setAssetToDelete(null);
        router.refresh();
    };



    const isDragEnabled = !activeFilterCategory && !typeFilter && !exchangeFilter && !currencyFilter && !countryFilter && !sectorFilter && !platformFilter && !customGroupFilter && groupingKey === 'none';

    // Calculate time-based profit
    const getTimeFactor = () => {
        switch (timePeriod) {
            case "1D": return 0.05;
            case "1W": return 0.2;
            case "1M": return 0.5;
            case "YTD": return 0.7;
            case "1Y": return 0.9;
            default: return 1;
        }
    };

    const pLTitle = `P&L (${timePeriod})`;

    // Smart Filtering: Get unique values based on currently filtered assets
    // This ensures filter options only show what's available given active filters
    const getFilteredAssets = () => {
        return items.filter(asset => {
            if (typeFilter && asset.type !== typeFilter) return false;
            if (exchangeFilter && asset.exchange !== exchangeFilter) return false;
            if (currencyFilter && asset.currency !== currencyFilter) return false;
            if (countryFilter && asset.country !== countryFilter) return false;
            if (sectorFilter && asset.sector !== sectorFilter) return false;
            if (platformFilter && asset.platform !== platformFilter) return false;
            if (customGroupFilter && (asset.customGroup || 'Main Portfolio') !== customGroupFilter) return false;
            return true;
        });
    };

    const availableAssets = getFilteredAssets();

    // Get unique values for each filter from available assets
    const types = Array.from(new Set(availableAssets.map(a => a.type).filter(Boolean))) as string[];
    const exchanges = Array.from(new Set(availableAssets.map(a => a.exchange).filter(Boolean))) as string[];
    const currencies = Array.from(new Set(availableAssets.map(a => a.currency).filter(Boolean))) as string[];
    const countries = Array.from(new Set(availableAssets.map(a => a.country).filter(Boolean))) as string[];
    const sectors = Array.from(new Set(availableAssets.map(a => a.sector).filter(Boolean))) as string[];
    const platforms = Array.from(new Set(availableAssets.map(a => a.platform).filter(Boolean))) as string[];
    const customGroups = Array.from(new Set(availableAssets.map(a => a.customGroup || 'Main Portfolio'))) as string[];

    // List of all possible filter categories
    const allCategories = [
        { id: 'customGroup', label: t('portfolio_cat'), items: customGroups, active: customGroupFilter, setter: setCustomGroupFilter, icon: '📁' },
        { id: 'type', label: t('type_cat'), items: types, active: typeFilter, setter: setTypeFilter, icon: '🏷️' },
        { id: 'exchange', label: t('exchange_cat'), items: exchanges, active: exchangeFilter, setter: setExchangeFilter, icon: '📍' },
        { id: 'currency', label: t('currency_cat'), items: currencies, active: currencyFilter, setter: setCurrencyFilter, icon: '💱' },
        { id: 'country', label: t('country_cat'), items: countries, active: countryFilter, setter: setCountryFilter, icon: '🌍' },
        { id: 'sector', label: t('sector_cat'), items: sectors, active: sectorFilter, setter: setSectorFilter, icon: '🏢' },
        { id: 'platform', label: t('platform_cat'), items: platforms, active: platformFilter, setter: setPlatformFilter, icon: '🏦' },
    ];

    // Sorted filter categories based on user customization
    const filterCategories = useMemo(() => {
        return filterOrder
            .map(id => allCategories.find(c => c.id === id))
            .filter(Boolean) as typeof allCategories;
    }, [filterOrder, customGroupFilter, typeFilter, exchangeFilter, currencyFilter, countryFilter, sectorFilter, platformFilter, customGroups, types, exchanges, currencies, countries, sectors, platforms]);

    // Filtered Total Calculation
    const filteredTotalValueEUR = useMemo(() => {
        return availableAssets.reduce((sum, asset) => sum + asset.totalValueEUR, 0);
    }, [availableAssets]);

    const displayCurrencyForTotal = positionsViewCurrency === 'ORG' ? 'EUR' : positionsViewCurrency;
    const conversionRateForTotal = (displayCurrencyForTotal === 'EUR') ? 1 : (exchangeRates?.[displayCurrencyForTotal] || 1);
    const filteredTotalConverted = filteredTotalValueEUR * conversionRateForTotal;
    const filteredTotalPercentage = totalValueEUR > 0 ? (filteredTotalValueEUR / totalValueEUR) * 100 : 0;

    const fmtMinimal = (val: number) =>
        new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val || 0);


    // Close Adjust List on outside click
    // State for dropdown positioning
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    // Close Adjust List on outside click
    const adjustListRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (adjustListRef.current && !adjustListRef.current.contains(event.target as Node)) {
                setIsAdjustListOpen(false);
            }
            // Close filter dropdown on click outside
            if (activeFilterCategory && !(event.target as Element).closest('.filter-btn') && !(event.target as Element).closest('.filter-dropdown')) {
                setActiveFilterCategory(null);
            }
        };

        if (isAdjustListOpen || activeFilterCategory || isPeriodDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAdjustListOpen, activeFilterCategory, isPeriodDropdownOpen]);

    const activeFiltersCount = [typeFilter, exchangeFilter, currencyFilter, countryFilter, sectorFilter, platformFilter, customGroupFilter].filter(Boolean).length;


    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isBlurredState, setIsBlurredState] = useState(isBlurred);

    // Benchmark & Chart Controls (Lifted State)


    const toggleBenchmark = (id: string) => {
        setSelectedBenchmarks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await refreshPortfolioPrices();
            if (res.error) {
                alert(res.error);
            }
        } finally {
            setIsRefreshing(false);
            router.refresh();
        }
    };

    // Use a unique ID for DndContext to prevent hydration mismatches with server rendering
    const dndContextId = useId();

    return (
        <DndContext
            id="dashboard-dnd-context"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div id="dnd-wrapper">
                <div className="dashboard-layout-container">

                    {/* LEFT COLUMN: Main Content (Filters + Assets) - Flex Grow */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>

                        {/* Portfolio Performance Chart */}
                        <PortfolioPerformanceChart
                            username={username}
                            totalValueEUR={totalValueEUR}
                            selectedBenchmarks={selectedBenchmarks}
                            isPortfolioVisible={isPortfolioVisible}
                            onToggleBenchmark={toggleBenchmark}
                            onTogglePortfolio={() => setIsPortfolioVisible(!isPortfolioVisible)}
                            onPeriodChange={(period) => {
                                // Sync with dashboard time period if needed
                                console.log('Period changed to:', period);
                            }}
                        />


                        {/* 1. Smart Filter Bar (Maximized Space + Bottom Clear) */}
                        <div className="neo-card" style={{
                            padding: '0.6rem 0.8rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                            zIndex: 60,
                            position: 'relative',
                            width: '100%',
                        }}>
                            <style jsx>{`
                                .no-scrollbar::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>

                            {/* ROW 1: Filters (Full Width, Single Line) */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                width: '100%',
                            }}>
                                <div style={{ display: 'flex', gap: '0.3rem', flex: 1, minWidth: 0, alignItems: 'center' }}>

                                    {/* Left Arrow (Only on Page 1) */}
                                    {filterPage === 1 && (
                                        <button
                                            onClick={() => setFilterPage(0)}
                                            style={{
                                                height: '2.4rem',
                                                width: '2.4rem',
                                                padding: 0,
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '50%', // Circle
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                flexShrink: 0
                                            }}
                                            className="hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                    )}

                                    {/* Filters: Animated Sliding Effect */}
                                    {filterCategories.map((category, index) => {
                                        // Logic for visibility
                                        // Indices 0,1: Show on Page 0 only
                                        // Indices 2,3,4: Always Show (Anchors)
                                        // Indices 5,6: Show on Page 1 only
                                        const isVisible = (index < 2 && filterPage === 0) || (index >= 2 && index <= 4) || (index > 4 && filterPage === 1);

                                        return (
                                            <div key={category.id} style={{
                                                position: 'relative',
                                                flex: isVisible ? '1 1 auto' : '0 0 0',
                                                minWidth: 0,
                                                maxWidth: isVisible ? '160px' : '0px',
                                                opacity: isVisible ? 1 : 0,
                                                transform: `scale(${isVisible ? 1 : 0.9})`,
                                                overflow: 'hidden',
                                                transition: 'all 1.5s cubic-bezier(0.25, 1, 0.5, 1)', // Slower, smoother ease-out
                                                marginLeft: isVisible ? '0' : '-0.3rem', // Counteract parent gap when hidden (approx)
                                                pointerEvents: isVisible ? 'auto' : 'none',
                                                visibility: isVisible ? 'visible' : 'hidden' // Ensure it's hidden from screen readers/tab when closed
                                            }}>
                                                <button
                                                    className="filter-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (activeFilterCategory === category.id) {
                                                            setActiveFilterCategory(null);
                                                        } else {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setDropdownPos({ top: rect.bottom + 5, left: rect.left });
                                                            setActiveFilterCategory(category.id);
                                                        }
                                                    }}
                                                    style={{
                                                        background: category.active ? '#4F46E5' : 'var(--bg-secondary)',
                                                        border: 'none',
                                                        borderRadius: 'var(--radius-md)',
                                                        color: category.active ? '#fff' : 'var(--text-secondary)',
                                                        boxShadow: category.active ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'none',
                                                        padding: '0 0.7rem',
                                                        height: '2.4rem',
                                                        width: '100%', // Takes full width of container
                                                        minWidth: 'max-content', // Prevent text squashing during transition
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'background 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.5rem',
                                                        whiteSpace: 'nowrap',
                                                        fontFamily: 'inherit'
                                                    }}
                                                    title={category.label}
                                                    tabIndex={isVisible ? 0 : -1}
                                                >
                                                    <span style={{ fontSize: '0.8rem', opacity: 0.7, flexShrink: 0 }}>{category.icon}</span>
                                                    <span style={{
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        maxWidth: '110px'
                                                    }}>{category.active ? category.active : category.label}</span>
                                                    <ChevronDown size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
                                                </button>

                                                {/* Dropdown Menu (Fixed Position via Portal) */}
                                                {activeFilterCategory === category.id && category.items.length > 0 && createPortal(
                                                    <div
                                                        className="filter-dropdown"
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            position: 'fixed',
                                                            top: dropdownPos.top,
                                                            left: dropdownPos.left,
                                                            background: 'var(--surface)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '1rem',
                                                            padding: '0.5rem',
                                                            minWidth: '200px',
                                                            maxHeight: '350px',
                                                            overflowY: 'auto',
                                                            zIndex: 9999,
                                                            boxShadow: 'var(--shadow-md)'
                                                        }}>
                                                        {category.items.map(item => (
                                                            <button
                                                                key={item}
                                                                onClick={() => {
                                                                    category.setter(category.active === item ? null : item);
                                                                    setActiveFilterCategory(null);
                                                                }}
                                                                className="dropdown-item"
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '0.7rem 1rem',
                                                                    background: category.active === item ? 'var(--bg-secondary)' : 'transparent',
                                                                    border: 'none',
                                                                    borderRadius: '0.4rem',
                                                                    color: category.active === item ? 'var(--accent)' : 'var(--text-secondary)',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: category.active === item ? 700 : 500,
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left',
                                                                    transition: 'all 0.2s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    marginBottom: '0.1rem',
                                                                }}
                                                            >
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</span>
                                                                {category.active === item ? <Check size={14} /> : <span style={{ opacity: 0.2 }}>➜</span>}
                                                            </button>
                                                        ))}
                                                    </div>,
                                                    document.body
                                                )}
                                            </div>
                                        )
                                    })}

                                    <div style={{ width: '1px', height: '1.4rem', background: 'var(--border)', margin: '0 0.4rem', alignSelf: 'center' }}></div>

                                    {/* Right Arrow (Only on Page 0) - Replaces 'More Filters' */}
                                    {filterPage === 0 && (
                                        <button
                                            onClick={() => setFilterPage(1)}
                                            style={{
                                                height: '2.4rem',
                                                width: '2.4rem', // Square/Circle
                                                padding: 0,
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '50%', // Circle
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                flexShrink: 0
                                            }}
                                            className="hover:bg-gray-100 dark:hover:bg-gray-800"
                                            title="More Filters"
                                        >
                                            <ChevronRight size={16} />
                                            {/* Optional Badge if hidden filters are active */}
                                            {filterCategories.slice(5).filter(c => c.active).length > 0 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: -2,
                                                    right: -2,
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: 'var(--accent)',
                                                    border: '1px solid var(--surface)'
                                                }} />
                                            )}
                                        </button>
                                    )}

                                </div>
                            </div>

                            {/* ROW 2: Filter Summary (Dynamic & Minimal) */}
                            {activeFiltersCount > 0 && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.6rem 0.4rem 0.2rem 0.4rem',
                                    marginTop: '0.4rem',
                                    borderTop: '1px solid var(--border-muted)',
                                    animation: 'fadeIn 0.3s ease-out'
                                }}>
                                    {/* Left: Clear Action */}
                                    <button
                                        onClick={() => {
                                            setTypeFilter(null);
                                            setExchangeFilter(null);
                                            setCurrencyFilter(null);
                                            setCountryFilter(null);
                                            setSectorFilter(null);
                                            setPlatformFilter(null);
                                            setCustomGroupFilter(null);
                                        }}
                                        className="group"
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            borderRadius: 'var(--radius-sm)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--bg-secondary)';
                                            e.currentTarget.style.color = 'var(--text-primary)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = 'var(--text-muted)';
                                        }}
                                    >
                                        <X size={14} />
                                        <span style={{ letterSpacing: '0.02em' }}>{t('clear_filters')}</span>
                                    </button>

                                    {/* Right: Info Group */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('assets')}:</span>
                                            <span style={{
                                                background: 'transparent',
                                                padding: '0',
                                                borderRadius: '0',
                                                fontWeight: 800,
                                                color: 'var(--text-primary)',
                                                fontVariantNumeric: 'tabular-nums'
                                            }}>
                                                {availableAssets.length}
                                            </span>
                                        </div>

                                        <div style={{ width: '1px', height: '0.8rem', background: 'var(--border-muted)' }}></div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('total')}:</span>
                                            <span style={{
                                                fontWeight: 800,
                                                color: 'var(--accent)',
                                                fontVariantNumeric: 'tabular-nums'
                                            }}>
                                                {getCurrencySymbol(displayCurrencyForTotal)}{fmtMinimal(filteredTotalConverted)}
                                            </span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: '#10b981',
                                                background: 'transparent',
                                                padding: '0',
                                                borderRadius: '0',
                                                border: '1px solid rgba(16, 185, 129, 0.12)',
                                                fontVariantNumeric: 'tabular-nums'
                                            }}>
                                                {filteredTotalPercentage.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}




                        </div>


                        {/* 3. Positions List Box */}

                        <div className="neo-card" style={{
                            padding: '0',
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-md)',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-lg)',
                            marginTop: '0.5rem'
                        }}>
                            {/* ASSETS BODY */}
                            <div style={{ minHeight: '400px' }}>
                                {showChangelog ? (
                                    <ChangelogView />
                                ) : (
                                    <>
                                        {viewMode === "list" ? (
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                width: '100%',
                                                background: 'var(--surface)',
                                                borderRadius: 'var(--radius-lg)',
                                                border: '1px solid var(--border)',
                                                boxShadow: 'var(--shadow-sm)',
                                                overflow: 'hidden'
                                            }}>
                                                {/* Table Header Always Show in List View */}
                                                {true && (
                                                    <div className="asset-table-header" style={{
                                                        alignItems: 'center',
                                                        display: 'grid',
                                                        gridTemplateColumns: activeColumns.map(c => COL_WIDTHS[c]).join(' ') + ' 40px',
                                                        gap: 0,
                                                        position: 'relative',
                                                        zIndex: 40,
                                                        paddingTop: '0.75rem',
                                                        paddingBottom: '0.75rem',
                                                        borderBottom: '1px solid var(--border)',
                                                        background: 'var(--bg-secondary)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 700,
                                                        transition: 'background 0.3s'
                                                    }}>
                                                        <SortableContext items={activeColumns.map(c => `col:${c}`)} strategy={rectSortingStrategy}>
                                                            {activeColumns.map(colId => {
                                                                const colDef = ALL_COLUMNS.find(c => c.id === colId);
                                                                let label = (colDef?.headerLabel || colDef?.label || colId).toUpperCase();

                                                                // Dynamic label shortening for high column counts
                                                                if (activeColumns.length >= 7) {
                                                                    if (colId === 'EXCHANGE') label = 'EXCH.';
                                                                    // if (colId === 'CURRENCY') label = 'CCY'; // Removed legacy logic
                                                                }

                                                                // Dynamic Header Labels for Currency
                                                                const globalCurrency = positionsViewCurrency === 'ORG' ? 'EUR' : positionsViewCurrency;
                                                                const globalSym = getCurrencySymbol(globalCurrency);

                                                                let headerContent: React.ReactNode = label;

                                                                if (colId === 'CURRENCY') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <Banknote size={12} strokeWidth={2.5} style={{ opacity: 0.8 }} />
                                                                            <span>FX</span>
                                                                        </div>
                                                                    );
                                                                } else if (colId === 'PRICE') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
                                                                            <span>PRICE</span>
                                                                            <span style={{ fontSize: '0.6rem', opacity: 0.75, fontWeight: 500 }}>COST</span>
                                                                        </div>
                                                                    );
                                                                } else if (colId === 'PRICE_EUR') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
                                                                            <span>PRICE ({globalSym})</span>
                                                                            <span style={{ fontSize: '0.6rem', opacity: 0.75, fontWeight: 500 }}>COST ({globalSym})</span>
                                                                        </div>
                                                                    );
                                                                } else if (colId === 'VALUE') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                                                                            <span>Total Value</span>
                                                                            <span style={{ fontSize: '0.6rem', opacity: 0.75, fontWeight: 500 }}>Total Cost</span>
                                                                        </div>
                                                                    );
                                                                } else if (colId === 'VALUE_EUR') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
                                                                            <span>Total Value ({globalSym})</span>
                                                                            <span style={{ fontSize: '0.6rem', opacity: 0.75, fontWeight: 500 }}>Total Cost ({globalSym})</span>
                                                                        </div>
                                                                    );
                                                                }


                                                                return (
                                                                    <DraggableHeader key={colId} id={`col:${colId}`} columnsCount={activeColumns.length}>
                                                                        <div style={{
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            alignItems: ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId) ? 'flex-end' : 'flex-start',
                                                                            justifyContent: 'center',
                                                                            height: '100%',
                                                                            width: '100%',
                                                                            paddingTop: '0.6rem',
                                                                            paddingBottom: '0.6rem',
                                                                            paddingLeft: '0.5rem',
                                                                            paddingRight: ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId) ? '0.5rem' : '0.5rem',
                                                                            opacity: 0.9
                                                                        }}>
                                                                            {colId === 'PORTFOLIO_NAME' ? (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                                                                    <Briefcase size={14} strokeWidth={2.5} style={{ opacity: 0.8 }} />
                                                                                </div>
                                                                            ) : (
                                                                                <div style={{
                                                                                    fontSize: '0.75rem', // Increased size for readability
                                                                                    fontWeight: 700,
                                                                                    color: 'var(--text-secondary)', // Brighter text
                                                                                    letterSpacing: '0.02em',
                                                                                    textTransform: 'uppercase',
                                                                                    lineHeight: 1.3,
                                                                                    width: '100%',
                                                                                    textAlign: ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId) ? 'right' : 'left',
                                                                                    display: 'flex',
                                                                                    flexDirection: 'column',
                                                                                    alignItems: ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId) ? 'flex-end' : 'flex-start',
                                                                                }}>
                                                                                    {headerContent}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </DraggableHeader>
                                                                );
                                                            })}
                                                        </SortableContext>

                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            position: 'sticky',
                                                            right: 0,
                                                            background: 'var(--bg-secondary)', // Matches header
                                                            zIndex: 20,
                                                            width: '40px',
                                                            padding: 0
                                                        }}>
                                                            <button
                                                                onClick={() => setIsAdjustListOpen(true)}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    color: 'var(--text-muted)',
                                                                    padding: '6px',
                                                                    transition: 'all 0.2s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    opacity: 0.8,
                                                                    borderRadius: '4px'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.color = 'var(--text-primary)';
                                                                    e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.color = 'var(--text-muted)';
                                                                    e.currentTarget.style.background = 'transparent';
                                                                }}
                                                                title="Adjust Columns"
                                                            >
                                                                <Settings size={18} />
                                                            </button>
                                                        </div>

                                                        {/* Column Adjustment Modal */}
                                                        {isAdjustListOpen && createPortal(
                                                            <div style={{
                                                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                                                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                                                                zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                                                            }} onClick={() => setIsAdjustListOpen(false)}>
                                                                <div style={{
                                                                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                                                                    width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', padding: '1.5rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
                                                                }} onClick={e => e.stopPropagation()}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
                                                                        <div>
                                                                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{t('table_columns')}</h3>
                                                                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drag items to show/hide columns.</p>
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                            <button
                                                                                onClick={() => setActiveColumns(translatedColumns.filter(c => c.isDefault).map(c => c.id))}
                                                                                style={{
                                                                                    background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-muted)',
                                                                                    padding: '0 0.8rem', height: '30px', borderRadius: '15px', cursor: 'pointer',
                                                                                    fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', transition: 'all 0.2s'
                                                                                }}
                                                                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
                                                                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                                                            >
                                                                                Reset
                                                                            </button>
                                                                            <button onClick={() => setIsAdjustListOpen(false)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                                                                        </div>
                                                                    </div>

                                                                    <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
                                                                        <DndContext
                                                                            collisionDetection={closestCenter}
                                                                            sensors={sensors}
                                                                            onDragStart={(event) => setActiveDragId(event.active.id as string)}
                                                                            onDragCancel={() => setActiveDragId(null)}
                                                                            onDragEnd={(event) => {
                                                                                const { active, over } = event;
                                                                                setActiveDragId(null);

                                                                                if (over) {
                                                                                    const activeId = active.id as ColumnId;
                                                                                    const overId = over.id as string;
                                                                                    const isActiveInActive = activeColumns.includes(activeId);

                                                                                    // Check if dropped into Hidden Container directly
                                                                                    if (overId === 'hidden-columns-container' && isActiveInActive) {
                                                                                        if (activeColumns.length > 1) {
                                                                                            setActiveColumns(activeColumns.filter(c => c !== activeId));
                                                                                        }
                                                                                        return;
                                                                                    }

                                                                                    const isOverInActive = activeColumns.includes(overId as ColumnId);

                                                                                    if (isActiveInActive && isOverInActive) {
                                                                                        // Active -> Active: Reorder
                                                                                        setActiveColumns((items) => {
                                                                                            const oldIndex = items.indexOf(activeId);
                                                                                            const newIndex = items.indexOf(overId as ColumnId);
                                                                                            return arrayMove(items, oldIndex, newIndex);
                                                                                        });
                                                                                    } else if (!isActiveInActive && isOverInActive) {
                                                                                        // Hidden -> Active: Insert
                                                                                        const overIndex = activeColumns.indexOf(overId as ColumnId);
                                                                                        const newActive = [...activeColumns];
                                                                                        if (overIndex !== -1) newActive.splice(overIndex, 0, activeId);
                                                                                        else newActive.push(activeId);
                                                                                        setActiveColumns(newActive);
                                                                                    } else if (isActiveInActive && !isOverInActive) {
                                                                                        // Active -> Hidden: Remove (when dropped on an item in hidden list)
                                                                                        if (activeColumns.length > 1) {
                                                                                            setActiveColumns(activeColumns.filter(c => c !== activeId));
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }}
                                                                        >
                                                                            {/* Active Columns */}
                                                                            <div>
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Active Columns</div>
                                                                                <SortableContext items={activeColumns} strategy={verticalListSortingStrategy}>
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '50px' }}>
                                                                                        {activeColumns.map((colId) => {
                                                                                            const colDef = translatedColumns.find(c => c.id === colId);
                                                                                            return (
                                                                                                <SortableColumnItem
                                                                                                    key={colId}
                                                                                                    id={colId}
                                                                                                    label={colDef?.label || colId}
                                                                                                    type="active"
                                                                                                />
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </SortableContext>
                                                                            </div>

                                                                            {/* Available Columns */}
                                                                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Hidden Columns</div>
                                                                                <DroppableArea id="hidden-columns-container" style={{
                                                                                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                                                                                    minHeight: '100px', flex: 1,
                                                                                    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.5rem',
                                                                                    border: activeDragId && activeColumns.includes(activeDragId as any) ? '1px dashed var(--accent)' : '1px dashed transparent',
                                                                                    transition: 'border-color 0.2s'
                                                                                }}>
                                                                                    <SortableContext items={translatedColumns.filter(c => !activeColumns.includes(c.id)).map(c => c.id)} strategy={verticalListSortingStrategy}>
                                                                                        {translatedColumns.filter(c => !activeColumns.includes(c.id)).length === 0 ? (
                                                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                                                                                Drag columns here to hide
                                                                                            </div>
                                                                                        ) : (
                                                                                            translatedColumns.filter(c => !activeColumns.includes(c.id)).map(col => (
                                                                                                <SortableColumnItem
                                                                                                    key={col.id}
                                                                                                    id={col.id}
                                                                                                    label={col.label}
                                                                                                    type="passive"
                                                                                                />
                                                                                            ))
                                                                                        )}
                                                                                    </SortableContext>
                                                                                </DroppableArea>
                                                                            </div>

                                                                            <DragOverlay>
                                                                                {activeDragId ? (() => {
                                                                                    const col = translatedColumns.find(c => c.id === activeDragId);
                                                                                    if (!col) return null;
                                                                                    const isActive = activeColumns.includes(activeDragId as any);
                                                                                    return (
                                                                                        <ColumnItem
                                                                                            label={col.label}
                                                                                            type={isActive ? 'active' : 'passive'}
                                                                                            isOverlay={true}
                                                                                        />
                                                                                    );
                                                                                })() : null}
                                                                            </DragOverlay>
                                                                        </DndContext>
                                                                    </div>

                                                                    <button
                                                                        onClick={() => setIsAdjustListOpen(false)}
                                                                        style={{
                                                                            width: '100%', marginTop: '1rem', padding: '0.8rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px var(--accent-glow)', flexShrink: 0
                                                                        }}
                                                                    >
                                                                        Done
                                                                    </button>
                                                                </div>
                                                            </div>,
                                                            document.body
                                                        )}
                                                    </div>
                                                )}

                                                {groupingKey !== 'none' ? (
                                                    <SortableContext items={orderedGroups.filter(g => groupedAssets[g]).map(g => `group:${g}`)} strategy={verticalListSortingStrategy}>
                                                        {orderedGroups.filter(type => groupedAssets[type]).map(type => (
                                                            <SortableGroup key={type} id={`group:${type}`} disabled={isGlobalEditMode}>
                                                                <AssetGroup
                                                                    type={type}
                                                                    assets={groupedAssets[type]}
                                                                    totalEUR={groupTotals[type]}
                                                                    positionsViewCurrency={positionsViewCurrency}
                                                                    totalPortfolioValueEUR={totalValueEUR}
                                                                    isOwner={isOwner}
                                                                    onDelete={handleDelete}
                                                                    timeFactor={getTimeFactor()}
                                                                    columns={activeColumns}
                                                                    timePeriod={timePeriod}
                                                                    exchangeRates={exchangeRates}
                                                                    isGlobalEditMode={isGlobalEditMode}
                                                                    onAssetClick={setEditingAsset}
                                                                />
                                                            </SortableGroup>
                                                        ))}
                                                    </SortableContext>
                                                ) : (
                                                    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                                        {filteredAssets.map((asset, index) => (
                                                            <SortableAssetRow key={asset.id} id={asset.id} disabled={isGlobalEditMode}>
                                                                <AssetTableRow
                                                                    asset={asset}
                                                                    positionsViewCurrency={positionsViewCurrency}
                                                                    totalPortfolioValueEUR={totalValueEUR}
                                                                    isOwner={isOwner}
                                                                    onDelete={handleDelete}
                                                                    timeFactor={getTimeFactor()}
                                                                    rowIndex={index}
                                                                    columns={activeColumns}
                                                                    timePeriod={timePeriod}
                                                                    exchangeRates={exchangeRates}
                                                                    isGlobalEditMode={isGlobalEditMode}
                                                                    onAssetClick={setEditingAsset}
                                                                />
                                                            </SortableAssetRow>
                                                        ))}
                                                    </SortableContext>
                                                )}

                                                {filteredAssets.length === 0 && (
                                                    <EmptyPlaceholder
                                                        title="No Assets Found"
                                                        description="We couldn't find any assets matching your current filters. Try generating a new asset or adjusting your search."
                                                        icon={Inbox}
                                                        height="300px"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                {isGroupingEnabled ? (
                                                    <SortableContext items={orderedGroups.map(g => `group:${g}`)} strategy={verticalListSortingStrategy}>
                                                        {orderedGroups.map(type => {
                                                            const groupAssets = groupedAssets[type];
                                                            if (!groupAssets) return null;
                                                            const groupTotal = groupTotals[type] || 0;

                                                            return (
                                                                <SortableGroup key={type} id={`group:${type}`} disabled={isGlobalEditMode}>
                                                                    <AssetGroupGrid
                                                                        type={type}
                                                                        assets={groupAssets}
                                                                        groupTotal={groupTotal}
                                                                        totalPortfolioValueEUR={totalValueEUR}
                                                                        positionsViewCurrency={positionsViewCurrency}
                                                                        viewMode={viewMode}
                                                                        gridColumns={gridColumns}
                                                                        isBlurred={isBlurred}
                                                                        isOwner={isOwner}
                                                                        onDelete={handleDelete}
                                                                        timeFactor={getTimeFactor()}
                                                                        timePeriod={timePeriod}
                                                                        exchangeRates={exchangeRates}
                                                                        isGlobalEditMode={isGlobalEditMode}
                                                                        onAssetClick={setEditingAsset}
                                                                    />
                                                                </SortableGroup>
                                                            );
                                                        })}
                                                    </SortableContext>
                                                ) : (
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                                        gap: '1rem',
                                                        transition: 'all 0.3s ease'
                                                    }}>
                                                        <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
                                                            {filteredAssets.map((asset, index) => {
                                                                return (
                                                                    <SortableAssetCard key={asset.id} id={asset.id} disabled={isGlobalEditMode}>
                                                                        {viewMode === 'detailed' ? (
                                                                            <DetailedAssetCard
                                                                                asset={asset}
                                                                                positionsViewCurrency={positionsViewCurrency}
                                                                                totalPortfolioValueEUR={totalValueEUR}
                                                                                isBlurred={isBlurred}
                                                                                isOwner={isOwner}
                                                                                onDelete={handleDelete}
                                                                                timeFactor={getTimeFactor()}
                                                                                timePeriod={timePeriod}
                                                                                exchangeRates={exchangeRates}
                                                                            />
                                                                        ) : (
                                                                            <AssetCard
                                                                                asset={asset}
                                                                                positionsViewCurrency={positionsViewCurrency}
                                                                                totalPortfolioValueEUR={totalValueEUR}
                                                                                isBlurred={isBlurred}
                                                                                isOwner={isOwner}
                                                                                onDelete={handleDelete}
                                                                                timeFactor={getTimeFactor()}
                                                                                timePeriod={timePeriod}
                                                                                exchangeRates={exchangeRates}
                                                                                isGlobalEditMode={isGlobalEditMode}
                                                                                onAssetClick={setEditingAsset}
                                                                            />
                                                                        )}
                                                                    </SortableAssetCard>
                                                                );
                                                            })}
                                                        </SortableContext>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Sidebar (Summary) - Fixed Width */}
                    <div className="dashboard-sidebar">
                        {assets.length > 0 && (
                            <>
                                <AllocationCard
                                    assets={assets}
                                    totalValueEUR={totalValueEUR}
                                    isBlurred={isBlurredState}
                                    exchangeRates={exchangeRates}
                                    activeFilters={{
                                        Type: typeFilter,
                                        Exchange: exchangeFilter,
                                        Currency: currencyFilter,
                                        Country: countryFilter,
                                        Sector: sectorFilter,
                                        Platform: platformFilter,
                                        Portfolio: customGroupFilter
                                    }}
                                    onFilterSelect={(view, value) => {
                                        switch (view) {
                                            case 'Type': setTypeFilter(prev => prev === value ? null : value); break;
                                            case 'Exchange': setExchangeFilter(prev => prev === value ? null : value); break;
                                            case 'Currency': setCurrencyFilter(prev => prev === value ? null : value); break;
                                            case 'Country': setCountryFilter(prev => prev === value ? null : value); break;
                                            case 'Sector': setSectorFilter(prev => prev === value ? null : value); break;
                                            case 'Platform': setPlatformFilter(prev => prev === value ? null : value); break;
                                            case 'Portfolio': setCustomGroupFilter(prev => prev === value ? null : value); break;
                                        }
                                    }}
                                />


                                {goals && goals.length > 0 && (
                                    <GoalsCard goals={goals || []} isOwner={isOwner} exchangeRates={exchangeRates} totalValueEUR={totalValueEUR} />
                                )}
                                <TopPerformersCard assets={assets} baseCurrency={globalCurrency} />
                            </>
                        )}
                    </div>
                </div >

            </div >

            <DeleteConfirmationModal
                isOpen={!!assetToDelete}
                onClose={() => setAssetToDelete(null)}
                onConfirm={confirmDelete}
                assetSymbol={assetToDelete?.symbol || 'Asset'}
            />

            {
                editingAsset && (
                    <EditAssetModal
                        asset={editingAsset}
                        isOpen={!!editingAsset}
                        onClose={() => setEditingAsset(null)}
                    />
                )
            }

            {/* Filter Customize Modal */}
            {
                isCustomizeModalOpen && createPortal(
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
                    }} onClick={() => setIsCustomizeModalOpen(false)}>
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
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{t('customize_filters')}</h3>
                                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drag to reorder. Top 5 will be visible in the main bar.</p>
                                </div>
                                <button
                                    onClick={() => setIsCustomizeModalOpen(false)}
                                    style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <DndContext
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => {
                                    const { active, over } = event;
                                    if (over && active.id !== over.id) {
                                        setFilterOrder((items) => {
                                            const oldIndex = items.indexOf(active.id as string);
                                            const newIndex = items.indexOf(over.id as string);
                                            return arrayMove(items, oldIndex, newIndex);
                                        });
                                    }
                                }}
                            >
                                <SortableContext items={filterOrder} strategy={verticalListSortingStrategy}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {filterOrder.map((id, index) => {
                                            const cat = allCategories.find(c => c.id === id);
                                            if (!cat) return null;
                                            return (
                                                <SortableFilterItem key={id} id={id} label={cat.label} icon={cat.icon} isPinned={index < 5} />
                                            );
                                        })}
                                    </div>
                                </SortableContext>
                            </DndContext>

                            <button
                                onClick={() => setIsCustomizeModalOpen(false)}
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
                )
            }
        </DndContext >
    );
}

// Sortable Item Component for Filters
const SortableFilterItem = ({ id, label, icon, isPinned }: { id: string, label: string, icon: string, isPinned: boolean }) => {
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
                <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {isPinned && <div title="Visible in main bar" style={{ background: 'var(--accent)', width: '6px', height: '6px', borderRadius: '50%' }} />}
                <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
        </div>
    );
};

function ChangelogView() {
    const [content, setContent] = useState('Loading changelog...');

    useEffect(() => {
        fetch('/CHANGELOG.md')
            .then(res => res.text())
            .then(text => setContent(text))
            .catch(err => setContent('Failed to load changelog.'));
    }, []);

    return (
        <div className="neo-card" style={{
            padding: '2rem',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            minHeight: '400px',
            animation: 'fadeIn 0.3s ease',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-md)'
        }}>
            <div style={{
                marginBottom: '2rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
            }}>
                <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)'
                }}>
                    <Briefcase size={22} />
                </div>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Changelog.txt</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>System Updates & Version History</p>
                </div>
            </div>

            <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                maxHeight: '600px',
                overflowY: 'auto',
                color: 'var(--text-secondary)'
            }}>
                {content}
            </div>
        </div>
    );
}
