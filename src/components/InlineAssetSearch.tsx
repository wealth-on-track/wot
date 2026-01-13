"use client";

import { useState, useRef, useEffect } from "react";
import { SymbolOption, getCountryFlag } from "@/lib/symbolSearch";
import { searchSymbolsAction } from "@/app/actions/search";
import { getMarketPriceAction } from "@/app/actions/marketData";
import { PriceResult } from "@/services/marketData";
import { addAsset, trackLogoRequest, getAutocompleteSuggestions } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { Plus, Search, Command, X, Save, Lock } from "lucide-react"; // Icons
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";
import { ManualAssetModal } from "./ManualAssetModal";
import { getLogoUrl, getLogoProvider } from "@/lib/logos";
import { AutocompleteInput } from "./AutocompleteInput";
import { AssetCategory, CATEGORY_COLORS } from "@/lib/assetCategories";
import { formatNumber, parseFormattedNumber, formatInputNumber, isValidNumberInput } from "@/lib/numberFormat";

// Metadata Tag Component - extracted to prevent re-mounting on every render
const MetadataTag = ({ label, value, editable = false, onChange }: {
    label: string;
    value: any;
    editable?: boolean;
    onChange?: (val: string) => void
}) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        background: 'var(--bg-primary)', border: '1px solid var(--border)',
        borderRadius: '6px', padding: '0.25rem 0.5rem', flex: 1, minWidth: 0
    }}>
        <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>{label}</span>
        {editable && onChange ? (
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="Unknown"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: value ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    width: '100%',
                    caretColor: 'var(--accent)',
                    outline: 'none',
                    padding: 0,
                    margin: 0
                }}
            />
        ) : (
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</span>
        )}
    </div>
);

