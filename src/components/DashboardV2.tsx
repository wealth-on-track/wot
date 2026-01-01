"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { useRouter } from "next/navigation"; // Added router
import { InlineAssetSearch } from "./InlineAssetSearch";
import { deleteAsset, updateAsset } from "@/lib/actions"; // Added updateAsset
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
import { Bitcoin, Wallet, TrendingUp, PieChart, Gem, Coins, Layers, LayoutGrid, List, Save, X, Trash2, Settings, LayoutTemplate, Grid, Check, ChevronDown, ChevronRight, GripVertical, SlidersHorizontal, Briefcase } from "lucide-react";
import { DetailedAssetCard } from "./DetailedAssetCard";
import { getCompanyName } from "@/lib/companyNames";
import { formatEUR, formatNumber } from "@/lib/formatters";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { RATES, getRate, getCurrencySymbol } from "@/lib/currency";

interface DashboardProps {
    username: string;
    isOwner: boolean;
    totalValueEUR: number;
    assets: AssetDisplay[];
    isBlurred: boolean;
}

// European number format removed (Imported)
// Company name mapping removed (Imported)

// Logo mapping for common symbols
// Systematic Logo Logic
// Local getLogoUrl removed. Imported from @/lib/logos.

const AssetLogo = ({ symbol, logoUrl, size = '3.5rem' }: { symbol: string, logoUrl?: string | null, size?: string }) => {
    const [error, setError] = useState(false);

    // Reset error if logoUrl changes
    useEffect(() => { setError(false); }, [logoUrl]);

    const logoStyle: React.CSSProperties = {
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'contain', // Changed to contain to avoid cropping text-based logos
        background: 'var(--glass-shine)',
        border: '1px solid var(--glass-border)',
        overflow: 'hidden',
        flexShrink: 0 // Prevent shrinking in flex containers
    };

    if (logoUrl && !error) {
        return (
            <div style={logoStyle}>
                <img
                    src={logoUrl}
                    alt={symbol}
                    onError={() => setError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        )
    }

    return (
        <div style={{
            ...logoStyle,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(236, 72, 153, 0.4))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size === '2rem' ? '0.8rem' : '1.2rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
            {symbol.charAt(0)}
        </div>
    );
}

import { AssetDisplay } from "@/lib/types";
import { SortableAssetRow, SortableGroup, SortableAssetCard } from "./SortableWrappers";

// Column Configurations
type ColumnId = 'TYPE' | 'NAME' | 'TICKER' | 'EXCHANGE' | 'CURRENCY' | 'PRICE' | 'VALUE' | 'PL' | 'EARNINGS' | 'PORTFOLIO_NAME';

interface ColumnConfig {
    id: ColumnId;
    label: string;
    isDefault: boolean;
}

const ALL_COLUMNS: ColumnConfig[] = [
    { id: 'TYPE', label: 'Type', isDefault: false },
    { id: 'NAME', label: 'Name', isDefault: true },
    { id: 'TICKER', label: 'Ticker', isDefault: false },
    { id: 'EXCHANGE', label: 'Exchange', isDefault: false },
    { id: 'CURRENCY', label: 'Currency', isDefault: false },
    { id: 'PRICE', label: 'Price', isDefault: true },
    { id: 'VALUE', label: 'Value', isDefault: true },
    { id: 'PL', label: 'P&L', isDefault: true },
    { id: 'EARNINGS', label: 'Next Earnings Date', isDefault: false },
    { id: 'PORTFOLIO_NAME', label: 'Portfolio', isDefault: false },
];

const COL_WIDTHS: Record<ColumnId, string> = {
    TYPE: '0.6fr',
    NAME: 'minmax(200px, 1.8fr)',
    TICKER: '0.6fr',
    EXCHANGE: '0.7fr',
    CURRENCY: '0.5fr',
    PRICE: '1fr',
    VALUE: '1.1fr',
    PL: '1.2fr',
    EARNINGS: '0.9fr',
    PORTFOLIO_NAME: '0.9fr'
};

const DraggableHeader = ({ id, children, onToggle }: { id: string, children: React.ReactNode, onToggle?: () => void }) => {
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
            id={id} // Explicitly pass ID for debugging
            className={`col-${id.replace('col:', '').toLowerCase()}`}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start', // Use flex-start for left alignment
                gap: '8px',
                height: '100%',
                paddingLeft: '0.5rem',
                borderRight: '1px dashed rgba(255,255,255,0.05)' // Subtle separator
            }}>
                <span style={{ opacity: 0.3, cursor: 'grab' }}><GripVertical size={12} /></span>
                {children}
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
}: {
    asset: AssetDisplay,
    positionsViewCurrency: string,
    totalPortfolioValueEUR: number,
    isOwner: boolean,
    onDelete: (id: string) => void,
    timeFactor: number,
    rowIndex?: number,
    columns?: ColumnId[],
    timePeriod: string
}) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [editQty, setEditQty] = useState(asset.quantity);
    const [editCost, setEditCost] = useState(asset.buyPrice);
    const [editName, setEditName] = useState(asset.name || "");
    const [editSymbol, setEditSymbol] = useState(asset.symbol);
    const [editCustomGroup, setEditCustomGroup] = useState(asset.customGroup || ""); // New
    const [isSaving, setIsSaving] = useState(false);
    const [justUpdated, setJustUpdated] = useState(false);

    // Calculate Conversion Rate
    let displayCurrency = positionsViewCurrency === 'ORG' ? asset.currency : positionsViewCurrency;
    const rate = positionsViewCurrency === 'ORG' ? 1 : getRate(asset.currency, displayCurrency);
    const currencySymbol = getCurrencySymbol(displayCurrency);

    const displayPrice = asset.currentPrice * rate;
    const displayAvgPrice = asset.buyPrice * rate;
    const displayTotalValue = (asset.currentPrice * asset.quantity) * rate;
    const displayCostBasis = (asset.buyPrice * asset.quantity) * rate;

    // Total P&L
    const totalProfitVal = displayTotalValue - displayCostBasis;
    const totalProfitPct = asset.plPercentage;

    // P&L based on Time Factor or Real 1D Data
    let periodProfitVal = totalProfitVal * timeFactor;
    let periodProfitPct = totalProfitPct * timeFactor;

    if (timePeriod === '1D') {
        // Use Real 1D Data
        periodProfitPct = asset.dailyChangePercentage || 0;

        // Convert dailyChange (EUR) to display currency
        // dailyChange is in EUR. 
        // We need rate from EUR to DisplayCurrency
        // implementation of getRate(from, to). 
        // If displayCurrency is 'ORG', it is asset.currency.
        const conversionRate = getRate('EUR', displayCurrency);
        periodProfitVal = (asset.dailyChange || 0) * conversionRate;
    }

    const isPeriodProfit = periodProfitVal >= 0;

    const fmt = (val: number, min = 2, max = 2) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }).format(val || 0);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSaving) return;
        setIsSaving(true);
        const res = await updateAsset(asset.id, {
            quantity: Number(editQty),
            buyPrice: Number(editCost),
            name: editName,
            symbol: editSymbol,
            customGroup: editCustomGroup // New
        });

        if (res.error) {
            alert(res.error);
            setIsSaving(false);
        } else {
            setIsEditing(false);
            setJustUpdated(true);
            router.refresh();
            setTimeout(() => setJustUpdated(false), 2000);
            setIsSaving(false);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(asset.id);
    };

    const logoUrl = getLogoUrl(asset.symbol, asset.type, asset.exchange);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);

    const gridTemplate = columns.map(c => COL_WIDTHS[c]).join(' ');

    const renderCell = (colId: ColumnId) => {
        switch (colId) {
            case 'TYPE':
                return (
                    <div className="col-type" style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 500 }}>
                        {asset.type}
                    </div>
                );
            case 'NAME':
                return (
                    <div className="col-name" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
                        <AssetLogo symbol={asset.symbol} logoUrl={logoUrl} size="2rem" />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: isEditing ? '4px' : '0' }}>
                            {isEditing ? (
                                <>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Asset Name"
                                        style={{
                                            background: 'var(--glass-shine)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '3px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.8rem',
                                            padding: '2px 4px',
                                            width: '100%',
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input
                                            type="text"
                                            value={editSymbol}
                                            onChange={(e) => setEditSymbol(e.target.value.toUpperCase())}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="Ticker"
                                            style={{
                                                background: 'var(--glass-shine)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '3px',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.7rem',
                                                padding: '2px 4px',
                                                width: '60px',
                                                textTransform: 'uppercase'
                                            }}
                                        />
                                        <input
                                            type="number"
                                            value={editQty}
                                            onChange={(e) => setEditQty(Number(e.target.value))}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="Qty"
                                            style={{
                                                background: 'var(--glass-shine)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '3px',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.7rem',
                                                padding: '2px 4px',
                                                width: '70px',
                                            }}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={editCustomGroup}
                                        onChange={(e) => setEditCustomGroup(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Portfolio Name"
                                        style={{
                                            background: 'var(--glass-shine)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '3px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.7rem',
                                            padding: '2px 4px',
                                            width: '100%',
                                        }}
                                    />
                                </>
                            ) : (
                                <>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {companyName}
                                    </span>
                                    {/* Subtitle logic preserved */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: 500 }}>
                                            {asset.symbol}
                                        </span>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            opacity: 0.8,
                                            fontWeight: 600,
                                            color: 'var(--accent)',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            padding: '0 4px',
                                            borderRadius: '3px'
                                        }}>
                                            x{asset.quantity >= 1000
                                                ? (asset.quantity / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
                                                : asset.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            case 'TICKER':
                return (
                    <div className="col-ticker" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{asset.symbol}</div>
                );
            case 'EXCHANGE':
                return (
                    <div className="col-exchange" style={{ fontSize: '0.75rem', opacity: 0.6 }}>{asset.exchange || '-'}</div>
                );
            case 'CURRENCY':
                return (
                    <div className="col-currency" style={{ fontSize: '0.75rem', opacity: 0.6 }}>{asset.currency || '-'}</div>
                );
            case 'PRICE':
                return (
                    <div className="col-price" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.9 }}>{currencySymbol}{fmt(displayPrice)}</span>
                        {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '2px' }}>
                                <input
                                    type="number"
                                    value={editCost}
                                    onChange={(e) => setEditCost(Number(e.target.value))}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        width: '60px',
                                        background: 'var(--glass-shine)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '3px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.7rem',
                                        padding: '2px 4px',
                                        textAlign: 'right'
                                    }}
                                />
                            </div>
                        ) : (
                            <span style={{ fontSize: '0.7rem', opacity: 0.3 }}>{currencySymbol}{fmt(displayAvgPrice)}</span>
                        )}
                    </div>
                );

            case 'VALUE':
                return (
                    <div className="col-value" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currencySymbol}{fmt(displayTotalValue, 0, 0)}</span>
                        <span className="cost-basis-display" style={{ fontSize: '0.7rem', opacity: 0.5 }}>{currencySymbol}{fmt(displayCostBasis, 0, 0)}</span>
                    </div>
                );
            case 'PL':
                return (
                    <div className="col-pl" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                        {isEditing ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2px' }}>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    style={{
                                        background: '#10b981', border: 'none',
                                        color: '#000', cursor: 'pointer', padding: '0.4rem',
                                        borderRadius: '0.3rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                    title="Save"
                                >
                                    {isSaving ? "..." : <Check size={16} />}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--glass-border)',
                                        color: 'var(--text-primary)', cursor: 'pointer', padding: '0.4rem',
                                        borderRadius: '0.3rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                    title="Discard"
                                >
                                    <X size={16} />
                                </button>
                                <button
                                    onClick={handleDelete}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#ef4444', cursor: 'pointer', padding: '0.4rem',
                                        borderRadius: '0.3rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                    title="Delete Asset"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="pl-action-container">
                                <div className="pl-column-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isPeriodProfit ? '#10b981' : '#ef4444' }}>
                                        {isPeriodProfit ? '▲' : '▼'}{fmt(periodProfitPct)}%
                                    </span>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isPeriodProfit ? '#10b981' : '#ef4444', opacity: 0.8 }}>
                                        {isPeriodProfit ? '+' : ''}{currencySymbol}{fmt(periodProfitVal, 0, 0)}
                                    </span>
                                </div>
                                {isOwner && (
                                    <div className="action-buttons-container">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsEditing(true);
                                                setEditName(asset.name || "");
                                                setEditSymbol(asset.symbol);
                                                setEditCustomGroup(asset.customGroup || ""); // New
                                                setEditQty(asset.quantity);
                                                setEditCost(asset.buyPrice);
                                            }}
                                            style={{
                                                background: 'var(--glass-shine)',
                                                border: '1px solid var(--glass-border)',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer', padding: '0.4rem',
                                                borderRadius: '0.3rem',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                                            }}
                                            title="Edit Asset"
                                        >
                                            <Settings size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case 'EARNINGS':
                return (
                    <div className="col-earnings" style={{ fontSize: '0.75rem', opacity: 0.4, textAlign: 'right' }}>-</div>
                );
            case 'PORTFOLIO_NAME':
                return (
                    <div className="col-portfolio-name" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        padding: '0 0.5rem',
                        height: '100%',
                        borderRight: '1px dashed rgba(255,255,255,0.05)'
                    }}>
                        <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            background: 'var(--glass-shine)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '0.2rem',
                            border: '1px solid var(--glass-border)'
                        }}>
                            {asset.customGroup || '-'}
                        </span>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <div
            className="asset-table-grid table-row-hover"
            style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                background: justUpdated
                    ? 'rgba(16, 185, 129, 0.1)'
                    : isEditing
                        ? 'rgba(245, 158, 11, 0.05)'
                        : (rowIndex !== undefined && rowIndex % 2 === 1)
                            ? 'rgba(255,255,255,0.02)'
                            : 'transparent'
            }}
        >
            {columns.map(colId => (
                <React.Fragment key={colId}>
                    {renderCell(colId)}
                </React.Fragment>
            ))}
        </div>
    );
}

