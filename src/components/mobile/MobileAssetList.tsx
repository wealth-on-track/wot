"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, TrendingUp, TrendingDown, Weight, List, Clock, History } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import type { AssetDisplay } from "@/lib/types";
import { MobileAssetCard } from "./MobileAssetCard";
import { MobileClosedPositions } from "./MobileClosedPositions";
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

interface MobileAssetListProps {
    assets: AssetDisplay[];
    onEdit: (asset: AssetDisplay) => void;
    isCompact?: boolean;
    maxDisplay?: number;
    onViewAll?: () => void;
    onOpenSettings?: () => void;
    visibleFields?: any;
    isPrivacyMode?: boolean;
    highlightId?: string | null;
    onAdd?: () => void;
    totalValueEUR?: number;
}

type FilterType = 'ALL' | 'GAINERS' | 'LOSERS' | 'WEIGHT' | 'CLOSED';

export function MobileAssetList({
    assets,
    onEdit,
    isCompact = false,
    maxDisplay,
    onViewAll,
    onOpenSettings,
    isPrivacyMode = false,
    highlightId,
    onAdd,
    totalValueEUR = 0
}: MobileAssetListProps) {
    const { currency } = useCurrency();
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Time Horizon State
    const [timeHorizon, setTimeHorizon] = useState<'1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL'>('ALL');
    const [showTimeMenu, setShowTimeMenu] = useState(false);

    // -- DnD State --
    // We only allow DnD when filter is 'ALL' to avoid confusion
    const [customOrderIds, setCustomOrderIds] = useState<string[]>([]);

    // Initialize custom order if empty or when assets change significantly
    useEffect(() => {
        if (assets.length > 0 && (customOrderIds.length === 0 || customOrderIds.length !== assets.length)) {
            const existingSet = new Set(customOrderIds);
            const newIds = assets.filter(a => !existingSet.has(a.id)).map(a => a.id);
            if (newIds.length > 0 || customOrderIds.length === 0) {
                setCustomOrderIds(assets.map(a => a.id));
            }
        }
    }, [assets, customOrderIds.length]);

    const processedAssets = useMemo(() => {
        let result = [...assets];

        // 1. Filter/Sort
        switch (filter) {
            case 'GAINERS':
                result.sort((a, b) => b.plPercentage - a.plPercentage);
                break;
            case 'LOSERS':
                result.sort((a, b) => a.plPercentage - b.plPercentage);
                break;
            case 'WEIGHT':
                result.sort((a, b) => b.totalValueEUR - a.totalValueEUR);
                break;
            case 'ALL':
            default:
                // Apply custom order if exists, otherwise keep passed order (usually value sorted)
                if (customOrderIds.length > 0) {
                    const orderMap = new Map(customOrderIds.map((id, index) => [id, index]));
                    result.sort((a, b) => {
                        const indexA = orderMap.get(a.id) ?? 9999;
                        const indexB = orderMap.get(b.id) ?? 9999;
                        return indexA - indexB;
                    });
                }
                break;
        }

        if (maxDisplay) {
            result = result.slice(0, maxDisplay);
        }

        return result;
    }, [assets, filter, maxDisplay, customOrderIds]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setCustomOrderIds((currentIds) => {
                const oldIndex = currentIds.indexOf(active.id as string);
                const newIndex = currentIds.indexOf(over.id as string);

                // If ID is missing (new asset), assume it was at the end or handle gracefully
                if (oldIndex === -1 || newIndex === -1) return currentIds;

                return arrayMove(currentIds, oldIndex, newIndex);
            });
        }
    };

    const filterOptions: { key: FilterType; label: string; icon: any }[] = [
        { key: 'ALL', label: 'All', icon: List },
        { key: 'GAINERS', label: 'Gainers', icon: TrendingUp },
        { key: 'LOSERS', label: 'Losers', icon: TrendingDown },
        { key: 'WEIGHT', label: 'Weight', icon: Weight },
        { key: 'CLOSED', label: 'Closed Positions', icon: History },
    ];

    const currentFilterLabel = filterOptions.find(f => f.key === filter)?.label || 'All';
    const CurrentFilterIcon = filterOptions.find(f => f.key === filter)?.icon || List;

    // Auto Compact Logic
    const shouldCompact = assets.length > 5;

    if (assets.length === 0) {
        return (
            <div style={{
                background: 'var(--surface)',
                borderRadius: '24px',
                border: '1px dashed var(--border)',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                marginTop: '1rem'
            }}>
                <div style={{
                    fontSize: '2.5rem',
                    background: 'var(--bg-secondary)',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.5rem'
                }}>
                    🌱
                </div>
                <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Start Your Journey
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '280px' }}>
                        "The best time to plant a tree was 20 years ago. The second best time is now."
                    </p>
                </div>

                {onAdd && (
                    <button
                        onClick={onAdd}
                        style={{
                            marginTop: '1rem',
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: '16px',
                            padding: '16px 32px',
                            color: '#fff',
                            fontSize: '1rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
                            transition: 'transform 0.2s',
                        }}
                    >
                        <span style={{ fontSize: '1.4rem', lineHeight: 0.5, marginTop: '-2px' }}>+</span>
                        Add First Asset
                    </button>
                )}
            </div>
        );
    }

    return (
        <div style={{
            background: 'transparent',
            borderRadius: '0',
            overflow: 'visible', // Visible for sticky header
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            {/* Sticky Header */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 40,
                background: 'rgba(var(--bg-main-rgb), 0.95)', // Assuming css variable or fallback
                backdropFilter: 'blur(12px)',
                padding: '8px 4px',
                margin: '0 -4px', // Compensation for list padding
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid transparent' // Optional separator
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Filter Button */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => !isCompact && setShowFilterMenu(!showFilterMenu)}
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                cursor: isCompact ? 'default' : 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                            }}
                        >
                            {!isCompact && <CurrentFilterIcon size={14} />}
                            {isCompact ? 'Top Positions' : currentFilterLabel}
                            {!isCompact && <ChevronDown size={14} style={{ opacity: 0.5 }} />}
                        </button>

                        {/* Filter Dropdown */}
                        {showFilterMenu && !isCompact && (
                            <>
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                    onClick={() => setShowFilterMenu(false)}
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    marginTop: '8px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '16px',
                                    padding: '8px',
                                    minWidth: '160px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                    zIndex: 50,
                                    transformOrigin: 'top left'
                                }}>
                                    {filterOptions.map(option => (
                                        <button
                                            key={option.key}
                                            onClick={() => {
                                                setFilter(option.key);
                                                setShowFilterMenu(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '10px 12px',
                                                background: filter === option.key ? 'var(--bg-secondary)' : 'transparent',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: filter === option.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                marginBottom: '2px'
                                            }}
                                        >
                                            <option.icon size={14} />
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Time Horizon Button (Hidden in compact for now or just allow it) */}
                    {!isCompact && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowTimeMenu(!showTimeMenu)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid transparent',
                                    borderRadius: '12px',
                                    padding: '8px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                }}
                            >
                                <Clock size={14} />
                                {timeHorizon}
                                <ChevronDown size={14} style={{ opacity: 0.5 }} />
                            </button>

                            {showTimeMenu && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                        onClick={() => setShowTimeMenu(false)}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '8px',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '16px',
                                        padding: '8px',
                                        minWidth: '100px',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                        zIndex: 50
                                    }}>
                                        {(['1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as const).map(option => (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    setTimeHorizon(option);
                                                    setShowTimeMenu(false);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: timeHorizon === option ? 'var(--bg-secondary)' : 'transparent',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    color: timeHorizon === option ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    marginBottom: '2px'
                                                }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Add Button */}
                {!isCompact && onAdd && (
                    <button
                        onClick={onAdd}
                        style={{
                            background: 'var(--accent)',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                            color: '#fff'
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                    </button>
                )}
            </div>

            {/* List */}
            {filter === 'CLOSED' ? null : filter === 'ALL' && !maxDisplay ? (
                // Draggable List only for ALL view
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={processedAssets.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {processedAssets.map((asset) => (
                                <SortableAssetItem
                                    key={asset.id}
                                    asset={asset}
                                    currency={currency}
                                    onEdit={onEdit}
                                    isPrivacyMode={isPrivacyMode}
                                    totalPortfolioValue={totalValueEUR}
                                    isCompactMode={isCompact || shouldCompact}
                                    timeHorizon={timeHorizon} // Pass prop
                                    highlightId={highlightId} // Pass prop
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                // Static List for filtered views
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {processedAssets.map((asset) => (
                        <MobileAssetCard
                            key={asset.id}
                            asset={asset}
                            currency={currency}
                            onEdit={onEdit}
                            isPrivacyMode={isPrivacyMode}
                            totalPortfolioValue={totalValueEUR}
                            isCompactMode={isCompact || (shouldCompact && !maxDisplay)}
                            isTopList={isCompact}
                            timeHorizon={timeHorizon} // Pass prop
                            highlightId={highlightId} // Pass prop
                        />
                    ))}
                </div>
            )}

            {/* Closed Positions View */}
            {filter === 'CLOSED' && (
                <MobileClosedPositions assets={assets} />
            )}
        </div>
    );
}

// Wrapper for Sortable Item
function SortableAssetItem(props: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.asset.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative' as 'relative',
        zIndex: isDragging ? 10 : 1,
        touchAction: 'pan-y' // Allow vertical scrolling but capture horizontal for swipe? No, dnd-kit handles this.
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <MobileAssetCard {...props} />
        </div>
    );
}
