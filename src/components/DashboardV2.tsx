"use client";

import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { useCurrency } from "@/context/CurrencyContext";
import { useRouter } from "next/navigation"; // Added router
import { InlineAssetSearch } from "./InlineAssetSearch";
import { deleteAsset, updateAsset, reorderAssets, refreshPortfolioPrices } from "@/lib/actions"; // Added updateAsset, reorderAssets
import { UnifiedPortfolioSummary, AllocationCard } from "./PortfolioSidebarComponents";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor, // Switched to Mouse
    TouchSensor, // Switched to Touch
    useSensor,
    useSensors,
    DragEndEvent
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
const TIME_PERIODS = ["1D", "1W", "1M", "YTD", "1Y", "ALL"];
import { Bitcoin, Wallet, TrendingUp, PieChart, Gem, Coins, Layers, LayoutGrid, List, Save, X, Trash2, Settings, LayoutTemplate, Grid, Check, ChevronDown, ChevronRight, GripVertical, SlidersHorizontal, Briefcase, Banknote } from "lucide-react";
import { DetailedAssetCard } from "./DetailedAssetCard";
import { getCompanyName } from "@/lib/companyNames";
import { formatEUR, formatNumber } from "@/lib/formatters";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { RATES, getRate, getCurrencySymbol } from "@/lib/currency";
import { EditAssetModal } from "./EditAssetModal";

interface DashboardProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    isBlurred: boolean;
    showChangelog?: boolean;
    exchangeRates?: Record<string, number>;
}

// European number format removed (Imported)
// Company name mapping removed (Imported)

// Logo mapping for common symbols
// Systematic Logo Logic
// Local getLogoUrl removed. Imported from @/lib/logos.

const AssetLogo = ({ symbol, type, name, logoUrl: primaryUrl, size = '3.5rem' }: { symbol: string, type: string, name?: string, logoUrl?: string | null, size?: string }) => {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

    const t = type.toUpperCase();
    const cleanSymbol = symbol.split('.')[0].toUpperCase();

    // Generate fallback list
    const urls = useMemo(() => {
        const list: string[] = [];
        if (primaryUrl) list.push(primaryUrl);

        // Fallback for Stocks/ETFs
        if (t === 'STOCK' || t === 'ETF' || t === 'FUND') {
            // TradingView Fallback
            list.push(`https://s3-symbol-logo.tradingview.com/${cleanSymbol}--big.svg`);
        }

        return list.filter(u => u && u.trim() !== '' && !failedUrls.has(u));
    }, [primaryUrl, cleanSymbol, t, failedUrls]);

    const currentUrl = urls[currentUrlIndex];

    // Reset error if primaryUrl or symbol changes
    useEffect(() => {
        setCurrentUrlIndex(0);
        setFailedUrls(new Set());
    }, [primaryUrl, symbol]);

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

    const handleError = () => {
        if (currentUrl) {
            setFailedUrls(prev => new Set(prev).add(currentUrl));
            setCurrentUrlIndex(prev => prev + 1);
        }
    };

    if (currentUrl) {
        return (
            <div style={logoStyle}>
                <img
                    src={currentUrl}
                    alt={symbol}
                    onError={handleError}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        )
    }

    // Extract first meaningful letter for placeholder
    const getPlaceholderLetter = (): string => {
        let text = name || symbol;

        // Remove common prefixes
        const prefixes = ['BES-', 'BES_'];
        for (const prefix of prefixes) {
            if (text.startsWith(prefix)) {
                text = text.substring(prefix.length);
                break;
            }
        }

        // Trim and take first char
        return text.trim().charAt(0).toUpperCase();
    };

    return (
        <div style={{
            ...logoStyle,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size === '1.2rem' ? '0.6rem' : size === '1.4rem' ? '0.7rem' : size === '2rem' ? '1rem' : '1.5rem',
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }}>
            {getPlaceholderLetter()}
        </div>
    );
}

const MarketStatusDot = ({ state }: { state?: string }) => {
    if (!state) return null;
    const isRegular = state.toUpperCase() === 'REGULAR';
    return (
        <div
            title={state}
            style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isRegular ? '#10b981' : '#ef4444',
                boxShadow: `0 0 4px ${isRegular ? '#10b981' : '#ef4444'}80`,
                flexShrink: 0
            }}
        />
    );
};

import { AssetDisplay } from "@/lib/types";
import { SortableAssetRow, SortableGroup, SortableAssetCard } from "./SortableWrappers";

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
    { id: 'VALUE', label: 'Value', isDefault: true },
    { id: 'PRICE_EUR', label: 'Price (€)', isDefault: false },
    { id: 'VALUE_EUR', label: 'Value (€)', isDefault: false },
    { id: 'PL', label: 'P&L (€)', isDefault: true },
];

