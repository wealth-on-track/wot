// Premium 2-Column Manual Asset Entry Form Component
// Compact, framed design with 50% smaller size

import { X, Save } from "lucide-react";
import { AutocompleteInput } from "./AutocompleteInput";

interface PremiumManualFormProps {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    assetName: string;
    setAssetName: (val: string) => void;
    assetType: string;
    setAssetType: (val: string) => void;
    quantity: string;
    setQuantity: (val: string) => void;
    buyPrice: string;
    setBuyPrice: (val: string) => void;
    exchange: string;
    setExchange: (val: string) => void;
    country: string;
    setCountry: (val: string) => void;
    sector: string;
    setSector: (val: string) => void;
    platform: string;
    setPlatform: (val: string) => void;
    customGroup: string;
    setCustomGroup: (val: string) => void;
    suggestions: { portfolios: string[], platforms: string[] };
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    isValidNumberInput: (val: string) => boolean;
    formatInputNumber: (val: string) => string;
}

export function PremiumManualForm({
    searchQuery, setSearchQuery,
    assetName, setAssetName,
    assetType, setAssetType,
    quantity, setQuantity,
    buyPrice, setBuyPrice,
    exchange, setExchange,
    country, setCountry,
    sector, setSector,
    platform, setPlatform,
    customGroup, setCustomGroup,
    suggestions,
    onClose,
    onSubmit,
    isValidNumberInput,
    formatInputNumber
}: PremiumManualFormProps) {
    return (
        <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            padding: '0.875rem',
            animation: 'slideDown 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

                {/* Header with Close */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.125rem' }}>
                    <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: 0,
                        letterSpacing: '-0.01em'
                    }}>
                        Add Asset Manually
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            borderRadius: '6px',
                            display: 'flex',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* 2-Column Framed Layout */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem'
                }}>
                    {/* LEFT COLUMN - REQUIRED (Framed) */}
                    <div style={{
                        border: '1.5px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '8px',
                        padding: '0.625rem',
                        background: 'rgba(99, 102, 241, 0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        {/* Required Label */}
                        <div style={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            color: 'var(--accent)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.125rem'
                        }}>
                            Required
                        </div>

                        {/* Category */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Category</label>
                            <select
                                value={assetType}
                                onChange={(e) => setAssetType(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--surface) 100%)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <option value="STOCK">📈 Stock</option>
                                <option value="CRYPTO">₿ Crypto</option>
                                <option value="FUND">💼 ETF & Fund</option>
                                <option value="GOLD">🪙 Gold</option>
                                <option value="BOND">🏛️ Bond</option>
                                <option value="CASH">💵 Cash</option>
                            </select>
                        </div>

                        {/* Name */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Name</label>
                            <input
                                required
                                value={assetName}
                                onChange={(e) => setAssetName(e.target.value)}
                                placeholder="Apple Inc."
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Ticker */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Ticker</label>
                            <input
                                required
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="AAPL"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Quantity */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Quantity</label>
                            <input
                                required
                                type="text"
                                value={quantity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (!isValidNumberInput(val)) return;
                                    setQuantity(formatInputNumber(val));
                                }}
                                placeholder="100"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Avg. Cost */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Avg. Cost</label>
                            <input
                                required
                                type="text"
                                value={buyPrice}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (!isValidNumberInput(val)) return;
                                    setBuyPrice(formatInputNumber(val));
                                }}
                                placeholder="150.00"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Currency */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Currency</label>
                            <select
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--surface) 100%)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <option value="USD">🇺🇸 USD ($)</option>
                                <option value="EUR">🇪🇺 EUR (€)</option>
                                <option value="TRY">🇹🇷 TRY (₺)</option>
                                <option value="GBP">🇬🇧 GBP (£)</option>
                                <option value="CHF">🇨🇭 CHF (Fr)</option>
                                <option value="JPY">🇯🇵 JPY (¥)</option>
                                <option value="CAD">🇨🇦 CAD (C$)</option>
                                <option value="AUD">🇦🇺 AUD (A$)</option>
                                <option value="HKD">🇭🇰 HKD (HK$)</option>
                                <option value="SGD">🇸🇬 SGD (S$)</option>
                                <option value="ZAR">🇿🇦 ZAR (R)</option>
                                <option value="CNY">🇨🇳 CNY (¥)</option>
                                <option value="NZD">🇳🇿 NZD (NZ$)</option>
                                <option value="INR">🇮🇳 INR (₹)</option>
                                <option value="SEK">🇸🇪 SEK (kr)</option>
                                <option value="NOK">🇳🇴 NOK (kr)</option>
                                <option value="DKK">🇩🇰 DKK (kr)</option>
                                <option value="PLN">🇵🇱 PLN (zł)</option>
                                <option value="CZK">🇨🇿 CZK (Kč)</option>
                                <option value="HUF">🇭🇺 HUF (Ft)</option>
                                <option value="MXN">🇲🇽 MXN (Mex$)</option>
                                <option value="BRL">🇧🇷 BRL (R$)</option>
                                <option value="KRW">🇰🇷 KRW (₩)</option>
                                <option value="TWD">🇹🇼 TWD (NT$)</option>
                                <option value="THB">🇹🇭 THB (฿)</option>
                                <option value="IDR">🇮🇩 IDR (Rp)</option>
                                <option value="MYR">🇲🇾 MYR (RM)</option>
                                <option value="PHP">🇵🇭 PHP (₱)</option>
                                <option value="VND">🇻🇳 VND (₫)</option>
                                <option value="ILS">🇮🇱 ILS (₪)</option>
                                <option value="AED">🇦🇪 AED (د.إ)</option>
                                <option value="SAR">🇸🇦 SAR (﷼)</option>
                                <option value="RUB">🇷🇺 RUB (₽)</option>
                            </select>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - OPTIONAL (Framed & Faded) */}
                    <div style={{
                        border: '1px solid rgba(100, 116, 139, 0.2)',
                        borderRadius: '8px',
                        padding: '0.625rem',
                        background: 'rgba(100, 116, 139, 0.02)',
                        opacity: 0.75,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        {/* Optional Label */}
                        <div style={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.125rem'
                        }}>
                            Optional
                        </div>

                        {/* Exchange */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Exchange</label>
                            <input
                                value={exchange}
                                onChange={(e) => setExchange(e.target.value)}
                                placeholder="NASDAQ"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Country */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Country</label>
                            <input
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                placeholder="USA"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Sector */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Sector</label>
                            <input
                                value={sector}
                                onChange={(e) => setSector(e.target.value)}
                                placeholder="Technology"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Platform */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Platform</label>
                            <AutocompleteInput
                                value={platform}
                                onChange={setPlatform}
                                suggestions={suggestions.platforms}
                                placeholder="Broker"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>

                        {/* Portfolio */}
                        <div>
                            <label style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                display: 'block',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>Portfolio</label>
                            <AutocompleteInput
                                value={customGroup}
                                onChange={setCustomGroup}
                                suggestions={suggestions.portfolios}
                                placeholder="e.g. Retirement"
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button - Compact */}
                <button
                    type="submit"
                    style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.375rem',
                        transition: 'all 0.2s',
                        marginTop: '0.25rem',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                        letterSpacing: '0.01em',
                        textTransform: 'uppercase'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                    }}
                >
                    <Save size={16} strokeWidth={2.5} /> Save Asset
                </button>
            </form>
        </div>
    );
}
