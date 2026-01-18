"use client";

import { useState, useEffect } from "react";
import { X, Save, TrendingUp, Bitcoin, Coins, Landmark, Building, Briefcase, Search, Loader2 } from "lucide-react";
import { addAsset, searchAssets, getAssetMetadata, getAutocompleteSuggestions } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { ASSET_COLORS } from "@/lib/constants";
import { AutocompleteInput } from "./AutocompleteInput";

interface ManualAssetModalProps {
    onClose: () => void;
    initialSymbol?: string;
}

const ASSET_TYPES = [
    { id: 'STOCK', label: 'Stock', icon: <TrendingUp size={24} />, color: ASSET_COLORS['STOCK'] },
    { id: 'CRYPTO', label: 'Crypto', icon: <Bitcoin size={24} />, color: ASSET_COLORS['CRYPTO'] },
    { id: 'GOLD', label: 'Gold', icon: <Coins size={24} />, color: ASSET_COLORS['GOLD'] },
    { id: 'BOND', label: 'Bond', icon: <Landmark size={24} />, color: ASSET_COLORS['BOND'] },
    { id: 'FUND', label: 'ETF & Fund', icon: <Briefcase size={24} />, color: ASSET_COLORS['FUND'] },
    { id: 'CASH', label: 'Cash', icon: <Building size={24} />, color: ASSET_COLORS['CASH'] },
];