const COL_WIDTHS: Record<ColumnId, string> = {
    PORTFOLIO_NAME: 'minmax(80px, 0.8fr)',
    NAME: 'minmax(120px, 2fr)',
    PRICE: 'minmax(70px, 0.9fr)',
    VALUE: 'minmax(80px, 1fr)',
    PRICE_EUR: 'minmax(70px, 0.9fr)',
    VALUE_EUR: 'minmax(80px, 1fr)',
    PL: 'minmax(70px, 0.9fr)',
    // Keep others for safe fallback if needed, or remove if unused in render
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

// Global Edit/Click Handler Context or Props could be processed here, but we pass them down.

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
                justifyContent: 'flex-start',
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

    // Calculate Conversion Rate
    // Native (Original) Values for PRICE / VALUE columns
    const nativePrice = asset.currentPrice;
    const nativeTotalValue = asset.currentPrice * asset.quantity;
    const nativeCostBasis = asset.buyPrice * asset.quantity;
    const nativeSymbol = getCurrencySymbol(asset.currency);

    // Global (Converted) Values for PRICE_EUR / VALUE_EUR / PL columns
    // If View is ORG -> Global is EUR. If View is Specific (USD/TRY) -> Global is that specific currency.
    const globalCurrency = positionsViewCurrency === 'ORG' ? 'EUR' : positionsViewCurrency;
    const globalRate = getRate(asset.currency, globalCurrency, exchangeRates);
    const globalSymbol = getCurrencySymbol(globalCurrency);

    const globalPrice = asset.currentPrice * globalRate;
    const globalAvgPrice = asset.buyPrice * globalRate;
    const globalTotalValue = nativeTotalValue * globalRate;
    const globalCostBasis = nativeCostBasis * globalRate;

    // P&L uses Global Values
    const totalProfitVal = globalTotalValue - globalCostBasis;
    const totalProfitPct = asset.plPercentage;

    // P&L based on Time Factor or Real 1D Data
    let periodProfitVal = totalProfitVal * timeFactor;
    let periodProfitPct = totalProfitPct * timeFactor;

    if (timePeriod === '1D') {
        // Use Real 1D Data (asset.dailyChange is in EUR)
        periodProfitPct = asset.dailyChangePercentage || 0;

        // Convert dailyChange (EUR) to Global Display Currency
        // We know dailyChange is EUR, so we need EUR -> Global Rate
        const eurToGlobalRate = getRate('EUR', globalCurrency, exchangeRates);
        periodProfitVal = (asset.dailyChange || 0) * eurToGlobalRate;
    }

    const isPeriodProfit = periodProfitVal >= 0;

    const fmt = (val: number, min = 2, max = 2) =>
        new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }).format(val || 0);


    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(asset.id);
    };

    const logoUrl = getLogoUrl(asset.symbol, asset.type, asset.exchange);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);

    // Dynamic Layout Logic
    const columnsCount = columns.length;
    const isUltraHighDensity = columnsCount >= 10;
    const isHighDensity = columnsCount >= 7;
    const isMediumDensity = columnsCount >= 5;

    const fontSizeMain = isUltraHighDensity ? '0.75rem' : isHighDensity ? '0.88rem' : isMediumDensity ? '0.98rem' : '1.1rem';
    const fontSizeSub = isUltraHighDensity ? '0.6rem' : isHighDensity ? '0.68rem' : isMediumDensity ? '0.75rem' : '0.85rem';
    const cellPadding = isUltraHighDensity ? '0rem 0.1rem' : isHighDensity ? '0.05rem 0.2rem' : isMediumDensity ? '0.2rem 0.4rem' : '0.4rem 0.6rem';

    const gridTemplate = columns.map(c => COL_WIDTHS[c]).join(' ');

    const commonCellStyles: React.CSSProperties = {
        padding: cellPadding,
        borderRight: 'none',
        borderBottom: 'none',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        minWidth: 0,
        position: 'relative',
        gap: '0'
    };

    const renderCell = (colId: ColumnId) => {
        const isNumeric = ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId);

        let cellContent = null;
        switch (colId) {
            case 'TYPE':
                cellContent = (
                    <div className="col-type" style={{ fontSize: fontSizeSub, opacity: 0.6, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {asset.type}
                    </div>
                );
                break;
            case 'NAME':
                cellContent = (
                    <div className="col-name" style={{ display: 'flex', alignItems: 'center', gap: isHighDensity ? '0.3rem' : '0.8rem', minWidth: 0, width: '100%' }}>
                        <MarketStatusDot state={asset.marketState} />
                        <AssetLogo symbol={asset.symbol} type={asset.type} name={companyName} logoUrl={logoUrl} size={isUltraHighDensity ? "1.2rem" : isHighDensity ? "1.4rem" : "2rem"} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '0', flex: 1 }}>
                            <>
                                <span style={{
                                    fontSize: fontSizeMain,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    lineHeight: 1.1
                                }}>
                                    {companyName}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden' }}>
                                    <span style={{ fontSize: fontSizeSub, opacity: 0.4, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                        {asset.symbol}
                                    </span>
                                    {!isUltraHighDensity && (
                                        <span style={{
                                            fontSize: '0.65rem',
                                            opacity: 0.8,
                                            fontWeight: 600,
                                            color: 'var(--accent)',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            padding: '0 3px',
                                            borderRadius: '3px'
                                        }}>
                                            x{asset.quantity >= 1000
                                                ? (asset.quantity / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
                                                : asset.quantity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </span>
                                    )}
                                </div>
                            </>
                        </div>
                    </div>
                );
                break;
            case 'TICKER':
                cellContent = <div style={{ fontSize: fontSizeMain, fontWeight: 600 }}>{asset.symbol}</div>;
                break;
            case 'EXCHANGE':
                cellContent = <div style={{ fontSize: fontSizeSub, opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.exchange || '-'}</div>;
                break;
            case 'CURRENCY':
                cellContent = <div style={{ fontSize: fontSizeSub, opacity: 0.6 }}>{asset.currency || '-'}</div>;
                break;
            case 'PRICE':
                cellContent = (
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <span style={{ fontSize: fontSizeMain, fontWeight: 500, opacity: 0.9 }}>{nativeSymbol}{fmt(nativePrice)}</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{nativeSymbol}{fmt(asset.buyPrice)}</span>
                    </div>
                );
                break;
            case 'PRICE_EUR':
                cellContent = (
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <span style={{ fontSize: fontSizeMain, fontWeight: 500, opacity: 0.9 }}>{globalSymbol}{fmt(globalPrice)}</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{globalSymbol}{fmt(globalAvgPrice)}</span>
                    </div>
                );
                break;
            case 'VALUE':
                cellContent = (
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <span style={{ fontSize: fontSizeMain, fontWeight: 700, color: 'var(--text-primary)' }}>{nativeSymbol}{fmt(nativeTotalValue, 0, 0)}</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{nativeSymbol}{fmt(nativeCostBasis, 0, 0)}</span>
                    </div>
                );
                break;
            case 'VALUE_EUR':
                {
                    cellContent = (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <span style={{ fontSize: fontSizeMain, fontWeight: 700, color: 'var(--text-primary)' }}>{globalSymbol}{fmt(globalTotalValue, 0, 0)}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{globalSymbol}{fmt(globalCostBasis, 0, 0)}</span>
                        </div>
                    );
                }
                break;
            case 'PL':
                cellContent = (
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', width: '100%', position: 'relative' }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end'
                        }}>
                            <span style={{ fontSize: fontSizeMain, fontWeight: 700, color: isPeriodProfit ? '#10b981' : '#ef4444' }}>
                                {isPeriodProfit ? '▲' : '▼'}{Math.round(Math.abs(periodProfitPct))}%
                            </span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: isPeriodProfit ? '#10b981' : '#ef4444', opacity: 0.8 }}>
                                {isPeriodProfit ? '+' : ''}{globalSymbol}{fmt(periodProfitVal, 0, 0)}
                            </span>
                        </div>
                    </div>
                );
                break;
            case 'EARNINGS':
                cellContent = <div style={{ fontSize: fontSizeSub, opacity: 0.4, textAlign: 'right', width: '100%' }}>-</div>;
                break;
            case 'PORTFOLIO_NAME':
                cellContent = (
                    <span style={{
                        fontSize: fontSizeMain,
                        color: 'var(--text-secondary)',
                        background: 'rgba(0,0,0,0.05)',
                        padding: '1px 3px',
                        borderRadius: '2px',
                        border: '1px solid rgba(0,0,0,0.1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: 600
                    }}>
                        {asset.customGroup || asset.ownerCode || '-'}
                    </span>
                );
                break;
        }

        return (
            <div key={colId} style={{
                ...commonCellStyles,
                justifyContent: isNumeric ? 'flex-end' : 'flex-start',
            }}>
                {cellContent}
            </div>
        );
    }

    return (
        <div
            className="asset-table-grid row-container"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => isGlobalEditMode && onAssetClick?.(asset)} // Handle click in global edit mode
            style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                minHeight: isUltraHighDensity ? '1.6rem' : isHighDensity ? '1.9rem' : '3rem',
                borderBottom: 'none',
                position: 'relative',
                cursor: isGlobalEditMode ? 'pointer' : 'default', // Cursor change
                opacity: isGlobalEditMode && isHovered ? 1 : 1, // Reset opacity
                background: isGlobalEditMode && isHovered ? 'rgba(99, 102, 241, 0.1)' : (isHovered // Highlight background
                    ? 'rgba(0,0,0,0.02)'
                    : (rowIndex !== undefined && rowIndex % 2 === 1)
                        ? 'rgba(0,0,0,0.01)'
                        : 'transparent'),
                border: isGlobalEditMode && isHovered ? '1px solid var(--accent)' : '1px solid transparent', // Add border highlight
                borderRadius: '6px', // Rounded for highlight
                zIndex: isGlobalEditMode && isHovered ? 10 : 1,
                transform: isGlobalEditMode && isHovered ? 'scale(1.01)' : 'scale(1)', // Subtle pop
                transition: 'all 0.2s'
            }}
        >
            {columns.map(colId => {
                const isNumeric = ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL', 'EARNINGS'].includes(colId);
                return (
                    <div key={colId} style={{
                        ...commonCellStyles,
                        justifyContent: isNumeric ? 'flex-end' : 'flex-start',
                    }}>
                        {/* Shifting Content Wrapper - Removed Shift Logic for Edit Button */}
                        <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isNumeric ? 'flex-end' : 'flex-start',
                            flexShrink: 0
                        }}>
                            {/* Extract content from renderCell if it returns a wrapper, or use directly if it returns content */}
                            {renderCell(colId)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Reusable Asset Card Component
function AssetCard({ asset, positionsViewCurrency, totalPortfolioValueEUR, isBlurred, isOwner, onDelete, timeFactor, timePeriod, rank, exchangeRates, isGlobalEditMode, onAssetClick }: {
    asset: AssetDisplay,
    positionsViewCurrency: string,
    totalPortfolioValueEUR: number,
    isBlurred: boolean,
    isOwner: boolean,
    onDelete: (id: string) => void,
    timeFactor: number,
    timePeriod: string,
    rank?: number,
    exchangeRates?: Record<string, number>,
    isGlobalEditMode?: boolean,
    onAssetClick?: (asset: AssetDisplay) => void
}) {
    const [isHovered, setIsHovered] = useState(false);
    // Currency Conversion Logic
    // Base is EUR (asset.totalValueEUR) or Native (for Original)

    let displayCurrency = positionsViewCurrency === 'ORG' ? asset.currency : positionsViewCurrency;
    const currencySymbol = getCurrencySymbol(displayCurrency);

    // Calculate Values in Display Currency
    let totalVal = 0;
    let totalCost = 0;
    let unitPrice = 0;
    let unitCost = 0;

    if (positionsViewCurrency === 'ORG') {
        totalVal = asset.currentPrice * asset.quantity;
        totalCost = asset.buyPrice * asset.quantity;
        unitPrice = asset.currentPrice;
        unitCost = asset.buyPrice;
    } else {
        const targetRate = getRate('EUR', displayCurrency, exchangeRates);
        totalVal = asset.totalValueEUR * targetRate;
        const costEUR = asset.totalValueEUR / (1 + asset.plPercentage / 100);
        totalCost = costEUR * targetRate;

        // Unit values in target currency
        unitPrice = (asset.totalValueEUR / asset.quantity) * targetRate;
        unitCost = (costEUR / asset.quantity) * targetRate;
    }

    const profit = totalVal - totalCost;
    const profitPct = asset.plPercentage;

    // Weight Calculation
    const weight = totalPortfolioValueEUR > 0 ? (asset.totalValueEUR / totalPortfolioValueEUR) * 100 : 0;

    let periodProfitVal = profit * timeFactor;
    let periodProfitPctVal = profitPct * timeFactor;

    if (timePeriod === '1D') {
        periodProfitPctVal = asset.dailyChangePercentage || 0;
        const conversionRate = getRate('EUR', displayCurrency, exchangeRates);
        periodProfitVal = (asset.dailyChange || 0) * conversionRate;
    }

    const logoUrl = getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div
            className="glass-panel"
            onClick={() => isGlobalEditMode && onAssetClick?.(asset)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                padding: '0', // Full bleed internal padding handled by sections
                borderRadius: '0.6rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transition: 'all 0.3s ease',
                border: `1px solid ${ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']}`,
                // Highlight if Editing (Amber)
                borderColor: isGlobalEditMode ? '#f59e0b' : (ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']) + '60',
                filter: isBlurred ? 'blur(8px)' : 'none',
                overflow: 'hidden',
                height: '100%',
                boxShadow: isGlobalEditMode ? (isHovered ? '0 0 20px rgba(99, 102, 241, 0.4)' : '0 0 15px rgba(99, 102, 241, 0.1)') : 'none',
                cursor: isGlobalEditMode ? 'pointer' : 'default',
                transform: isGlobalEditMode && isHovered ? 'scale(1.02)' : 'scale(1)',
                borderColor: isGlobalEditMode ? (isHovered ? 'var(--accent)' : 'var(--glass-border)') : (ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']) + '60',
            }}
        >
            {/* SECTION 1: HEADER (Logo + Name/Settings) */}
            <div style={{ display: 'flex', padding: '0.6rem', borderBottom: '1px solid var(--glass-border)', height: '5.5rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 1 }}>
                    <MarketStatusDot state={asset.marketState} />
                </div>
                {/* Left: Logo */}
                <div style={{ marginRight: '1rem' }}>
                    <AssetLogo symbol={asset.symbol} type={asset.type} name={companyName} logoUrl={logoUrl} />
                </div>

                {/* Right: Info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Fixed Height Title Container for Alignment */}
                        <div style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-primary)', minHeight: '2.4em', display: 'flex', alignItems: 'center' }}>
                            {companyName}
                        </div>
                    </div>
                    {/* Subtitle / Asset Info */}
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.2rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                        {asset.type === 'CASH' ? (
                            <>
                                <span style={{ color: 'var(--text-secondary)' }}>Cash</span>
                                <span style={{ opacity: 0.3 }}>|</span>
                                <span style={{ opacity: 0.6 }}>{asset.quantity.toLocaleString('de-DE')} {asset.symbol}</span>
                            </>
                        ) : (
                            <>
                                <span style={{ color: 'var(--text-secondary)' }}>{asset.symbol}</span>
                                <span style={{ opacity: 0.3 }}>|</span>
                                <span style={{ opacity: 0.6 }}>{asset.quantity.toLocaleString('de-DE')} {asset.quantity === 1 ? 'Share' : 'Shares'}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* SECTION 2: BODY (FINANCIALS) */}
            <div style={{ padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>

                {/* NORMAL VIEW MODE */}
                <>
                    {/* Row 1: Price & Cost */}
                    <div style={{
                        background: 'var(--glass-bg)',
                        borderRadius: '0.4rem',
                        padding: '0.4rem 0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        margin: '0 -0.2rem'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.1rem' }}>Cost</div>
                            <div style={{ fontWeight: 700, opacity: 0.9, whiteSpace: 'nowrap' }}>
                                {currencySymbol} {asset.type === 'CASH' ? fmt(totalCost) : fmt(unitCost)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', opacity: 0.1, fontSize: '0.7rem' }}>|</div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.1rem' }}>Price</div>
                            <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {currencySymbol} {asset.type === 'CASH' ? fmt(totalVal) : fmt(unitPrice)}
                            </div>
                        </div>
                    </div>

                    {/* Sub-Section B: Total Data */}
                    <div style={{
                        background: 'var(--glass-bg)',
                        borderRadius: '0.4rem',
                        padding: '0.4rem 0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        margin: '0 -0.2rem'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.1rem' }}>Total Cost</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, opacity: 0.9, whiteSpace: 'nowrap' }}>{currencySymbol} {fmt(totalCost)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '0.1rem' }}>Total Value</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{currencySymbol} {fmt(totalVal)}</div>
                        </div>
                    </div>

                    {/* Sub-Section C: Footer (Weight | P/L) */}
                    <div style={{
                        background: periodProfitVal >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '0.4rem',
                        padding: '0.4rem 0.6rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: periodProfitVal >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                        marginTop: 'auto'
                    }}>
                        {/* Weight Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 600 }}>Weight</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, opacity: 0.9 }}>{fmt(weight)}%</div>
                        </div>

                        {/* Profit Column (Stacked) */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: periodProfitVal >= 0 ? '#10b981' : '#ef4444' }}>
                                <span style={{ fontSize: '0.7rem', marginRight: '0.1rem' }}>{periodProfitVal >= 0 ? '▲' : '▼'}</span>
                                {Math.round(Math.abs(periodProfitPctVal))}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: periodProfitVal >= 0 ? '#10b981' : '#ef4444', fontWeight: 600, opacity: 0.9 }}>
                                {periodProfitVal >= 0 ? '+' : ''}{currencySymbol} {fmt(Math.abs(periodProfitVal))}
                            </div>
                        </div>
                    </div>
                </>
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
                background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.25), rgba(79, 70, 229, 0.15))',
                borderRadius: '0',
                borderBottom: 'none',
                marginBottom: '0',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                userSelect: 'none',
                minHeight: '2.8rem'
            }}
        >
            {/* Left Side: Group Info */}
            {columns?.map((colId, idx) => {
                const isFirst = idx === 0;
                const isName = colId === 'NAME';
                const isLast = idx === columns.length - 1;

                return (
                    <div key={colId} style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isFirst || isName ? 'flex-start' : 'center',
                        padding: '0 0.4rem',
                        borderRight: 'none',
                        overflow: 'hidden'
                    }}>
                        {isFirst && (
                            <div style={{
                                color: isExpanded ? 'var(--text-primary)' : 'var(--text-muted)',
                                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                transition: 'transform 0.3s ease'
                            }}>
                                <ChevronDown size={14} />
                            </div>
                        )}
                        {isName && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: isFirst ? '0.4rem' : '0' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '1.4rem', height: '1.4rem',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    borderRadius: '50%',
                                    color: '#fff'
                                }}>
                                    {getGroupIcon(type)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{type}</span>
                                    <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{count} Assets</span>
                                </div>
                            </div>
                        )}
                        {idx === columns.length - 1 && (
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, background: '#6366f1', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '1rem' }}>
                                    {percentage.toFixed(0)}%
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{currencySymbol}{fmt(totalEUR * rate)}</span>
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
                gap: '0' // No Gap for continuous dividers
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




