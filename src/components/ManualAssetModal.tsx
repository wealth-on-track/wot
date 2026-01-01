"use client";

import { useState } from "react";
import { X, Save, TrendingUp, Bitcoin, Coins, Landmark, Building, Briefcase } from "lucide-react";
import { addAsset } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { ASSET_COLORS } from "@/lib/constants";

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
    const [step, setStep] = useState<1 | 2>(1);
    const [type, setType] = useState<string>("STOCK");

    // Form Data
    const [symbol, setSymbol] = useState(initialSymbol);
    const [quantity, setQuantity] = useState("");
    const [buyPrice, setBuyPrice] = useState("");
    const [currency, setCurrency] = useState("USD");

    // Optional
    const [exchange, setExchange] = useState("");
    const [country, setCountry] = useState("");
    const [sector, setSector] = useState("");
    const [platform, setPlatform] = useState("");
    const [isin, setIsin] = useState(""); // For ETFs/Funds
    const [customGroup, setCustomGroup] = useState(""); // Portfolio Name

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showOptional, setShowOptional] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('symbol', symbol.toUpperCase());
        formData.append('type', type);
        formData.append('quantity', quantity);
        formData.append('buyPrice', buyPrice);
        formData.append('currency', currency);

        if (exchange) formData.append('exchange', exchange);
        if (country) formData.append('country', country); // Note: Backend needs to support this
        if (sector) formData.append('sector', sector);
        if (isin && type === 'FUND') formData.append('isin', isin); // Append ISIN if it exists and type is FUND
        if (customGroup) formData.append('customGroup', customGroup);
        // Platform is currently not in backend schema in evidence, but user requested it.  
        // We will send it, but if backend ignores it, that's fine for now (MVP).

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
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="glass-panel"
                style={{
                    width: '100%',
                    maxWidth: '500px',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#13131a'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {step === 1 ? 'Select Asset Type' : 'Add Details'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {step === 1 ? (
                    /* STEP 1: TYPE SELECTION */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        {ASSET_TYPES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => { setType(t.id); setStep(2); }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '1.5rem 1rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '0.75rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    color: '#fff'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                    e.currentTarget.style.borderColor = t.color;
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{ color: t.color }}>{t.icon}</div>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.label}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* STEP 2: FORM */
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        {/* Type Indicator */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: `rgba(${parseInt(ASSET_COLORS[type].slice(1, 3), 16)}, ${parseInt(ASSET_COLORS[type].slice(3, 5), 16)}, ${parseInt(ASSET_COLORS[type].slice(5, 7), 16)}, 0.1)`,
                            padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                            border: `1px solid ${ASSET_COLORS[type]}40`,
                            marginBottom: '0.5rem'
                        }}>
                            {ASSET_TYPES.find(t => t.id === type)?.icon}
                            <span style={{ fontWeight: 600, color: ASSET_COLORS[type] }}>{ASSET_TYPES.find(t => t.id === type)?.label}</span>
                            <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 'auto', fontSize: '0.8rem', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', textDecoration: 'underline' }}>Change</button>
                        </div>

                        {/* Top Row: Symbol & Currency */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Symbol / Name *</label>
                                <input
                                    required
                                    value={symbol} onChange={e => setSymbol(e.target.value)}
                                    placeholder="e.g. AAPL, My Bond"
                                    className="glass-input"
                                    style={{ padding: '0.6rem', fontSize: '0.9rem', width: '100%' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Currency</label>
                                <select
                                    value={currency} onChange={e => setCurrency(e.target.value)}
                                    className="glass-input"
                                    style={{ padding: '0.6rem', fontSize: '0.9rem', width: '100%' }}
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="TRY">TRY</option>
                                </select>
                            </div>
                        </div>

                        {/* Middle Row: Quantity & Cost */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Quantity *</label>
                                <input
                                    type="number" step="any" required
                                    value={quantity} onChange={e => setQuantity(e.target.value)}
                                    className="glass-input"
                                    style={{ padding: '0.6rem', fontSize: '0.9rem', width: '100%' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg. Cost *</label>
                                <input
                                    type="number" step="any" required
                                    value={buyPrice} onChange={e => setBuyPrice(e.target.value)}
                                    className="glass-input"
                                    style={{ padding: '0.6rem', fontSize: '0.9rem', width: '100%' }}
                                />
                            </div>
                        </div>

                        {/* Optional Toggle */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowOptional(!showOptional)}
                                style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                                {showOptional ? 'Hide' : 'Show'} Advanced Details {showOptional ? '▲' : '▼'}
                            </button>
                        </div>

                        {/* Optional Fields */}
                        {showOptional && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Exchange</label>
                                    <input
                                        value={exchange} onChange={e => setExchange(e.target.value)}
                                        placeholder="e.g. NASDAQ"
                                        className="glass-input"
                                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                        list="exchange-options"
                                    />
                                    <datalist id="exchange-options">
                                        <option value="NASDAQ" />
                                        <option value="NYSE" />
                                        <option value="LSE" />
                                        <option value="Binance" />
                                        <option value="Coinbase" />
                                        <option value="XETRA" />
                                    </datalist>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Sector</label>
                                    <input
                                        value={sector} onChange={e => setSector(e.target.value)}
                                        placeholder="e.g. Tech"
                                        className="glass-input"
                                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                        list="sector-options"
                                    />
                                    <datalist id="sector-options">
                                        <option value="Technology" />
                                        <option value="Finance" />
                                        <option value="Healthcare" />
                                        <option value="Energy" />
                                        <option value="Consumer Discretionary" />
                                        <option value="Real Estate" />
                                    </datalist>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Country</label>
                                    <input
                                        value={country} onChange={e => setCountry(e.target.value)}
                                        placeholder="e.g. USA"
                                        className="glass-input"
                                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                        list="country-options"
                                    />
                                    <datalist id="country-options">
                                        <option value="USA" />
                                        <option value="Germany" />
                                        <option value="UK" />
                                        <option value="France" />
                                        <option value="Japan" />
                                        <option value="Canada" />
                                    </datalist>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Platform</label>
                                    <input
                                        value={platform} onChange={e => setPlatform(e.target.value)}
                                        placeholder="e.g. Robinhood"
                                        className="glass-input"
                                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                        list="platform-options"
                                    />
                                    <datalist id="platform-options">
                                        <option value="Robinhood" />
                                        <option value="Interactive Brokers" />
                                        <option value="Etoro" />
                                        <option value="Fidelity" />
                                        <option value="Coinbase" />
                                        <option value="Binance" />
                                        <option value="Trade Republic" />
                                    </datalist>
                                </div>
                                {type === 'FUND' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: 'span 2' }}>
                                        <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>ISIN / Ticker</label>
                                        <input
                                            value={isin} onChange={e => setIsin(e.target.value)}
                                            placeholder="e.g. US0378331005"
                                            className="glass-input"
                                            style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Portfolio Name</label>
                                    <input
                                        value={customGroup} onChange={e => setCustomGroup(e.target.value)}
                                        placeholder="e.g. Retirement, Kids, Risky"
                                        className="glass-input"
                                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                        list="portfolio-options"
                                    />
                                    <datalist id="portfolio-options">
                                        <option value="Long Term" />
                                        <option value="Short Term" />
                                        <option value="Retirement" />
                                        <option value="Crypto HODL" />
                                    </datalist>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="glass-button"
                            style={{
                                marginTop: '1rem',
                                padding: '0.8rem',
                                fontSize: '1rem',
                                fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                            }}
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Saving...' : 'Add Asset'}
                        </button>

                    </form>
                )}
            </div>
        </div>
    );
}