export function ManualAssetModal({ onClose, initialSymbol = "" }: ManualAssetModalProps) {
    const router = useRouter();
    // Skip to Step 2: Form directly (user can change category from form)
    const [step, setStep] = useState<0 | 1 | 2>(2);
    const [type, setType] = useState<string>("STOCK");

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Form Data
    const [symbol, setSymbol] = useState(initialSymbol);
    const [quantity, setQuantity] = useState("");
    const [buyPrice, setBuyPrice] = useState("");
    const [currency, setCurrency] = useState("USD");

    // Metadata (Auto-filled)
    const [exchange, setExchange] = useState("");
    const [sector, setSector] = useState("");
    const [country, setCountry] = useState("");
    const [name, setName] = useState("");

    // Optional
    const [platform, setPlatform] = useState("");
    const [customGroup, setCustomGroup] = useState(""); // Portfolio Name

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [suggestions, setSuggestions] = useState<{ portfolios: string[], platforms: string[] }>({ portfolios: [], platforms: [] });

    // Fetch autocomplete suggestions on mount
    useEffect(() => {
        const fetchSuggestions = async () => {
            const data = await getAutocompleteSuggestions();
            setSuggestions(data);
        };
        fetchSuggestions();
    }, []);
    const [totalValue, setTotalValue] = useState(""); // Only for BES (retirement funds)

    // Auto-search effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true);
                const results = await searchAssets(searchQuery);
                setSearchResults(results);
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Auto-calculate quantity if totalValue and buyPrice are provided for BES only
    useEffect(() => {
        if (type === 'BES' && totalValue && buyPrice) {
            const val = parseFloat(totalValue);
            const price = parseFloat(buyPrice);
            if (!isNaN(val) && !isNaN(price) && price > 0) {
                setQuantity((val / price).toFixed(6));
            }
        }
    }, [totalValue, buyPrice, type]);

    const handleSelectAsset = async (asset: any) => {
        setIsSearching(true);
        // Fetch full metadata
        const metadata = await getAssetMetadata(asset.symbol);

        setSymbol(asset.symbol);
        setName(metadata?.name || asset.shortname || asset.longname || "");
        setExchange(metadata?.exchange || asset.exchange || "");
        setCurrency(metadata?.currency || "USD"); // Default to USD if unknown
        setSector(metadata?.sector || "");
        setCountry(metadata?.country || "");

        // Auto-set type based on search result type
        // quoteType: EQUITY, CRYPTOCURRENCY, ETF, MUTUALFUND
        let detectedType = 'STOCK';
        if (asset.quoteType === 'CRYPTOCURRENCY') detectedType = 'CRYPTO';
        else if (asset.quoteType === 'ETF') detectedType = 'FUND';
        else if (asset.quoteType === 'MUTUALFUND') detectedType = 'FUND';

        setType(detectedType);

        if (metadata?.currentPrice) {
            setBuyPrice(metadata.currentPrice.toString());
        }

        setIsSearching(false);
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('symbol', symbol.toUpperCase());
        formData.append('type', type);
        formData.append('quantity', quantity);
        formData.append('buyPrice', buyPrice);
        formData.append('currency', currency);

        // Add metadata
        if (exchange) formData.append('exchange', exchange);
        if (sector) formData.append('sector', sector);
        if (country) formData.append('country', country);
        if (platform) formData.append('platform', platform);

        if (customGroup) formData.append('customGroup', customGroup);

        // Send the asset name from search/metadata as originalName
        if (name) formData.append('originalName', name);

        const res = await addAsset(undefined, formData);

        if (res === 'success') {
            router.refresh();
            onClose();
        } else {
            alert("Error adding asset: " + res);
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="neo-card"
                style={{
                    width: '100%',
                    maxWidth: step === 2 ? '900px' : '540px',
                    borderRadius: 'var(--radius-lg)',
                    padding: step === 2 ? '1.75rem' : '2rem',
                    position: 'relative',
                    background: 'var(--bg-primary)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    transition: 'all 0.3s ease'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        {step === 0 ? 'Search Asset' : step === 1 ? 'Select Category' : 'Configure Asset'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', display: 'flex', transition: 'all 0.2s' }}>
                        <X size={20} />
                    </button>
                </div>

                {step === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                autoFocus
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by name or ticker (e.g. AAPL, Apple)"
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 3rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                            {isSearching && <Loader2 className="animate-spin" size={20} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)' }} />}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                            {searchResults.map((result) => (
                                <button
                                    key={result.symbol}
                                    onClick={() => handleSelectAsset(result)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1rem',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid transparent',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{result.symbol}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{result.shortname || result.longname}</div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--surface)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                        {result.exchange}
                                    </div>
                                </button>
                            ))}
                            {searchQuery.length > 2 && searchResults.length === 0 && !isSearching && (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No results found</div>
                            )}
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', textAlign: 'center' }}>
                            <button
                                onClick={() => setStep(1)}
                                style={{
                                    background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Skip Search & Enter Manually
                            </button>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    /* STEP 1: TYPE SELECTION */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        {ASSET_TYPES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => { setType(t.id); setStep(2); }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '1rem',
                                    padding: '1.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    color: 'var(--text-primary)',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{
                                    color: '#fff',
                                    background: t.color,
                                    padding: '0.75rem',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    boxShadow: `0 4px 12px ${t.color}40`
                                }}>{t.icon}</div>
                                <span style={{ fontSize: '1rem', fontWeight: 800 }}>{t.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {step === 2 && (
                    /* STEP 2: FORM - REDESIGNED 3-COLUMN LAYOUT */
                    <>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Type Indicator - Compact */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: 'var(--bg-secondary)',
                                padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                                border: `1px solid var(--border)`,
                            }}>
                                <div style={{ color: ASSET_COLORS[type], display: 'flex', transform: 'scale(0.8)' }}>{ASSET_TYPES.find(t => t.id === type)?.icon}</div>
                                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ASSET_TYPES.find(t => t.id === type)?.label}</span>
                                <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 'auto', fontSize: '0.7rem', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Change</button>
                            </div>

                            {/* 3-Column Layout */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 1px 1fr 1px 1fr',
                                gap: '1rem',
                                alignItems: 'start'
                            }}>

                                {/* LEFT COLUMN: Required User Input */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                    <div style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        color: 'var(--accent)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        marginBottom: '-0.25rem'
                                    }}>
                                        Required
                                    </div>

                                    {/* Symbol */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Symbol</label>
                                        <input
                                            required
                                            value={symbol}
                                            onChange={e => setSymbol(e.target.value)}
                                            placeholder="AAPL"
                                            style={{
                                                padding: '0.625rem 0.75rem',
                                                background: 'var(--bg-secondary)',
                                                border: '2px solid var(--accent)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    {/* Quantity or Total Investment (BES only) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            {type === 'BES' ? `Total (${currency})` : 'Quantity'}
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={type === 'BES' ? totalValue : quantity}
                                            onChange={e => type === 'BES' ? setTotalValue(e.target.value) : setQuantity(e.target.value)}
                                            placeholder={type === 'BES' ? '1000' : '100'}
                                            style={{
                                                padding: '0.625rem 0.75rem',
                                                background: 'var(--bg-secondary)',
                                                border: '2px solid var(--accent)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                outline: 'none'
                                            }}
                                        />
                                        {type === 'BES' && quantity && (
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                ≈ {parseFloat(quantity).toLocaleString()} units
                                            </div>
                                        )}
                                    </div>

                                    {/* Buy Price */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Cost/Unit</label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={buyPrice}
                                            onChange={e => setBuyPrice(e.target.value)}
                                            placeholder="150.00"
                                            style={{
                                                padding: '0.625rem 0.75rem',
                                                background: 'var(--bg-secondary)',
                                                border: '2px solid var(--accent)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* SEPARATOR 1 */}
                                <div style={{ width: '1px', background: 'var(--border)', height: '100%', opacity: 0.3 }} />

                                {/* MIDDLE COLUMN: Auto-filled but Editable */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                    <div style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        marginBottom: '-0.25rem'
                                    }}>
                                        Auto-filled
                                    </div>

                                    {/* Name */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Name</label>
                                        <input
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Auto-detected"
                                            style={{
                                                padding: '0.625rem 0.75rem',
                                                background: 'var(--surface)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    {/* Currency */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Currency</label>
                                        <select
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            style={{
                                                padding: '0.625rem 0.75rem',
                                                background: 'var(--surface)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                            <option value="TRY">TRY (₺)</option>
                                        </select>
                                    </div>

                                    {/* Exchange */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Exchange</label>
                                        <input
                                            value={exchange}
                                            onChange={e => setExchange(e.target.value)}
                                            placeholder="NASDAQ"
                                            style={{
                                                padding: '0.625rem 0.75rem',
                                                background: 'var(--surface)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* SEPARATOR 2 */}
                                <div style={{ width: '1px', background: 'var(--border)', height: '100%', opacity: 0.3 }} />

                                {/* RIGHT COLUMN: Optional Metadata */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                    <div style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        marginBottom: '-0.25rem',
                                        opacity: 0.7
                                    }}>
                                        Optional
                                    </div>

                                    {/* Country */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', opacity: 0.8 }}>Country</label>
                                        <input
                                            value={country}
                                            onChange={e => setCountry(e.target.value)}
                                            placeholder="USA"
                                            size={Math.max(country?.length || 3, 8)}
                                            style={{
                                                padding: '0.5rem 0.6rem',
                                                background: 'var(--surface)',
                                                border: '1px solid transparent',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.8rem',
                                                outline: 'none',
                                                opacity: 0.7,
                                                maxWidth: '100%'
                                            }}
                                        />
                                    </div>

                                    {/* Sector */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', opacity: 0.8 }}>Sector</label>
                                        <input
                                            value={sector}
                                            onChange={e => setSector(e.target.value)}
                                            placeholder="Technology"
                                            size={Math.max(sector?.length || 10, 12)}
                                            style={{
                                                padding: '0.5rem 0.6rem',
                                                background: 'var(--surface)',
                                                border: '1px solid transparent',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.8rem',
                                                outline: 'none',
                                                opacity: 0.7,
                                                maxWidth: '100%'
                                            }}
                                        />
                                    </div>

                                    {/* Platform */}
                                    <AutocompleteInput
                                        value={platform}
                                        onChange={setPlatform}
                                        suggestions={suggestions.platforms}
                                        placeholder="Broker"
                                        label="Platform"
                                        labelStyle={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', opacity: 0.8 }}
                                        style={{
                                            padding: '0.5rem 0.6rem',
                                            background: 'var(--surface)',
                                            border: '1px solid transparent',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--text-muted)',
                                            fontSize: '0.8rem',
                                            outline: 'none',
                                            opacity: 0.7,
                                            maxWidth: '100%'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Portfolio Assignment - Below 3 columns */}
                            <div style={{
                                paddingTop: '0.5rem',
                                borderTop: '1px solid var(--border)'
                            }}>
                                <AutocompleteInput
                                    value={customGroup}
                                    onChange={setCustomGroup}
                                    suggestions={suggestions.portfolios}
                                    placeholder="e.g. Retirement, Growth"
                                    label="Portfolio (Optional)"
                                    labelStyle={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}
                                    style={{
                                        padding: '0.625rem 0.75rem',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.85rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Save Button - Compact */}
                            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{
                                        flex: 1,
                                        padding: '0.875rem',
                                        background: 'var(--accent)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                                >
                                    <Save size={18} />
                                    {isSubmitting ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStep(0)}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        padding: '0.875rem 1.25rem',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 600
                                    }}
                                >
                                    Back
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