export default function Dashboard({ username, isOwner, totalValueEUR, assets, isBlurred, showChangelog = false, exchangeRates }: DashboardProps) {
    const router = useRouter();
    // Initialize items with default sort (Weight Descending)
    // Initialize items with default sort (Rank then Value)
    // Fix: Initialize with assets prop to avoid hydration mismatch/flash
    const [items, setItems] = useState<AssetDisplay[]>(assets);
    const [orderedGroups, setOrderedGroups] = useState<string[]>([]);
    const [isGroupingEnabled, setIsGroupingEnabled] = useState(false);
    const viewMode = "list";
    const [gridColumns, setGridColumns] = useState<1 | 2>(2);
    const [timePeriod, setTimePeriod] = useState("ALL");

    // Global Edit Mode State
    const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
    const [editingAsset, setEditingAsset] = useState<AssetDisplay | null>(null);

    // DEBUG: Deployment Check
    const [isTimeSelectorHovered, setIsTimeSelectorHovered] = useState(false);
    const [isGroupingSelectorHovered, setIsGroupingSelectorHovered] = useState(false);
    const [isViewSelectorHovered, setIsViewSelectorHovered] = useState(false);

    // Delete Confirmation State
    const [assetToDelete, setAssetToDelete] = useState<AssetDisplay | null>(null);

    // Column State
    // Fix: Initialize with default columns to match Server Side Rendering
    const [activeColumns, setActiveColumns] = useState<ColumnId[]>(
        ALL_COLUMNS.filter(c => c.isDefault).map(c => c.id)
    );
    const [isAdjustListOpen, setIsAdjustListOpen] = useState(false);

    // Persist Columns & Load from LocalStorage on Mount
    useEffect(() => {
        // Load from LocalStorage
        const saved = localStorage.getItem('user_columns');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // Filter out any columns that no longer exist in ALL_COLUMNS
                    const validColumns = parsed.filter((id: string) => ALL_COLUMNS.some(c => c.id === id));
                    if (validColumns.length > 0) {
                        setActiveColumns(validColumns);
                    }
                }
            } catch (e) {
                console.error("Failed to parse user columns", e);
            }
        }
    }, []);

    useEffect(() => {
        // Save to LocalStorage
        if (activeColumns.length > 0) {
            localStorage.setItem('user_columns', JSON.stringify(activeColumns));
        }
    }, [activeColumns]);

    const { currency: globalCurrency } = useCurrency();
    const positionsViewCurrency = globalCurrency;

    // Update items when assets prop changes (initial load or refetch)
    useEffect(() => {
        // Ensure we preserve order if rank is present, otherwise value sort
        const sorted = [...assets].sort((a, b) => {
            if ((a.rank ?? 0) !== (b.rank ?? 0)) {
                return (a.rank ?? 0) - (b.rank ?? 0);
            }
            return b.totalValueEUR - a.totalValueEUR;
        });
        setItems(sorted);
    }, [assets]);

    // Force List View on Mobile (Redundant as View Mode is hardcoded to List)
    // useEffect removed

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
            // Primary Sort: Rank (Ascending)
            if ((a.rank ?? 0) !== (b.rank ?? 0)) {
                return (a.rank ?? 0) - (b.rank ?? 0);
            }
            // Secondary Sort: Value (Descending)
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

            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const movedItems = arrayMove(items, oldIndex, newIndex);

                // OPTIMISTIC UPDATE: Update the rank property immediately so sortedAssets doesn't revert order
                const newItems = movedItems.map((item, index) => ({
                    ...item,
                    rank: index
                }));

                setItems(newItems);

                // Update Server
                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    rank: index
                }));
                reorderAssets(updates).then(res => {
                    console.log("[Reorder] Response:", res);
                    if (res && res.error) {
                        console.error("[Reorder] Error from server:", res.error);
                        alert(`Order save failed: ${res.error}. Please refresh.`);
                    }
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

    // Filter categories
    const filterCategories = [
        { id: 'customGroup', label: 'Portfolio', items: customGroups, active: customGroupFilter, setter: setCustomGroupFilter, icon: '📁' },
        { id: 'type', label: 'Type', items: types, active: typeFilter, setter: setTypeFilter, icon: '🏷️' },
        { id: 'exchange', label: 'Exchange', items: exchanges, active: exchangeFilter, setter: setExchangeFilter, icon: '📍' },
        { id: 'currency', label: 'Currency', items: currencies, active: currencyFilter, setter: setCurrencyFilter, icon: '💱' },
        { id: 'country', label: 'Country', items: countries, active: countryFilter, setter: setCountryFilter, icon: '🌍' },
        { id: 'sector', label: 'Sector', items: sectors, active: sectorFilter, setter: setSectorFilter, icon: '🏢' },
        { id: 'platform', label: 'Platform', items: platforms, active: platformFilter, setter: setPlatformFilter, icon: '🏦' },
    ];

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

        if (isAdjustListOpen || activeFilterCategory) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAdjustListOpen, activeFilterCategory]);

    const activeFiltersCount = [typeFilter, exchangeFilter, currencyFilter, countryFilter, sectorFilter, platformFilter].filter(Boolean).length;


    const [isRefreshing, setIsRefreshing] = useState(false);

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
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

                        {/* 1. Smart Filter Bar (Maximized Space + Bottom Clear) */}
                        <div className="glass-panel" style={{
                            borderRadius: '0.8rem',
                            padding: '0.6rem 0.8rem',
                            display: 'flex',
                            flexDirection: 'column', // Stack filters and clear button vertically
                            gap: '0.5rem',
                            zIndex: 50,
                            position: 'relative',
                            width: '100%',
                            fontFamily: 'inherit'
                        }}>
                            <style jsx>{`
                                .no-scrollbar::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>

                            {/* ROW 1: Filters (Full Width, Single Line) */}
                            <div className="no-scrollbar" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem', // Tight gap to fit more
                                overflowX: 'auto',  // Allow scroll if absolutely necessary but aim for fit
                                overflowY: 'hidden',
                                width: '100%',
                                whiteSpace: 'nowrap',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                                justifyContent: 'space-between' // Distribute evenly or justify-start? Start is safer for variable widths.
                            }}>
                                <div style={{ display: 'flex', gap: '0.3rem', width: '100%' }}>
                                    {filterCategories.map(category => (
                                        <div key={category.id} style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
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
                                                    background: category.active ? 'var(--bg-active)' : 'rgba(255,255,255,0.03)',
                                                    border: category.active ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                                                    borderRadius: '0.4rem',
                                                    color: category.active ? 'var(--accent)' : 'var(--text-primary)',
                                                    padding: '0.35rem 0.2rem', // Minimal horizontal padding
                                                    width: '100%', // Force button to fill its flex slot
                                                    fontSize: '0.7rem', // Smaller font
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center', // Center content
                                                    gap: '0.2rem',
                                                    whiteSpace: 'nowrap',
                                                    fontFamily: 'inherit',
                                                    overflow: 'hidden', // Clip text if too long
                                                    textOverflow: 'ellipsis'
                                                }}
                                                title={category.label}
                                            >
                                                <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>{category.icon}</span>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{category.label}</span>
                                                {category.active && <span style={{ fontSize: '0.6rem', opacity: 0.8, background: 'rgba(0,0,0,0.1)', padding: '0 3px', borderRadius: '3px', marginLeft: '2px' }}>✓</span>}
                                                <span style={{ fontSize: '0.55rem', opacity: 0.4 }}>▼</span>
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
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '0.5rem',
                                                        padding: '0.4rem',
                                                        minWidth: '160px',
                                                        maxHeight: '250px',
                                                        overflowY: 'auto',
                                                        zIndex: 9999,
                                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                                    }}>
                                                    {category.items.map(item => (
                                                        <button
                                                            key={item}
                                                            onClick={() => {
                                                                category.setter(category.active === item ? null : item);
                                                                setActiveFilterCategory(null);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem 0.6rem',
                                                                background: category.active === item ? 'var(--bg-active)' : 'transparent',
                                                                border: 'none',
                                                                borderRadius: '0.4rem',
                                                                color: category.active === item ? 'var(--text-active)' : 'var(--text-secondary)',
                                                                fontSize: '0.8rem',
                                                                fontWeight: category.active === item ? 600 : 400,
                                                                cursor: 'pointer',
                                                                textAlign: 'left',
                                                                transition: 'all 0.2s',
                                                                display: 'block',
                                                                marginBottom: '0.1rem',
                                                                fontFamily: 'inherit'
                                                            }}
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                                </div>,
                                                document.body
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ROW 2: Clear All Button (Left Aligned) */}
                            {activeFiltersCount > 0 && (
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
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
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ef4444',
                                            padding: '0',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.2rem',
                                            fontFamily: 'inherit',
                                            opacity: 0.8
                                        }}
                                    >
                                        <span style={{ fontSize: '0.8rem' }}>✕</span>
                                        <span style={{ textDecoration: 'underline' }}>Clear All Filters</span>
                                    </button>
                                </div>
                            )}
                        </div>


                        {/* 2. Positions Section */}
                        <div className="glass-panel positions-card" style={{ borderRadius: '0.75rem', padding: '1rem' }}>
                            {/* Header with Title and FX Toggles (Left) vs Time/View (Right) */}
                            <div className="positions-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>

                                {/* LEFT: Time + FX Toggles */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

                                    {/* 1. Time Period Selector */}
                                    {/* DESKTOP: Buttons (Modern Hover-Expand) */}
                                    <div
                                        className="desktop-only"
                                        onMouseEnter={() => setIsTimeSelectorHovered(true)}
                                        onMouseLeave={() => setIsTimeSelectorHovered(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--glass-shine)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '2rem',
                                            padding: '0.3rem',
                                            border: '1px solid var(--glass-border)',
                                            boxShadow: isTimeSelectorHovered ? '0 4px 20px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.3s ease',
                                            height: '2.4rem' // Fixed height for smoothness
                                        }}
                                    >
                                        {TIME_PERIODS.map(period => {
                                            const isActive = timePeriod === period;
                                            const isVisible = isTimeSelectorHovered || isActive;

                                            return (
                                                <button
                                                    key={period}
                                                    onClick={() => setTimePeriod(period)}
                                                    style={{
                                                        background: isActive ? '#6366f1' : 'transparent',
                                                        border: 'none',
                                                        borderRadius: '1.5rem',
                                                        color: isActive ? '#fff' : 'var(--text-secondary)',
                                                        // Animation props
                                                        maxWidth: isVisible ? '100px' : '0px',
                                                        padding: isVisible ? '0.3rem 0.8rem' : '0',
                                                        margin: isVisible ? '0 2px' : '0',
                                                        opacity: isVisible ? 1 : 0,
                                                        overflow: 'hidden',

                                                        fontSize: '0.75rem',
                                                        fontWeight: isActive ? 700 : 600,
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {period}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* MOBILE: Dropdown */}
                                    <div className="mobile-only">
                                        <select
                                            value={timePeriod}
                                            onChange={(e) => setTimePeriod(e.target.value)}
                                            style={{
                                                background: 'var(--glass-bg)',
                                                color: 'var(--text-primary)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '0.5rem',
                                                padding: '0.3rem 2rem 0.3rem 0.8rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                outline: 'none',
                                                appearance: 'none',
                                                backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'right 0.6rem center',
                                                backgroundSize: '0.6em auto',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {TIME_PERIODS.map(period => (
                                                <option key={period} value={period} style={{ color: '#000' }}>{period}</option>
                                            ))}
                                        </select>
                                    </div>

                                </div>

                                {/* RIGHT: View Mode & Columns - Desktop Only */}
                                <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

                                    {/* 1. Grouping Selector (Smart Pill) */}
                                    <div
                                        onMouseEnter={() => setIsGroupingSelectorHovered(true)}
                                        onMouseLeave={() => setIsGroupingSelectorHovered(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--glass-shine)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '2rem',
                                            padding: '0.3rem',
                                            border: '1px solid var(--glass-border)',
                                            boxShadow: isGroupingSelectorHovered ? '0 4px 20px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.3s ease',
                                            height: '2.4rem'
                                        }}
                                    >
                                        {[
                                            { value: 'none', label: 'Ungrouped' },
                                            { value: 'customGroup', label: 'Portfolio' },
                                            { value: 'type', label: 'Type' },
                                            { value: 'country', label: 'Country' }
                                        ].map(item => {
                                            const isActive = groupingKey === item.value;
                                            const isVisible = isGroupingSelectorHovered || isActive;

                                            if (!isVisible && !isActive) return null; // Logic handled by CSS generally but for pure JS render

                                            return (
                                                <button
                                                    key={item.label}
                                                    onClick={() => {
                                                        setOrderedGroups([]); // Reset order to prevent stale keys causing NaN
                                                        setGroupingKey(item.value);
                                                    }}
                                                    style={{
                                                        background: isActive ? '#6366f1' : 'transparent',
                                                        border: 'none',
                                                        borderRadius: '1.5rem',
                                                        color: isActive ? '#fff' : 'var(--text-secondary)',
                                                        maxWidth: isVisible ? '100px' : '0px',
                                                        padding: isVisible ? '0.3rem 0.8rem' : '0',
                                                        margin: isVisible ? '0 2px' : '0',
                                                        opacity: isVisible ? 1 : 0,
                                                        overflow: 'hidden',
                                                        fontSize: '0.75rem',
                                                        fontWeight: isActive ? 700 : 600,
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        display: isVisible ? 'flex' : 'none',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* 2. View Mode Selector Removed */}

                                    {/* 3. Adjust List Button (Only in List View) */}
                                    {viewMode === 'list' && (
                                        <div ref={adjustListRef} style={{ position: 'relative', marginRight: '0.8rem' }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                background: 'var(--glass-shine)',
                                                backdropFilter: 'blur(10px)',
                                                borderRadius: '2rem',
                                                padding: '0.3rem',
                                                border: '1px solid var(--glass-border)',
                                                height: '2.4rem',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                <button
                                                    onClick={() => setIsAdjustListOpen(!isAdjustListOpen)}
                                                    style={{
                                                        background: '#6366f1',
                                                        border: 'none',
                                                        borderRadius: '1.5rem',
                                                        color: '#fff',
                                                        padding: '0.3rem 0.8rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.3rem',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    title="Adjust List Columns"
                                                >
                                                    <SlidersHorizontal size={14} strokeWidth={2.5} />
                                                    {isAdjustListOpen && <span>Adjust</span>}
                                                </button>
                                            </div>

                                            {isAdjustListOpen && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    right: 0,
                                                    marginTop: '0.5rem',
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '0.8rem',
                                                    padding: '0.8rem',
                                                    width: '260px',
                                                    zIndex: 1000,
                                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
                                                    backdropFilter: 'blur(20px)',
                                                }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span>Table Columns</span>
                                                        <button
                                                            onClick={() => setActiveColumns(['PORTFOLIO_NAME', 'NAME', 'PRICE', 'VALUE', 'PL'])}
                                                            style={{
                                                                fontSize: '0.65rem',
                                                                opacity: 0.7,
                                                                fontWeight: 600,
                                                                background: 'rgba(255,255,255,0.1)',
                                                                border: 'none',
                                                                borderRadius: '0.3rem',
                                                                padding: '0.2rem 0.5rem',
                                                                cursor: 'pointer',
                                                                color: 'var(--text-primary)'
                                                            }}
                                                        >
                                                            Default
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                        {ALL_COLUMNS.map(col => {
                                                            const isVisible = activeColumns.includes(col.id);
                                                            return (
                                                                <div key={col.id}
                                                                    onClick={() => {
                                                                        if (isVisible) {
                                                                            if (activeColumns.length > 1) { // Prevent hiding all
                                                                                setActiveColumns(activeColumns.filter(id => id !== col.id));
                                                                            }
                                                                        } else {
                                                                            setActiveColumns([...activeColumns, col.id]);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'space-between',
                                                                        padding: '0.5rem',
                                                                        borderRadius: '0.4rem',
                                                                        background: isVisible ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        border: isVisible ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent'
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: '0.8rem', color: isVisible ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isVisible ? 600 : 400 }}>{col.label}</span>
                                                                    <div style={{
                                                                        width: '14px', height: '14px',
                                                                        borderRadius: '3px',
                                                                        border: isVisible ? 'none' : '2px solid var(--text-secondary)',
                                                                        background: isVisible ? '#6366f1' : 'transparent',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        opacity: isVisible ? 1 : 0.5
                                                                    }}>
                                                                        {isVisible && <Check size={10} color="#fff" strokeWidth={4} />}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px solid var(--glass-border)', fontSize: '0.7rem', opacity: 0.5, textAlign: 'center' }}>
                                                        Drag column headers in the table to reorder.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Edit Mode Toggle */}
                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--glass-shine)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '2rem',
                                            padding: '0.3rem',
                                            border: '1px solid var(--glass-border)',
                                            height: '2.4rem',
                                            transition: 'all 0.3s ease'
                                        }}>
                                            <button
                                                onClick={() => setIsGlobalEditMode(!isGlobalEditMode)}
                                                style={{
                                                    background: isGlobalEditMode ? '#f59e0b' : '#6366f1', // Yellow if Active, Blue if Default
                                                    border: 'none',
                                                    borderRadius: '1.5rem',
                                                    color: '#fff',
                                                    padding: '0.3rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.3rem',
                                                    transition: 'all 0.2s',
                                                    width: '2.4rem',
                                                    height: '100%'
                                                }}
                                                title="Toggle Edit Mode"
                                            >
                                                <Settings size={16} />
                                            </button>
                                        </div>
                                        {isGlobalEditMode && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '100%', // Moved from top: 100% to bottom: 100%
                                                right: 0,
                                                marginBottom: '0.4rem', // Changed from marginTop to marginBottom
                                                fontSize: '0.6rem',
                                                fontWeight: 600,
                                                color: 'var(--text-secondary)',
                                                animation: 'fadeIn 0.3s ease',
                                                whiteSpace: 'nowrap',
                                                background: 'var(--bg-secondary)',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '0.4rem',
                                                border: '1px solid var(--glass-border)',
                                                zIndex: 10,
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)' // Added shadow for better visibility
                                            }}>
                                                Now, you can edit your assets
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ASSETS BODY */}
                            <div style={{ minHeight: '400px' }}>
                                {showChangelog ? (
                                    <ChangelogView />
                                ) : (
                                    <>
                                        {viewMode === "list" ? (
                                            <div className="glass-panel" style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                padding: 0,
                                                gap: 0,
                                                overflowX: 'auto',
                                                overflowY: 'hidden',
                                                borderRadius: '0.8rem'
                                            }}>
                                                {/* Table Header Always Show in List View */}
                                                {true && (
                                                    <div className="asset-table-header" style={{
                                                        borderBottom: 'none',
                                                        alignItems: 'center',
                                                        display: 'grid',
                                                        gridTemplateColumns: activeColumns.map(c => COL_WIDTHS[c]).join(' '),
                                                        gap: 0,
                                                        background: 'var(--glass-shine)'
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
                                                                            <span style={{ fontSize: '0.55rem', opacity: 0.5, fontWeight: 500 }}>COST</span>
                                                                        </div>
                                                                    );
                                                                } else if (colId === 'VALUE') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
                                                                            <span>VALUE</span>
                                                                            <span style={{ fontSize: '0.55rem', opacity: 0.5, fontWeight: 500 }}>TOTAL COST</span>
                                                                        </div>
                                                                    );
                                                                } else if (colId === 'PRICE_EUR') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
                                                                            <span>PRICE ({globalSym})</span>
                                                                            <span style={{ fontSize: '0.55rem', opacity: 0.5, fontWeight: 500 }}>COST ({globalSym})</span>
                                                                        </div>
                                                                    );
                                                                } else if (colId === 'VALUE_EUR') {
                                                                    headerContent = (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
                                                                            <span>VALUE ({globalSym})</span>
                                                                            <span style={{ fontSize: '0.55rem', opacity: 0.5, fontWeight: 500 }}>TOTAL COST</span>
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <DraggableHeader key={colId} id={`col:${colId}`} columnsCount={activeColumns.length}>
                                                                        <span style={{
                                                                            fontSize: activeColumns.length > 8 ? '0.62rem' : '0.7rem',
                                                                            fontWeight: 700,
                                                                            opacity: 0.8,
                                                                            letterSpacing: '0.05em',
                                                                            whiteSpace: activeColumns.length >= 10 ? 'pre-wrap' : 'nowrap',
                                                                            display: 'block',
                                                                            textAlign: ['PRICE', 'PRICE_EUR', 'VALUE', 'VALUE_EUR', 'PL'].includes(colId) ? 'right' : 'left'
                                                                        }}>
                                                                            {colId === 'PORTFOLIO_NAME' ? <Briefcase size={activeColumns.length > 8 ? 11 : 13} strokeWidth={2.5} /> : headerContent}
                                                                        </span>
                                                                    </DraggableHeader>
                                                                );
                                                            })}
                                                        </SortableContext>
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
                                                    <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.3, fontSize: '0.9rem' }}>
                                                        No assets found for these filters.
                                                    </div>
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
                                <UnifiedPortfolioSummary totalValueEUR={totalValueEUR} isBlurred={isBlurred} />
                                <AllocationCard assets={assets} totalValueEUR={totalValueEUR} isBlurred={isBlurred} />
                            </>
                        )}

                    </div>
                </div>

            </div>

            <DeleteConfirmationModal
                isOpen={!!assetToDelete}
                onClose={() => setAssetToDelete(null)}
                onConfirm={confirmDelete}
                assetSymbol={assetToDelete?.symbol || 'Asset'}
            />

            {editingAsset && (
                <EditAssetModal
                    asset={editingAsset}
                    isOpen={!!editingAsset}
                    onClose={() => setEditingAsset(null)}
                />
            )}
        </DndContext>
    );
}

function ChangelogView() {
    const [content, setContent] = useState('Loading changelog...');

    useEffect(() => {
        fetch('/CHANGELOG.md')
            .then(res => res.text())
            .then(text => setContent(text))
            .catch(err => setContent('Failed to load changelog.'));
    }, []);

    return (
        <div className="glass-panel" style={{
            padding: '2rem',
            minHeight: '400px',
            animation: 'fadeIn 0.3s ease',
            color: 'var(--text-primary)'
        }}>
            <div style={{
                marginBottom: '1.5rem',
                borderBottom: '1px solid var(--glass-border)',
                paddingBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
            }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--glass-shine)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Changelog.txt</h2>
            </div>

            <div style={{
                fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                opacity: 0.9,
                overflowX: 'auto'
            }}>
                {content}
            </div>
        </div>
    );
}
