"use client";

import { useState, useRef } from "react";
import { Search, Plus } from "lucide-react";
import { searchSymbolsAction } from "@/app/actions/search";
import { SymbolOption } from "@/lib/symbolSearch";
import { getLogoUrl } from "@/lib/logos";

const ASSET_COLORS: Record<string, string> = {
    'STOCK': '#6366f1',
    'CRYPTO': '#f59e0b',
    'FUND': '#10b981',
    'ETF': '#ec4899',
    'GOLD': '#eab308',
    'CASH': '#8b5cf6',
    'DEFAULT': '#94a3b8'
};

interface MobileAddAssetProps {
    onAddKey: (asset: SymbolOption) => Promise<void>;
}

export function MobileAddAsset({ onAddKey }: MobileAddAssetProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SymbolOption[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [addingSymbol, setAddingSymbol] = useState<string | null>(null);

    // Ref to track the latest query to prevent race conditions
    const latestQuery = useRef("");

    const handleSearch = async (term: string) => {
        setQuery(term);
        latestQuery.current = term;

        if (term.length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const data = await searchSymbolsAction(term);
            // Race Check: Only update state if this response corresponds to the current query
            if (term === latestQuery.current) {
                setResults(data);
            }
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            // Only turn off loading if this was the last request
            if (term === latestQuery.current) {
                setIsSearching(false);
            }
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            {/* Search Bar */}
            <div className="neo-card" style={{ padding: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Search size={20} color="var(--text-muted)" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search stocks, crypto, ETFs..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        fontWeight: 500,
                        outline: 'none'
                    }}
                    autoFocus
                />
            </div>

            {/* Results List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingBottom: '80px' }}>
                {isSearching && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
                )}

                {!isSearching && results.length === 0 && query.length >= 2 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No results found</div>
                )}

                {results.map((asset) => {
                    const color = ASSET_COLORS[asset.type] || ASSET_COLORS.DEFAULT;
                    const logoUrl = getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country);

                    return (
                        <div key={asset.symbol} className="neo-card" style={{ padding: '0.4rem 0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '6px',
                                    background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: color, fontWeight: 700, fontSize: '0.6rem', overflow: 'hidden', flexShrink: 0
                                }}>
                                    {logoUrl ? (
                                        <img src={logoUrl} alt={asset.symbol} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        asset.symbol.substring(0, 2)
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', justifyContent: 'center' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.1 }}>{asset.symbol}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{asset.fullName}</div>
                                    <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.15rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.5rem', padding: '0 3px', borderRadius: '2px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            {asset.type}
                                        </span>
                                        {asset.category && (
                                            <span style={{
                                                fontSize: '0.5rem',
                                                padding: '0 3px',
                                                borderRadius: '2px',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border)',
                                                fontWeight: 800,
                                                color: 'var(--text-secondary)',
                                                textTransform: 'uppercase'
                                            }}>
                                                {asset.category.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        {/* Show Exchange only if it provides extra info (e.g. not implied by category) */}
                                        {!['TEFAS', 'CRYPTO', 'FOREX'].includes(asset.category || '') && asset.exchange && asset.exchange !== 'Crypto' && (
                                            <span style={{ fontSize: '0.5rem', padding: '0 3px', borderRadius: '2px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                {asset.exchange}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    setAddingSymbol(asset.symbol);
                                    await onAddKey(asset);
                                    setAddingSymbol(null);
                                }}
                                disabled={addingSymbol === asset.symbol}
                                style={{
                                    background: addingSymbol === asset.symbol ? 'var(--bg-secondary)' : 'var(--accent)',
                                    color: addingSymbol === asset.symbol ? 'var(--text-muted)' : '#fff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: addingSymbol === asset.symbol ? 'default' : 'pointer',
                                    boxShadow: addingSymbol === asset.symbol ? 'none' : '0 2px 6px rgba(99, 102, 241, 0.25)',
                                    flexShrink: 0,
                                    marginLeft: '0.4rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {addingSymbol === asset.symbol ? (
                                    <div style={{ width: '12px', height: '12px', border: '1.5px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <Plus size={16} />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