// Reusable Asset Card Component
function AssetCard({ asset, positionsViewCurrency, totalPortfolioValueEUR, isBlurred, isOwner, onDelete, timeFactor, timePeriod, rank }: {
    asset: AssetDisplay,
    positionsViewCurrency: string,
    totalPortfolioValueEUR: number,
    isBlurred: boolean,
    isOwner: boolean,
    onDelete: (id: string) => void,
    timeFactor: number,
    timePeriod: string,
    rank?: number
}) {
    const router = useRouter(); // Initialize router

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editQty, setEditQty] = useState(asset.quantity);
    const [editCost, setEditCost] = useState(asset.buyPrice);
    const [editCustomGroup, setEditCustomGroup] = useState(asset.customGroup || ""); // New
    const [isSaving, setIsSaving] = useState(false);
    const [justUpdated, setJustUpdated] = useState(false); // New state for flash effect

    // Currency Conversion Logic
    // Base is EUR (asset.totalValueEUR) or Native (for Original)
    // Rates (approximate to match List View)
    const RATES: Record<string, number> = { EUR: 1, USD: 1.09, TRY: 37.5 };

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
        const targetRate = getRate('EUR', displayCurrency);
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
        const conversionRate = getRate('EUR', displayCurrency);
        periodProfitVal = (asset.dailyChange || 0) * conversionRate;
    }

    const logoUrl = getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country);
    const companyName = getCompanyName(asset.symbol, asset.type, asset.name);
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSaving) return;
        setIsSaving(true);

        const res = await updateAsset(asset.id, {
            quantity: Number(editQty),
            buyPrice: Number(editCost),
            customGroup: editCustomGroup // New
        });
        if (res.error) {
            alert(res.error);
            setIsSaving(false);
        } else {
            setIsEditing(false);
            setJustUpdated(true);
            router.refresh(); // Soft refresh
            setTimeout(() => setJustUpdated(false), 2000); // 2s flash
            setIsSaving(false);
        }
    };

    return (
        <div
            className="glass-panel"
            style={{
                padding: '0', // Full bleed internal padding handled by sections
                borderRadius: '0.6rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transition: 'all 0.3s ease',
                border: `1px solid ${ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']}`,
                // Highlight if just updated (Green) or Editing (Amber)
                borderColor: justUpdated ? '#10b981' : isEditing ? '#f59e0b' : (ASSET_COLORS[asset.type] || ASSET_COLORS['DEFAULT']) + '60',
                filter: isBlurred ? 'blur(8px)' : 'none',
                overflow: 'hidden',
                height: '100%',
                boxShadow: justUpdated ? '0 0 20px rgba(16, 185, 129, 0.4)' : isEditing ? '0 0 15px rgba(245, 158, 11, 0.2)' : 'none',

            }}
        >
            {/* SECTION 1: HEADER (Logo + Name/Settings) */}
            <div style={{ display: 'flex', padding: '0.6rem', borderBottom: '1px solid var(--glass-border)', height: '5.5rem', position: 'relative' }}>
                {/* Left: Logo */}
                <div style={{ marginRight: '1rem' }}>
                    <AssetLogo symbol={asset.symbol} logoUrl={logoUrl} />
                </div>

                {/* Right: Info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Fixed Height Title Container for Alignment */}
                        <div style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-primary)', minHeight: '2.4em', display: 'flex', alignItems: 'center' }}>
                            {companyName}
                        </div>
                        {/* Settings Icon (Toggles Edit Mode) */}
                        {isOwner && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // Stop DnD
                                    setIsEditing(!isEditing);
                                    // Reset edit values on open
                                    if (!isEditing) {
                                        setEditQty(asset.quantity);
                                        setEditCost(asset.buyPrice);
                                        setEditCustomGroup(asset.customGroup || ""); // New
                                    }
                                }}
                                onPointerDown={(e) => e.stopPropagation()} // Stop DnD start
                                style={{
                                    background: isEditing ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '0.3rem',
                                    cursor: 'pointer',
                                    opacity: isEditing ? 1 : 0.5,
                                    padding: '0.2rem',
                                    color: isEditing ? '#f59e0b' : 'inherit',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Settings size={16} />
                            </button>
                        )}
                    </div>
                    {/* Subtitle / Asset Info */}
                    {!isEditing && (
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
                    )}
                </div>
            </div>

            {/* SECTION 2: BODY (FINANCIALS OR EDIT FORM) */}
            <div style={{ padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>

                {isEditing ? (
                    /* EDIT MODE FORM */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%', justifyContent: 'space-between' }}>

                        {/* Inputs Container */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* Shares Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <label style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 600 }}>Shares / Quantity</label>
                                <input
                                    type="number"
                                    value={editQty}
                                    onChange={(e) => setEditQty(e.target.value as any)}
                                    onPointerDown={e => e.stopPropagation()}
                                    style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '0.3rem',
                                        padding: '0.4rem',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        width: '100%'
                                    }}
                                />
                            </div>

                            {/* Cost Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <label style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 600 }}>Avg. Cost ({asset.currency})</label>
                                <input
                                    type="number"
                                    value={editCost}
                                    onChange={(e) => setEditCost(e.target.value as any)}
                                    onPointerDown={e => e.stopPropagation()}
                                    style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '0.3rem',
                                        padding: '0.4rem',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        width: '100%'
                                    }}
                                />
                            </div>

                            {/* Portfolio Name Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <label style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 600 }}>Portfolio Name</label>
                                <input
                                    type="text"
                                    value={editCustomGroup}
                                    onChange={(e) => setEditCustomGroup(e.target.value)}
                                    onPointerDown={e => e.stopPropagation()}
                                    placeholder="Optional"
                                    style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '0.3rem',
                                        padding: '0.4rem',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        width: '100%'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>

                            {/* Delete Button (Moved here) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(asset.id);
                                }}
                                onPointerDown={e => e.stopPropagation()}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '0.3rem',
                                    padding: '0.4rem',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Delete Asset"
                            >
                                <Trash2 size={16} />
                            </button>

                            {/* Save/Cancel Group */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditing(false);
                                    }}
                                    onPointerDown={e => e.stopPropagation()}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '0.3rem',
                                        padding: '0.4rem 0.8rem',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: '0.2rem'
                                    }}
                                >
                                    <X size={14} /> Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    onPointerDown={e => e.stopPropagation()}
                                    disabled={isSaving}
                                    style={{
                                        background: '#10b981',
                                        border: 'none',
                                        borderRadius: '0.3rem',
                                        padding: '0.4rem 0.8rem',
                                        cursor: isSaving ? 'wait' : 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: '#000',
                                        display: 'flex', alignItems: 'center', gap: '0.2rem'
                                    }}
                                >
                                    <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* NORMAL VIEW MODE */
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
                                    {fmt(Math.abs(periodProfitPctVal))}%
                                </div>
                                <div style={{ fontSize: '0.75rem', color: periodProfitVal >= 0 ? '#10b981' : '#ef4444', fontWeight: 600, opacity: 0.9 }}>
                                    {periodProfitVal >= 0 ? '+' : ''}{currencySymbol} {fmt(Math.abs(periodProfitVal))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
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
    onToggle
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
    onToggle?: () => void
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.8rem', // More compact padding
                background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.05))', // Vivid Indigo Tint
                border: '1px solid rgba(99, 102, 241, 0.2)', // Matching border
                borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                borderRadius: isExpanded ? '0.6rem 0.6rem 0 0' : '0.6rem', // Slightly smaller radius
                marginBottom: isExpanded ? '0' : '0.5rem',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                userSelect: 'none',
                boxShadow: isHovered ? '0 4px 15px rgba(99, 102, 241, 0.15)' : 'none'
            }}
        >
            {/* Left Side: Group Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {/* Expander Arrow */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isExpanded ? 'var(--text-primary)' : 'var(--text-muted)',
                    transition: 'transform 0.3s ease',
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                }}>
                    <ChevronDown size={16} /> {/* Smaller Icon */}
                </div>

                {/* Icon Circle */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '1.8rem', height: '1.8rem',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', // Vivid Gradient (Indigo -> Purple)
                    borderRadius: '50%',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)', // Subtle inner border
                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.4)' // Glow effect
                }}>
                    {getGroupIcon(type)}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em', lineHeight: 1.1 }}>{type}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 500 }}>{count} Assets</span>
                </div>
            </div>

            {/* Right Side: Totals (Aligned Columns) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Percentage Badge - Fixed Width for Vertical Alignment */}
                <div style={{
                    width: '3rem', // Fixed width to align vertically
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#fff',
                    background: '#6366f1',
                    padding: '0.15rem 0',
                    borderRadius: '1rem',
                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)'
                }}>
                    {percentage.toFixed(0)}%
                </div>

                {/* Amount - Fixed Min-Width for Vertical Alignment */}
                <div style={{
                    minWidth: '6rem', // Fixed min-width so percentage doesn't shift
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end', // Right align
                    textAlign: 'right'
                }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{currencySymbol}{fmt(totalEUR * rate)}</span>
                </div>
            </div>
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
        <div style={{ marginBottom: '1rem' }}>
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
    timePeriod
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
    timePeriod: string
}) {
    const [isExpanded, setIsExpanded] = useState(false); // Default: Collapsed

    const RATES: Record<string, number> = { EUR: 1, USD: 1.09, TRY: 37.5 };
    const rate = positionsViewCurrency === 'ORIGINAL' ? 1 : (RATES[positionsViewCurrency] || 1);
    const displayCurrency = positionsViewCurrency === 'ORIGINAL' ? 'EUR' : positionsViewCurrency;
    const currencySymbol = displayCurrency === 'EUR' ? '€' : displayCurrency === 'USD' ? '$' : displayCurrency === 'TRY' ? '₺' : '€';

    const fmt = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

    return (
        <div style={{ marginBottom: '1rem' }}>
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
            />

            {/* Assets in Group - Collapsible */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: isExpanded ? '2000px' : '0',
                opacity: isExpanded ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                paddingLeft: '0.5rem', // Indent
                gap: '2px'
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
    timePeriod
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
    timePeriod: string
}) {
    const [isExpanded, setIsExpanded] = useState(false); // Default: Collapsed

    const RATES: Record<string, number> = { EUR: 1, USD: 1.09, TRY: 37.5 };
    const rate = (positionsViewCurrency as string) === 'ORIGINAL' ? 1 : (RATES[positionsViewCurrency] || 1);
    const displayCurrency = (positionsViewCurrency as string) === 'ORIGINAL' ? 'EUR' : positionsViewCurrency;
    const currencySymbol = displayCurrency === 'EUR' ? '€' : displayCurrency === 'USD' ? '$' : displayCurrency === 'TRY' ? '₺' : '€';
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




export default function Dashboard({ username, isOwner, totalValueEUR, assets, isBlurred }: DashboardProps) {
    const router = useRouter();
    // Initialize items with default sort (Weight Descending)
    const [items, setItems] = useState<AssetDisplay[]>([]);
    const [orderedGroups, setOrderedGroups] = useState<string[]>([]);
    const [isGroupingEnabled, setIsGroupingEnabled] = useState(false);
    const [viewMode, setViewMode] = useState<"list" | "grid" | "detailed">("list");
    const [gridColumns, setGridColumns] = useState<1 | 2>(2);
    const [timePeriod, setTimePeriod] = useState("ALL");
    const [isTimeSelectorHovered, setIsTimeSelectorHovered] = useState(false);
    const [isGroupingSelectorHovered, setIsGroupingSelectorHovered] = useState(false);
    const [isViewSelectorHovered, setIsViewSelectorHovered] = useState(false);

    // Delete Confirmation State
    const [assetToDelete, setAssetToDelete] = useState<AssetDisplay | null>(null);

    // Column State
    const [activeColumns, setActiveColumns] = useState<ColumnId[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('user_columns');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        // Filter out any columns that no longer exist in ALL_COLUMNS
                        return parsed.filter((id: string) => ALL_COLUMNS.some(c => c.id === id));
                    }
                } catch (e) {
                    console.error("Failed to parse user columns", e);
                }
            }
        }
        return ALL_COLUMNS.filter(c => c.isDefault).map(c => c.id);
    });
    const [isAdjustListOpen, setIsAdjustListOpen] = useState(false);

    // Persist Columns
    useEffect(() => {
        localStorage.setItem('user_columns', JSON.stringify(activeColumns));
    }, [activeColumns]);

    const { currency: globalCurrency } = useCurrency();
    const positionsViewCurrency = globalCurrency;

    // Update items when assets prop changes (initial load or refetch)
    useEffect(() => {
        const sorted = [...assets].sort((a, b) => b.totalValueEUR - a.totalValueEUR);
        setItems(sorted);
    }, [assets]);

    // Force List View on Mobile
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setViewMode("list");
            }
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    // Filter assets
    const filteredAssets = useMemo(() => {
        return items.filter(asset => {
            if (typeFilter && asset.type !== typeFilter) return false;
            if (exchangeFilter && asset.exchange !== exchangeFilter) return false;
            if (currencyFilter && asset.currency !== currencyFilter) return false;
            if (countryFilter && asset.country !== countryFilter) return false;
            if (sectorFilter && asset.sector !== sectorFilter) return false;
            if (platformFilter && asset.platform !== platformFilter) return false;
            return true;
        });
    }, [items, typeFilter, exchangeFilter, currencyFilter, countryFilter, sectorFilter, platformFilter]);

    // Memoize sorted assets
    const sortedAssets = useMemo(() => {
        // Assuming a sortConfig state exists or is defined elsewhere for sorting
        // For now, let's use a default sort or assume `items` are already sorted if no explicit sortConfig is provided.
        // If `sortConfig` is not defined, this will need to be adjusted.
        // For the purpose of this edit, I'll assume a `sortConfig` exists or use a placeholder.
        // Let's use the initial sort from `useEffect` for now if no `sortConfig` is available.
        // If `sortConfig` is meant to be a state, it should be declared.
        // For now, I'll use a placeholder sort that keeps the order from `filteredAssets`.
        return [...filteredAssets].sort((a, b) => b.totalValueEUR - a.totalValueEUR); // Default sort by totalValueEUR descending
    }, [filteredAssets]); // Add sortConfig to dependencies if it becomes a state

    // Grouping Logic
    const groupedAssets = useMemo(() => {
        if (!isGroupingEnabled) return { 'All Assets': sortedAssets };

        return sortedAssets.reduce((acc, asset) => {
            const groupKey = asset.customGroup || asset.type || 'Other'; // Prioritize custom portfolio name
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(asset);
            return acc;
        }, {} as Record<string, AssetDisplay[]>);
    }, [sortedAssets, isGroupingEnabled]);


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

            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
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



    const isDragEnabled = !activeFilterCategory && !typeFilter && !exchangeFilter && !currencyFilter && !countryFilter && !sectorFilter && !platformFilter;

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

    // Get unique values for each filter
    const types = Array.from(new Set(assets.map(a => a.type).filter(Boolean))) as string[];
    const exchanges = Array.from(new Set(assets.map(a => a.exchange).filter(Boolean))) as string[];
    const currencies = Array.from(new Set(assets.map(a => a.currency).filter(Boolean))) as string[];
    const countries = Array.from(new Set(assets.map(a => a.country).filter(Boolean))) as string[];
    const sectors = Array.from(new Set(assets.map(a => a.sector).filter(Boolean))) as string[];
    const platforms = Array.from(new Set(assets.map(a => a.platform).filter(Boolean))) as string[];

    // Filter categories
    const filterCategories = [
        { id: 'type', label: 'Type', items: types, active: typeFilter, setter: setTypeFilter, icon: '🏷️' },
        { id: 'exchange', label: 'Exchange', items: exchanges, active: exchangeFilter, setter: setExchangeFilter, icon: '📍' },
        { id: 'currency', label: 'Currency', items: currencies, active: currencyFilter, setter: setCurrencyFilter, icon: '💱' },
        { id: 'country', label: 'Country', items: countries, active: countryFilter, setter: setCountryFilter, icon: '🌍' },
        { id: 'sector', label: 'Sector', items: sectors, active: sectorFilter, setter: setSectorFilter, icon: '🏢' },
        { id: 'platform', label: 'Platform', items: platforms, active: platformFilter, setter: setPlatformFilter, icon: '🏦' },
    ];

    // Close Adjust List on outside click
    const adjustListRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (adjustListRef.current && !adjustListRef.current.contains(event.target as Node)) {
                setIsAdjustListOpen(false);
            }
        };

        if (isAdjustListOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAdjustListOpen]);

    const activeFiltersCount = [typeFilter, exchangeFilter, currencyFilter, countryFilter, sectorFilter, platformFilter].filter(Boolean).length;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div id="dnd-wrapper">
                <div className="dashboard-layout-container">

                    {/* LEFT COLUMN: Main Content (Filters + Assets) - Flex Grow */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

                        {/* 1. Smart Filter Bar (Compacted & No Label) */}
                        <div className="glass-panel" style={{
                            borderRadius: '0.6rem',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                        }}>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>


                                {filterCategories.map(category => (
                                    <div key={category.id} style={{ position: 'relative' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveFilterCategory(activeFilterCategory === category.id ? null : category.id); }}
                                            style={{
                                                background: category.active ? 'var(--bg-active)' : 'var(--glass-bg)',
                                                border: category.active ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                                                borderRadius: '0.4rem',
                                                color: category.active ? 'var(--accent)' : 'var(--text-secondary)',
                                                padding: '0.3rem 0.6rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem'
                                            }}
                                        >
                                            <span style={{ opacity: 0.7 }}>{category.icon}</span>
                                            <span>{category.label}</span>
                                            {category.active && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({category.active})</span>}
                                            <span style={{ fontSize: '0.6rem', opacity: 0.4 }}>▼</span>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {activeFilterCategory === category.id && category.items.length > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                marginTop: '0.4rem',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '0.5rem',
                                                padding: '0.4rem',
                                                minWidth: '180px',
                                                maxHeight: '250px',
                                                overflowY: 'auto',
                                                zIndex: 1000,
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
                                                            marginBottom: '0.1rem'
                                                        }}
                                                    >
                                                        {item}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={() => {
                                        setTypeFilter(null);
                                        setExchangeFilter(null);
                                        setCurrencyFilter(null);
                                        setCountryFilter(null);
                                        setSectorFilter(null);
                                        setPlatformFilter(null);
                                    }}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '0.4rem',
                                        color: '#ef4444',
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        marginLeft: 'auto'
                                    }}
                                >
                                    Clear All
                                </button>
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
                                            { value: false, label: 'Flat' },
                                            { value: true, label: 'Groups' }
                                        ].map(item => {
                                            const isActive = isGroupingEnabled === item.value;
                                            const isVisible = isGroupingSelectorHovered || isActive;

                                            return (
                                                <button
                                                    key={item.label}
                                                    onClick={() => setIsGroupingEnabled(item.value)}
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
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* 2. View Mode Selector (Smart Pill) */}
                                    <div
                                        onMouseEnter={() => setIsViewSelectorHovered(true)}
                                        onMouseLeave={() => setIsViewSelectorHovered(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--glass-shine)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '2rem',
                                            padding: '0.3rem',
                                            border: '1px solid var(--glass-border)',
                                            boxShadow: isViewSelectorHovered ? '0 4px 20px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.3s ease',
                                            height: '2.4rem'
                                        }}
                                    >
                                        {[
                                            { value: 'list', icon: List, label: 'List' },
                                            { value: 'grid', icon: LayoutGrid, label: 'Grid' },
                                            { value: 'detailed', icon: LayoutTemplate, label: 'Cards' }
                                        ].map((item) => {
                                            const isActive = viewMode === item.value;
                                            const isVisible = isViewSelectorHovered || isActive;
                                            const Icon = item.icon;

                                            return (
                                                <button
                                                    key={item.value}
                                                    onClick={() => setViewMode(item.value as any)}
                                                    title={item.label}
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
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.3rem'
                                                    }}
                                                >
                                                    <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 700 : 600 }}>{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* 3. Adjust List Button (Only in List View) */}
                                    {viewMode === 'list' && (
                                        <div ref={adjustListRef} style={{ position: 'relative' }}>
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
                                                            onClick={() => setActiveColumns(['NAME', 'PRICE', 'VALUE', 'PL'])}
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
                                                            Reset
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
                                </div>
                            </div>

                            {/* ASSETS BODY */}
                            <div style={{ minHeight: '400px' }}>
                                {viewMode === "list" ? (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {/* Table Header Always Show in List View */}
                                        {true && (
                                            <div className="asset-table-header glass-panel" style={{
                                                borderBottom: '1px solid var(--glass-border)',
                                                borderRadius: '0.5rem 0.5rem 0 0',
                                                alignItems: 'center',
                                                display: 'grid',
                                                gridTemplateColumns: activeColumns.map(c => COL_WIDTHS[c]).join(' ')
                                            }}>
                                                <SortableContext items={activeColumns.map(c => `col:${c}`)} strategy={rectSortingStrategy}>
                                                    {activeColumns.map(colId => {
                                                        const colDef = ALL_COLUMNS.find(c => c.id === colId);
                                                        return (
                                                            <DraggableHeader key={colId} id={`col:${colId}`}>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8, letterSpacing: '0.05em' }}>
                                                                    {colId === 'PORTFOLIO_NAME' ? <Briefcase size={13} strokeWidth={2.5} /> : colDef?.label.toUpperCase()}
                                                                </span>
                                                            </DraggableHeader>
                                                        );
                                                    })}
                                                </SortableContext>
                                            </div>
                                        )}

                                        {isGroupingEnabled ? (
                                            <SortableContext items={orderedGroups.map(g => `group:${g}`)} strategy={verticalListSortingStrategy}>
                                                {orderedGroups.map(type => (
                                                    <SortableGroup key={type} id={`group:${type}`}>
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
                                                        />
                                                    </SortableGroup>
                                                ))}
                                            </SortableContext>
                                        ) : (
                                            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                                {filteredAssets.map((asset, index) => (
                                                    <SortableAssetRow key={asset.id} id={asset.id}>
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
                                                        <SortableGroup key={type} id={`group:${type}`}>
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
                                                            // dragHandleProps are injected by SortableGroup but here we are inside it?
                                                            // dragHandleProps are injected by SortableGroup but here we are inside it? 
                                                            // Usually we need the wrapper. SortableGroup wraps children.
                                                            // Let's assume SortableGroup handles the DND ref for the item, 
                                                            // but we need a handle. 
                                                            // Actually, let's keep it simple: AssetGroupGrid renders the header which triggers Toggle. 
                                                            // The drag handle should be distinct if we want DND.
                                                            // However, previous code injected dragHandleProps via AssetGroupGridWrapper.
                                                            // We can pass an empty object or handle it if we have the props propogated.
                                                            // For now, let's assume simple rendering.
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
                                                            <SortableAssetCard key={asset.id} id={asset.id}>
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
                        <div style={{ marginTop: 'auto', padding: '1rem', opacity: 0.2, fontSize: '0.6rem', textAlign: 'center' }}>
                            Build: 2026-01-02-001
                        </div>
                    </div>
                </div>

            </div >

            <DeleteConfirmationModal
                isOpen={!!assetToDelete}
                onClose={() => setAssetToDelete(null)}
                onConfirm={confirmDelete}
                assetSymbol={assetToDelete?.symbol || 'Asset'}
            />
        </DndContext>
    );
}