export function InlineAssetSearch() {
    const { t } = useLanguage();

    // Shared Styles matching EditAssetModal
    const labelStyle = {
        fontSize: '0.75rem',
        fontWeight: 800,
        color: 'var(--text-muted)',
        marginBottom: '0.4rem',
        display: 'block',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em'
    };

    const inputStyle = {
        width: '100%',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        fontSize: '0.95rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        outline: 'none',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
    };

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SymbolOption[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<SymbolOption | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showQuantityForm, setShowQuantityForm] = useState(false);
    const [marketData, setMarketData] = useState<PriceResult | null>(null);
    const [quantity, setQuantity] = useState("");
    const [buyPrice, setBuyPrice] = useState("");
    const [customGroup, setCustomGroup] = useState("");
    const [platform, setPlatform] = useState("");
    const [sector, setSector] = useState("");
    const [country, setCountry] = useState("");
    const [totalValue, setTotalValue] = useState(""); // For Funds
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isPriceLoading, setIsPriceLoading] = useState(false);  // Track price loading state
    const [suggestions, setSuggestions] = useState<{ portfolios: string[], platforms: string[] }>({ portfolios: [], platforms: [] });
    const dropdownRef = useRef<HTMLDivElement>(null);


    const router = useRouter();

    // Fetch autocomplete suggestions on mount
    useEffect(() => {
        const fetchSuggestions = async () => {
            const data = await getAutocompleteSuggestions();
            setSuggestions(data);
        };
        fetchSuggestions();
    }, []);

    // Search symbols as user types
    useEffect(() => {
        // Prevent search from running if we just selected a symbol (and the query matches it)
        if (selectedSymbol && searchQuery === selectedSymbol.symbol) {
            return;
        }

        if (searchQuery.length >= 2) {
            const fetchResults = async () => {
                const results = await searchSymbolsAction(searchQuery);

                // Sort by category priority: BIST → TEFAS → US → EU → CRYPTO → COMMODITIES → FX → CASH
                const categoryPriority: Record<AssetCategory, number> = {
                    'BIST': 1,
                    'TEFAS': 2,
                    'US_MARKETS': 3,
                    'EU_MARKETS': 4,
                    'CRYPTO': 5,
                    'COMMODITIES': 6,
                    'FX': 7,
                    'CASH': 8,
                    'BENCHMARK': 9
                };

                results.sort((a, b) => {
                    const catA = a.category || 'US_MARKETS';
                    const catB = b.category || 'US_MARKETS';

                    const priorityA = categoryPriority[catA];
                    const priorityB = categoryPriority[catB];

                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }

                    // Within same category: alphabetical by symbol
                    return a.symbol.localeCompare(b.symbol);
                });

                setSearchResults(results);
                // Only show dropdown if we don't have a selected symbol
                if (!selectedSymbol) {
                    setShowDropdown(results.length > 0 || true);
                }
            };

            const timeoutId = setTimeout(fetchResults, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    }, [searchQuery, selectedSymbol]); // Added selectedSymbol dependency

    // Fetch market price when symbol is selected
    useEffect(() => {
        if (selectedSymbol) {
            const fetchPrice = async () => {
                if (selectedSymbol.type === 'CASH') {
                    setMarketData({ price: 1.0, timestamp: new Date().toLocaleTimeString() });
                    setBuyPrice("1");
                    setIsPriceLoading(false);
                    return;
                }

                // TEFAS funds: Use TEFAS API directly, block Yahoo
                if (selectedSymbol.source === 'TEFAS' && selectedSymbol.exchange === 'TEFAS') {
                    const data = await getMarketPriceAction(selectedSymbol.symbol, 'FUND', 'TEFAS');
                    if (data) {
                        setMarketData(data);
                        // Don't override metadata - use what came from search result

                        const priceToUse = (data.price && data.price > 0) ? data.price : data.previousClose;

                        if (priceToUse !== undefined && priceToUse !== null) {
                            // Format with appropriate decimal places (min 2, max 6)
                            const formattedPrice = formatNumber(priceToUse, 2, 6);
                            setBuyPrice(formattedPrice);
                        }
                    } else {
                        // TEFAS lookup failed - set dummy state for price
                        setMarketData({
                            price: 0,
                            timestamp: new Date().toLocaleTimeString(),
                            sector: 'Fund',
                            country: 'Turkey'
                        });
                        // Metadata already set from search result
                    }
                    setIsPriceLoading(false);
                    return;
                }

                // Regular flow for non-TEFAS assets
                const data = await getMarketPriceAction(selectedSymbol.symbol, selectedSymbol.type, selectedSymbol.exchange);
                if (data) {
                    setMarketData(data);

                    // NEW: Enrich Metadata (Sector/Country) if missing
                    // This fixes the issue where EU stocks show as "UNKNOWN" sector
                    // because the lightweight search API didn't have the data, but the Quote API does.
                    if (data.sector && data.sector !== 'N/A' && (!sector || sector === 'UNKNOWN')) {
                        console.log(`[InlineSearch] Enriching Sector: ${sector} -> ${data.sector}`);
                        setSector(data.sector);
                    }
                    if (data.country && data.country !== 'N/A' && (!country || country === 'UNKNOWN')) {
                        console.log(`[InlineSearch] Enriching Country: ${country} -> ${data.country}`);
                        setCountry(data.country);
                    }

                    // Prefill buy price (AVG COST) with previous close for convenience/indication
                    // Prefer previousClose if it's available and valid (>0)
                    const priceToUse = (data.price && data.price > 0) ? data.price : data.previousClose;

                    if (priceToUse !== undefined && priceToUse !== null) {
                        // Format with appropriate decimal places (min 2, max 6)
                        const formattedPrice = formatNumber(priceToUse, 2, 6);
                        setBuyPrice(formattedPrice);
                    }
                } else {
                    // API failed - set dummy state for price but don't touch metadata
                    setMarketData({
                        price: 0,
                        timestamp: new Date().toLocaleTimeString(),
                        sector: 'N/A',
                        country: 'N/A'
                    });
                    // Metadata already set from search result in handleSelectSymbol
                }
                setIsPriceLoading(false);  // Price fetch complete (success or fail)
            };
            fetchPrice();
        }
    }, [selectedSymbol]);

    // Auto-calculate quantity for FUNDS & ETFs
    useEffect(() => {
        if ((selectedSymbol?.type === 'FUND' || selectedSymbol?.type === 'ETF') && totalValue && buyPrice) {
            const val = parseFormattedNumber(totalValue);
            const price = parseFormattedNumber(buyPrice);
            if (!isNaN(val) && !isNaN(price) && price > 0) {
                const calculatedQty = val / price;
                setQuantity(formatNumber(calculatedQty, 0, 6));
            }
        }
    }, [totalValue, buyPrice, selectedSymbol]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase();
        setSearchQuery(value);
        setSelectedSymbol(null);
        setShowQuantityForm(false);
        setTotalValue("");
    };

    const handleSelectSymbol = (option: SymbolOption) => {
        setSelectedSymbol(option);
        setSearchQuery(option.symbol);
        setShowDropdown(false);
        setShowQuantityForm(true);
        setTotalValue("");
        setBuyPrice("");  // Clear buy price - will be set by useEffect when API responds
        setIsPriceLoading(true);  // Start loading

        // Use metadata exactly as provided by search result - no overrides
        setSector(option.sector || '');
        setCountry(option.country || '');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('[DEBUG] handleSubmit triggered');

        if (!selectedSymbol) {
            console.error('[DEBUG] No selectedSymbol');
            return;
        }

        try {
            console.log('[DEBUG] handleSubmit - State values:', { sector, country, selectedSymbol, quantity, buyPrice });

            const formData = new FormData();
            formData.append('symbol', selectedSymbol.symbol);
            formData.append('type', selectedSymbol.type);
            formData.append('currency', selectedSymbol.currency);
            formData.append('exchange', selectedSymbol.exchange || '');

            // Parse TR/EU format (10.423.485,67) -> Standard (10423485.67)
            const parsedQuantity = parseFormattedNumber(quantity);
            formData.append('quantity', parsedQuantity.toString());

            // Parse TR/EU format (0,089545) -> Standard (0.089545)
            const parsedBuyPrice = parseFormattedNumber(buyPrice);
            formData.append('buyPrice', parsedBuyPrice.toString());

            if (customGroup) formData.append('customGroup', customGroup);
            if (platform) formData.append('platform', platform);

            // Add category from search result (NEW: 8-category system)
            if (selectedSymbol.category) {
                formData.append('category', selectedSymbol.category);
            }

            // Use API data for sector and country (auto-filled)
            formData.append('sector', sector || 'UNKNOWN');
            formData.append('country', country || 'UNKNOWN');

            // Add original name from search result
            console.log('[DEBUG] selectedSymbol.fullName:', selectedSymbol.fullName);
            if (selectedSymbol.fullName) {
                formData.append('originalName', selectedSymbol.fullName);
            }

            console.log('[DEBUG] FormData prepared, calling addAsset');
            const result = await addAsset(undefined, formData);
            console.log('[DEBUG] addAsset result:', result);

            if (result === 'success') {
                // Reset form
                setSearchQuery("");
                setSelectedSymbol(null);
                setShowQuantityForm(false);
                setQuantity("");
                setBuyPrice("");
                setCustomGroup("");
                setPlatform("");
                setSector("");
                setTotalValue("");
                setShowAdvanced(false);
                router.refresh();
            } else {
                console.error('[DEBUG] addAsset returned failure:', result);
                alert('Failed to add asset: ' + JSON.stringify(result));
            }
        } catch (error) {
            console.error('[DEBUG] Error in handleSubmit:', error);
            alert('An error occurred while adding the asset. Check console for details.');
        }
    };


    const handleClose = () => {
        setSearchQuery("");
        setSelectedSymbol(null);
        setShowQuantityForm(false);
        setQuantity("");
        setBuyPrice("");
        setTotalValue("");
        setCustomGroup("");
        setPlatform("");
        setSector("");
        setCountry("");
    };

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            zIndex: 9999
        }} ref={dropdownRef}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                {/* Search Icon */}
                <div style={{ position: 'absolute', left: '1rem', color: isFocused ? '#6366F1' : 'var(--text-muted)', transition: 'color 0.3s', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <Search size={18} />
                </div>

                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => {
                        setIsFocused(true);
                        if ((searchQuery.length >= 2 || searchResults.length > 0) && !selectedSymbol) setShowDropdown(true);
                    }}
                    onBlur={() => {
                        setIsFocused(false);
                    }}
                    placeholder={t('search_placeholder')}
                    className="placeholder:text-slate-600"
                    style={{
                        width: '100%',
                        fontSize: '0.9rem',
                        padding: '0.75rem 1rem 0.75rem 3rem',
                        background: isFocused ? 'var(--surface)' : 'var(--bg-secondary)',
                        border: isFocused ? '2px solid #6366F1' : '1px solid var(--border)',
                        borderRadius: '0.75rem',
                        color: 'var(--text-primary)',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        height: '44px',
                        boxShadow: isFocused ? '0 0 0 4px rgba(99, 102, 241, 0.1)' : 'none'
                    }}
                />

                {/* Command K Shortcut Hint */}
                <div style={{
                    position: 'absolute',
                    right: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    pointerEvents: 'none',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.4rem',
                    padding: '0.1rem 0.4rem',
                    backgroundColor: 'var(--bg-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600
                }}>
                    <Command size={12} />
                    <span>K</span>
                </div>
            </div>

            {showDropdown && !selectedSymbol && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.5rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 10000,
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    {searchResults.length > 0 ? (
                        searchResults.map((option, idx) => {
                            const category = option.category || 'US_MARKETS';
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectSymbol(option)}
                                    style={{
                                        width: '100%',
                                        padding: '0.4rem 0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: `${CATEGORY_COLORS[category]}08`,
                                        border: 'none',
                                        borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'left',
                                        height: '34px',
                                        borderLeft: `3px solid ${CATEGORY_COLORS[category]}`
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = `${CATEGORY_COLORS[category]}15`;
                                        e.currentTarget.style.borderLeft = `3px solid ${CATEGORY_COLORS[category]}`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = `${CATEGORY_COLORS[category]}08`;
                                        e.currentTarget.style.borderLeft = `3px solid ${CATEGORY_COLORS[category]}`;
                                    }}
                                >
                                    {/* 1. Flag/Logo - FIXED WIDTH */}
                                    <span style={{
                                        width: '24px',
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {(() => {
                                            if (option.type === 'CASH' || option.type === 'CURRENCY' || option.type === 'CRYPTO') {
                                                const url = getLogoUrl(option.symbol, option.type, option.exchange, option.country);
                                                if (url) return <img src={url} alt={option.symbol} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />;
                                            }
                                            return <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{getCountryFlag(option.country)}</span>;
                                        })()}
                                    </span>

                                    {/* 2. Asset Name - FIXED WIDTH */}
                                    <span style={{
                                        width: '140px',
                                        fontSize: '0.7rem',
                                        color: 'var(--text-secondary)',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        textAlign: 'left'
                                    }}>
                                        {option.fullName}
                                    </span>

                                    {/* Separator */}
                                    <span style={{ color: 'var(--border)', fontSize: '0.65rem', flexShrink: 0 }}>|</span>

                                    {/* 3. Ticker - FIXED WIDTH */}
                                    <span style={{
                                        width: '85px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'left',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {option.symbol}
                                    </span>

                                    {/* 4. Spacer - Takes remaining space */}
                                    <div style={{ flex: 1, minWidth: '0.5rem' }} />

                                    {/* 5. Type - FIXED WIDTH */}
                                    <span style={{
                                        width: '40px',
                                        fontSize: '0.6rem',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'right',
                                        overflow: 'hidden'
                                    }}>
                                        {option.type}
                                    </span>

                                    {/* Separator */}
                                    <span style={{ color: 'var(--border)', fontSize: '0.6rem' }}>•</span>

                                    {/* 6. Exchange - FIXED WIDTH */}
                                    <span style={{
                                        width: '50px',
                                        fontSize: '0.6rem',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'right',
                                        overflow: 'hidden'
                                    }}>
                                        {(() => {
                                            const ex = option.exchange?.toUpperCase() || '';
                                            if (ex.includes('BORSA') || ex.includes('ISTANBUL')) return 'BIST';
                                            return option.exchange;
                                        })()}
                                    </span>

                                    {/* 7. Category Badge - FIXED WIDTH */}
                                    <div style={{
                                        width: '70px',
                                        display: 'flex',
                                        justifyContent: 'flex-end'
                                    }}>
                                        <div style={{
                                            fontSize: '0.5rem',
                                            fontWeight: 800,
                                            padding: '0.05rem 0.2rem',
                                            borderRadius: '0.2rem',
                                            background: `${CATEGORY_COLORS[category]}20`,
                                            color: CATEGORY_COLORS[category],
                                            whiteSpace: 'nowrap',
                                            textTransform: 'uppercase',
                                        }}>
                                            {category.replace('_', ' ')}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', fontWeight: 500 }}>No results found for "{searchQuery}"</div>
                            <button
                                onClick={() => { setShowDropdown(false); setShowManualModal(true); }}
                                style={{
                                    width: '100%',
                                    padding: '0.875rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    fontWeight: 700,
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Plus size={18} /> Add "{searchQuery}" Manually
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showQuantityForm && selectedSymbol && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    {/* Backdrop */}
                    <div
                        style={{
                            position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)',
                            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            animation: 'fadeIn 0.2s ease'
                        }}
                        onClick={handleClose}
                    />

                    {/* Modal Card - COMPACT - 60% of original size roughly */}
                    <div className="neo-card" style={{
                        position: 'relative', width: '100%', maxWidth: '480px', // Ultra compact
                        background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        animation: 'zoomIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)'
                    }}>
                        {/* Header Section */}
                        <div style={{
                            padding: '1.2rem',
                            borderBottom: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'center'
                        }}>
                            {/* Left: Logo (Centered relative to text block) */}
                            <div style={{
                                width: '3.5rem',
                                height: '3.5rem',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: 'var(--glass-shine)',
                                border: '1px solid var(--glass-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {(() => {
                                    const logoUrl = getLogoUrl(selectedSymbol.symbol, selectedSymbol.type, selectedSymbol.exchange, selectedSymbol.country);
                                    if (logoUrl) return <img src={logoUrl} alt={selectedSymbol.symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                    const cleanSymbol = selectedSymbol.symbol.split('.')[0].toUpperCase();
                                    const placeholderText = (cleanSymbol.length === 3) ? cleanSymbol : cleanSymbol.charAt(0);
                                    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>{placeholderText}</div>;
                                })()}
                            </div>

                            {/* Right: Text Block (3 Rows) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: 0 }}>

                                {/* Row 1: Company Name + Close */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '0.5rem' }}>
                                        {selectedSymbol.fullName}
                                    </h2>
                                    <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', flexShrink: 0 }}>
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Spacer */}
                                <div style={{ height: '0.1rem' }} />

                                {/* Row 2: Ticker, Type, Exchange */}
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    {(() => {
                                        const Tag = ({ label, value }: { label: string, value: React.ReactNode }) => (
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                                borderRadius: '6px', padding: '0.25rem 0.5rem', flex: 1, minWidth: 0
                                            }}>
                                                <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>{label}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{value}</span>
                                            </div>
                                        );
                                        return (
                                            <>
                                                <Tag label="Ticker" value={selectedSymbol.symbol} />
                                                <Tag label="Type" value={selectedSymbol.type} />
                                                <Tag label="Exchange" value={(() => {
                                                    const ex = selectedSymbol.exchange?.toUpperCase() || '';
                                                    if (ex.includes('BORSA') || ex.includes('ISTANBUL')) return 'BIST';
                                                    return ex || 'N/A';
                                                })()} />
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Row 3: Currency, Sector, Country */}
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <MetadataTag label="Currency" value={selectedSymbol.currency} />
                                    <MetadataTag label="Sector" value={sector} editable onChange={setSector} />
                                    <MetadataTag label="Country" value={country} editable onChange={setCountry} />
                                </div>
                            </div>
                        </div>

                        {/* Body - Inputs matched to width */}
                        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                                {/* Group 1: YOUR INPUT - Distinct Style */}
                                <div style={{
                                    position: 'relative',
                                    border: '2px solid rgba(99, 102, 241, 0.2)', // Stronger border
                                    borderRadius: '10px',
                                    padding: '1rem 0.8rem 0.8rem 0.8rem',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '0.8rem',
                                    background: 'rgba(99, 102, 241, 0.03)' // Slight indigo tint
                                }}>
                                    <span style={{
                                        position: 'absolute',
                                        top: '-0.6rem',
                                        left: '0.8rem',
                                        background: 'var(--accent)', // Filled strong badge
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '4px',
                                        fontSize: '0.6rem',
                                        fontWeight: 800,
                                        color: '#fff',
                                        textTransform: 'uppercase',
                                        boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                                    }}>
                                        Your Input
                                    </span>

                                    {/* Quantity */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            {selectedSymbol.type === 'CASH' ? 'Amount' : 'Quantity'} <span style={{ color: 'var(--accent)' }}>*</span>
                                        </label>
                                        <input
                                            type="text" required
                                            value={quantity}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!isValidNumberInput(val)) return;
                                                setQuantity(formatInputNumber(val));
                                            }}
                                            placeholder="0"
                                            style={{ ...inputStyle, width: '100%', fontSize: '0.85rem', padding: '0.4rem', background: 'var(--bg-primary)', height: '34px', border: '1px solid var(--border)' }}
                                        />
                                    </div>

                                    {/* Avg Cost */}
                                    {selectedSymbol.type !== 'CASH' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                            <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                Avg Cost {isPriceLoading && <span style={{ fontSize: '0.5rem', color: 'var(--accent)' }}>Loading...</span>}
                                            </label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="text" required
                                                    value={buyPrice}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (!isValidNumberInput(val)) return;
                                                        setBuyPrice(formatInputNumber(val));
                                                    }}
                                                    placeholder={isPriceLoading ? "Fetching price..." : "0,00"}
                                                    disabled={isPriceLoading}
                                                    style={{
                                                        ...inputStyle,
                                                        width: '100%',
                                                        fontSize: '0.85rem',
                                                        padding: '0.4rem 2rem 0.4rem 0.4rem',
                                                        background: isPriceLoading ? 'var(--surface)' : 'var(--bg-primary)',
                                                        height: '34px',
                                                        border: '1px solid var(--border)',
                                                        opacity: isPriceLoading ? 0.6 : 1,
                                                        cursor: isPriceLoading ? 'wait' : 'text'
                                                    }}
                                                />
                                                <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                    {selectedSymbol.currency}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div />
                                    )}
                                </div>

                                {/* Group 2: OPTIONAL */}
                                <div style={{
                                    position: 'relative',
                                    border: '1px dashed var(--border)', // Dashed for optional
                                    borderRadius: '10px',
                                    padding: '1rem 0.8rem 0.8rem 0.8rem',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '0.8rem',
                                    background: 'transparent'
                                }}>
                                    <span style={{
                                        position: 'absolute',
                                        top: '-0.5rem',
                                        left: '0.8rem',
                                        background: 'var(--bg-primary)',
                                        padding: '0 0.3rem',
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        border: '1px solid var(--border)',
                                        borderRadius: '4px'
                                    }}>
                                        Optional
                                    </span>

                                    {/* Portfolio */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Portfolio</label>
                                        <AutocompleteInput
                                            value={customGroup}
                                            onChange={setCustomGroup}
                                            suggestions={suggestions.portfolios}
                                            placeholder="Default"
                                            style={{ ...inputStyle, width: '100%', fontSize: '0.85rem', padding: '0.4rem', background: 'var(--bg-primary)', height: '34px', border: '1px solid var(--border)' }}
                                        />
                                    </div>

                                    {/* Platform */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Platform</label>
                                        <AutocompleteInput
                                            value={platform}
                                            onChange={setPlatform}
                                            suggestions={suggestions.platforms}
                                            placeholder="e.g. IBKR"
                                            style={{ ...inputStyle, width: '100%', fontSize: '0.85rem', padding: '0.4rem', background: 'var(--bg-primary)', height: '34px', border: '1px solid var(--border)' }}
                                        />
                                    </div>
                                </div>

                                {/* Submit Action - Full padding button */}
                                <button
                                    type="submit"
                                    style={{
                                        background: 'var(--accent)', color: '#fff', border: 'none',
                                        padding: '0.6rem', borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                        fontWeight: 800, fontSize: '0.9rem',
                                        boxShadow: 'var(--shadow-md)', transition: 'all 0.2s',
                                        marginTop: '0.5rem'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <Save size={18} /> Add Asset to Portfolio
                                </button>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
