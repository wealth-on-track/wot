"use client";

import { useState, useRef, useEffect } from "react";
import { SymbolOption, getCountryFlag } from "@/lib/symbolSearch";
import { searchSymbolsAction } from "@/app/actions/search";
import { getMarketPriceAction } from "@/app/actions/marketData";
import { PriceResult } from "@/services/marketData";
import { addAsset } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react"; // Icon
import { ManualAssetModal } from "./ManualAssetModal"; // Component

export function InlineAssetSearch() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SymbolOption[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<SymbolOption | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showQuantityForm, setShowQuantityForm] = useState(false);
    const [marketData, setMarketData] = useState<PriceResult | null>(null);
    const [quantity, setQuantity] = useState("");
    const [buyPrice, setBuyPrice] = useState("");
    const [customGroup, setCustomGroup] = useState(""); // New state
    const [showAdvanced, setShowAdvanced] = useState(false); // New state
    const [showManualModal, setShowManualModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Search symbols as user types
    useEffect(() => {
        // Prevent search from running if we just selected a symbol (and the query matches it)
        if (selectedSymbol && searchQuery === selectedSymbol.symbol) {
            return;
        }

        if (searchQuery.length >= 2) {
            const fetchResults = async () => {
                const results = await searchSymbolsAction(searchQuery);
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
                    return;
                }
                const data = await getMarketPriceAction(selectedSymbol.symbol, selectedSymbol.type, selectedSymbol.exchange);
                if (data) {
                    setMarketData(data);
                    // Format price to max 2 decimals for cleaner UI
                    // But keep precision if it's very small (crypto)
                    let formattedPrice = data.price.toString();
                    if (data.price > 1) {
                        formattedPrice = data.price.toFixed(2);
                    }
                    setBuyPrice(formattedPrice);
                }
            };
            fetchPrice();
        }
    }, [selectedSymbol]);

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
    };

    const handleSelectSymbol = (option: SymbolOption) => {
        setSelectedSymbol(option);
        setSearchQuery(option.symbol);
        setShowDropdown(false); // Explicitly close
        setShowQuantityForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSymbol) return;

        const formData = new FormData();
        formData.append('symbol', selectedSymbol.symbol);
        formData.append('type', selectedSymbol.type);
        formData.append('currency', selectedSymbol.currency);
        formData.append('exchange', selectedSymbol.exchange || '');
        formData.append('quantity', quantity);
        formData.append('buyPrice', buyPrice);
        if (customGroup) formData.append('customGroup', customGroup);

        const result = await addAsset(undefined, formData);
        if (result === 'success') {
            // Reset form
            setSearchQuery("");
            setSelectedSymbol(null);
            setShowQuantityForm(false);
            setQuantity("");
            setBuyPrice("");
            setCustomGroup("");
            setShowAdvanced(false);
            router.refresh();
        }
    };

    return (
        <div style={{ position: 'relative', flex: 1, maxWidth: '500px' }} ref={dropdownRef}>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => {
                        if ((searchQuery.length >= 2 || searchResults.length > 0) && !selectedSymbol) setShowDropdown(true);
                    }}
                    placeholder="Search asset or add manually..."
                    className="glass-input" // This class should handle basic glass styles
                    style={{
                        width: '100%',
                        fontSize: '1rem',
                        padding: '1rem 1.5rem',
                        // Use theme variables instead of hardcoded dark colors
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '1rem',
                        color: 'var(--text-primary)', // Correct text color for light mode
                        transition: 'all 0.2s ease',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                />
            </div>

            {showDropdown && !selectedSymbol && ( // Double check: hidden if selected
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.5rem',
                    // Theme variables for dropdown - switch to primary for opacity
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    {searchResults.length > 0 ? (
                        searchResults.map((option, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectSymbol(option)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border-color)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{getCountryFlag(option.country)}</span>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{option.symbol}</span>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {option.fullName}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                    {option.type} - {option.exchange}
                                </div>
                            </button>
                        ))
                    ) : (
                        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '1rem', color: 'var(--text-primary)' }}>No results found for "{searchQuery}"</div>
                            <button
                                onClick={() => { setShowDropdown(false); setShowManualModal(true); }}
                                className="glass-button"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#6366f1',
                                    fontWeight: 600
                                }}
                            >
                                <Plus size={18} /> Add "{searchQuery}" Manually
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showQuantityForm && selectedSymbol && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.5rem',
                    // Theme variables for form modal - switch to primary for opacity
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    zIndex: 1000,
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    {/* Structured Asset Details */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.75rem',
                        marginBottom: '1.25rem',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Type</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSymbol.type}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Ticker</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSymbol.symbol}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Name</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSymbol.fullName}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Exchange</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSymbol.exchange}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Currency</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSymbol.currency}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Price</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                                {marketData ? `${marketData.price.toLocaleString()} ${marketData.currency || selectedSymbol.currency}` : 'Loading...'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Next Earnings</span>
                            <span style={{
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                textDecoration: selectedSymbol.type !== 'STOCK' ? 'line-through' : 'none',
                                opacity: selectedSymbol.type !== 'STOCK' ? 0.5 : 1
                            }}>
                                {selectedSymbol.type === 'STOCK'
                                    ? (marketData?.nextEarningsDate || 'N/A')
                                    : (marketData?.nextEarningsDate || 'N/A')}
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                                type="number"
                                step="any"
                                required
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder={selectedSymbol.type === 'CASH' ? "Amount" : "Quantity"}
                                className="glass-input"
                                style={{ flex: 1, fontSize: '0.85rem', padding: '0.6rem' }}
                            />
                            {selectedSymbol.type !== 'CASH' && (
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    value={buyPrice}
                                    onChange={(e) => setBuyPrice(e.target.value)}
                                    placeholder={"Price (" + selectedSymbol.currency + ")"}
                                    className="glass-input"
                                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.6rem' }}
                                />
                            )}
                            <button
                                type="submit"
                                className="glass-button"
                                style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                                Add
                            </button>
                        </div>

                        {/* Advanced Options Toggle */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    fontSize: '0.75rem', opacity: 0.7, textAlign: 'left',
                                    display: 'flex', alignItems: 'center', gap: '0.3rem', width: 'fit-content'
                                }}
                            >
                                {showAdvanced ? '▼' : '▶'} Advanced
                            </button>

                            {showAdvanced && (
                                <input
                                    type="text"
                                    value={customGroup}
                                    onChange={(e) => setCustomGroup(e.target.value)}
                                    placeholder="Portfolio Name (Optional)"
                                    className="glass-input"
                                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem' }}
                                />
                            )}
                        </div>
                    </form>
                </div>
            )}

            {showManualModal && (
                <ManualAssetModal
                    onClose={() => setShowManualModal(false)}
                    initialSymbol={searchQuery}
                />
            )}
        </div>
    );
}
