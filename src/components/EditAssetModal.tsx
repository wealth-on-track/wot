"use client";

import React, { useState, useEffect } from 'react';
import { AssetDisplay } from '@/lib/types';
import { X, Save, Trash2, ChevronDown, Lock } from 'lucide-react';
import { updateAsset, deleteAsset } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { formatNumber, parseFormattedNumber, formatInputNumber, isValidNumberInput } from '@/lib/numberFormat';

interface EditAssetModalProps {
    asset: AssetDisplay;
    isOpen: boolean;
    onClose: () => void;
}

export function EditAssetModal({ asset, isOpen, onClose }: EditAssetModalProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: asset.name || '',
        symbol: asset.symbol,
        quantity: formatNumber(asset.quantity, 0, 6),  // Formatted string
        buyPrice: formatNumber(asset.buyPrice, 2, 6),  // Formatted string
        type: asset.type,
        exchange: asset.exchange || '',
        currency: asset.currency,
        country: asset.country || '',
        sector: asset.sector || '',
        platform: asset.platform || '',
        customGroup: asset.customGroup || ''
    });

    // Reset form when asset changes
    useEffect(() => {
        // SYSTEMATIC FIX: Crypto assets should always have "Crypto" exchange
        let exchange = asset.exchange || '';
        if (asset.type === 'CRYPTO' && exchange !== 'Crypto') {
            exchange = 'Crypto';
        }

        setFormData({
            name: asset.name || '',
            symbol: asset.symbol,
            quantity: formatNumber(asset.quantity, 0, 6),  // Formatted string
            buyPrice: formatNumber(asset.buyPrice, 2, 6),  // Formatted string
            type: asset.type,
            exchange: exchange,
            currency: asset.currency,
            country: asset.country || '',
            sector: asset.sector || '',
            platform: asset.platform || '',
            customGroup: asset.customGroup || ''
        });
    }, [asset]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // For numeric fields, apply formatting
        if (name === 'quantity' || name === 'buyPrice') {
            if (!isValidNumberInput(value)) return;
            setFormData(prev => ({ ...prev, [name]: formatInputNumber(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const res = await updateAsset(asset.id, {
                name: formData.name,
                // symbol cannot be changed
                quantity: parseFormattedNumber(formData.quantity),
                buyPrice: parseFormattedNumber(formData.buyPrice),
                type: formData.type as "CASH" | "CRYPTO" | "STOCK" | "FUND" | "GOLD" | "BOND" | "COMMODITY",
                exchange: formData.exchange,
                currency: formData.currency as "USD" | "EUR" | "TRY",
                country: formData.country,
                sector: formData.sector,
                platform: formData.platform,
                customGroup: formData.customGroup || undefined
            });

            if (res.error) {
                alert(res.error);
            } else {
                router.refresh();
                onClose();
            }
        } catch (error) {
            console.error("Failed to save:", error);
            alert("An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        setIsLoading(true);
        try {
            const res = await deleteAsset(asset.id);
            if (res.error) {
                alert(res.error);
            } else {
                router.refresh();
                onClose();
            }
        } catch (error) {
            console.error("Failed to delete:", error);
        } finally {
            setIsLoading(false);
            setShowDeleteConfirm(false);
        }
    };

    // Use Portal to render at root level to avoid z-index/transform issues
    if (!isOpen) return null;

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

    return createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
        }}>
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    animation: 'fadeIn 0.3s ease'
                }}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Card */}
            <div className="neo-card" style={{
                position: 'relative', width: '100%', maxWidth: '640px',
                background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                maxHeight: '90vh', animation: 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)'
            }}>

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-secondary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
                        {(() => {
                            const cleanSymbol = formData.symbol.split('.')[0].toUpperCase();
                            const placeholderText = (cleanSymbol.length >= 2 && cleanSymbol.length <= 4) ? cleanSymbol : cleanSymbol.charAt(0);
                            const fontSize = placeholderText.length > 1 ? '0.85rem' : '1.2rem';
                            return (
                                <div style={{
                                    width: '42px', height: '42px', minWidth: '42px', borderRadius: '12px',
                                    background: 'var(--accent)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: '#fff', fontWeight: '900',
                                    fontSize: fontSize, boxShadow: '0 4px 12px var(--accent-glow)',
                                    letterSpacing: placeholderText.length > 1 ? '-0.02em' : '0'
                                }}>
                                    {placeholderText}
                                </div>
                            );
                        })()}
                        <div style={{ minWidth: 0 }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0, letterSpacing: '-0.02em' }}>
                                Edit {formData.name || formData.symbol}
                            </h2>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{formData.symbol}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        {/* Save */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                style={{
                                    background: 'var(--accent)', color: '#fff', border: 'none',
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', transition: 'all 0.2s',
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                            >
                                {isLoading ? <div className="spinner" /> : <Save size={20} />}
                            </button>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>Save</span>
                        </div>

                        {/* Delete */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <button
                                onClick={handleDeleteClick}
                                disabled={isLoading}
                                style={{
                                    background: 'var(--danger-bg)', border: '1px solid var(--danger)40',
                                    color: 'var(--danger)', width: '36px', height: '36px',
                                    borderRadius: '10px', cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                }}
                            >
                                <Trash2 size={18} />
                            </button>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>Delete</span>
                        </div>

                        {/* Cancel */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', width: '36px', height: '36px',
                                    borderRadius: '10px', cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                }}
                            >
                                <X size={20} />
                            </button>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>Close</span>
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Overlay */}
                {showDeleteConfirm && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'var(--bg-primary)',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }}>
                        <div style={{
                            width: '60px', height: '60px', borderRadius: '50%',
                            background: 'var(--danger-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--danger)', marginBottom: '1rem'
                        }}>
                            <Trash2 size={28} />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            Delete Position?
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
                            This action cannot be undone. Are you sure?
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', width: '100%', padding: '0 2rem' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    flex: 1, padding: '0.8rem', borderRadius: '12px',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                    border: 'none', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isLoading}
                                style={{
                                    flex: 1, padding: '0.8rem', borderRadius: '12px',
                                    background: 'var(--danger)', color: '#fff',
                                    border: 'none', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                {isLoading ? "Deleting..." : "Delete Permanently"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="custom-scrollbar" style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>

                        {/* Ticker */}
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={labelStyle}>Symbol</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    name="symbol"
                                    value={formData.symbol}
                                    disabled
                                    style={{
                                        ...inputStyle,
                                        opacity: 0.6,
                                        cursor: 'not-allowed',
                                        background: 'var(--surface)',
                                        fontFamily: 'monospace'
                                    }}
                                />
                                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
                                    <Lock size={14} color="var(--text-muted)" />
                                </div>
                            </div>
                        </div>

                        {/* Name */}
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={labelStyle}>Asset Name</label>
                            <input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="Apple Inc."
                            />
                        </div>

                        {/* Type */}
                        <div>
                            <label style={labelStyle}>Type</label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                                >
                                    {["STOCK", "CRYPTO", "GOLD", "BOND", "FUND", "CASH", "COMMODITY"].map(t => (
                                        <option key={t} value={t} style={{ color: '#000' }}>{t}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Exchange */}
                        <div>
                            <label style={labelStyle}>Exchange</label>
                            <input
                                name="exchange"
                                value={formData.exchange}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="NASDAQ"
                            />
                        </div>

                        {/* Currency */}
                        <div>
                            <label style={labelStyle}>Currency</label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleChange}
                                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                                >
                                    {["USD", "EUR", "TRY"].map(c => (
                                        <option key={c} value={c} style={{ color: '#000' }}>{c}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <label style={labelStyle}>Quantity</label>
                            <input
                                name="quantity"
                                type="text"
                                value={formData.quantity}
                                onChange={handleChange}
                                placeholder="0"
                                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                            />
                        </div>

                        {/* Avg Cost */}
                        <div>
                            <label style={labelStyle}>Avg Cost</label>
                            <input
                                name="buyPrice"
                                type="text"
                                value={formData.buyPrice}
                                onChange={handleChange}
                                placeholder="0,00"
                                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                            />
                        </div>

                        {/* Portfolio */}
                        <div>
                            <label style={labelStyle}>Portfolio / Group</label>
                            <input
                                name="customGroup"
                                value={formData.customGroup}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="Main Portfolio"
                            />
                        </div>

                        {/* Country */}
                        <div>
                            <label style={labelStyle}>Country</label>
                            <input
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="US"
                            />
                        </div>

                        {/* Sector */}
                        <div>
                            <label style={labelStyle}>Sector</label>
                            <input
                                name="sector"
                                value={formData.sector}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="Technology"
                            />
                        </div>

                        {/* Platform */}
                        <div>
                            <label style={labelStyle}>Platform</label>
                            <input
                                name="platform"
                                value={formData.platform}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="IBKR"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
