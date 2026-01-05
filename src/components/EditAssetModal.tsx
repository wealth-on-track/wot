"use client";

import React, { useState, useEffect } from 'react';
import { AssetDisplay } from '@/lib/types';
import { X, Save, Trash2 } from 'lucide-react';
import { updateAsset, deleteAsset } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

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
        quantity: asset.quantity,
        buyPrice: asset.buyPrice,
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
        setFormData({
            name: asset.name || '',
            symbol: asset.symbol,
            quantity: asset.quantity,
            buyPrice: asset.buyPrice,
            type: asset.type,
            exchange: asset.exchange || '',
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
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const res = await updateAsset(asset.id, {
                name: formData.name,
                symbol: formData.symbol,
                quantity: Number(formData.quantity),
                buyPrice: Number(formData.buyPrice),
                type: formData.type,
                exchange: formData.exchange,
                currency: formData.currency,
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

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this asset?")) return;
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
        }
    };

    // Use Portal to render at root level to avoid z-index/transform issues
    if (!isOpen) return null;

    const labelStyle = {
        fontSize: '0.65rem',
        fontWeight: 600,
        color: '#94a3b8', // Slate-400 for better readability
        marginBottom: '0.15rem',
        display: 'block',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.02em'
    };

    const inputStyle = {
        width: '100%',
        background: '#1e293b', // Slate-800 - Solid dark background for contrast
        border: '1px solid #334155', // Slate-700
        borderRadius: '6px',
        padding: '0.35rem 0.6rem', // Tighter padding
        fontSize: '0.8rem',
        fontWeight: 500,
        color: '#f1f5f9', // Slate-100 - High contrast text
        outline: 'none',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
        height: '2rem' // Fixed compact height
    };

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            {/* 1. Dynamic Blur Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(5, 7, 20, 0.7)', // Darker backdrop
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    animation: 'fadeIn 0.2s ease'
                }}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* 2. Modern Notification Card centered */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '600px', // More compact width
                background: '#0f172a', // Slate-950 - Deep rich dark background
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '85vh',
                animation: 'zoomIn 0.2s ease',
                border: '1px solid #1e293b', // Slate-800
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>

                {/* Header (Title + Actions) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.8rem 1.2rem',
                    borderBottom: '1px solid #1e293b',
                    background: '#131c31'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            minWidth: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                            {formData.symbol.charAt(0)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Edit {formData.name || formData.symbol}
                            </h2>
                            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{formData.symbol}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                        {/* Save Button */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                style={{
                                    background: '#3b82f6', // Blue-500
                                    border: '1px solid #2563eb',
                                    color: '#fff',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 5px rgba(59, 130, 246, 0.4)'
                                }}
                                title="Save"
                            >
                                {isLoading ? (
                                    <div style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <Save size={18} />
                                )}
                            </button>
                            <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>Save</span>
                        </div>

                        {/* Delete Button */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                style={{
                                    background: '#ef4444', // Red-500 Solid
                                    border: '1px solid #dc2626',
                                    color: '#fff',
                                    width: '32px', // Square button
                                    height: '32px',
                                    borderRadius: '8px', // Slightly more rounded
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 5px rgba(239, 68, 68, 0.3)'
                                }}
                                title="Delete Asset"
                            >
                                <Trash2 size={16} />
                            </button>
                            <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>Delete</span>
                        </div>

                        {/* Cancel Button */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    background: '#334155', // Slate-700
                                    border: '1px solid #1e293b',
                                    color: '#fff',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                                }}
                                title="Cancel"
                            >
                                <X size={18} />
                            </button>
                            <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>Cancel</span>
                        </div>
                    </div>
                </div>

                {/* Body - Compact 3-Column Grid */}
                <div className="custom-scrollbar" style={{ padding: '1.2rem', overflowY: 'auto', flex: 1 }}>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem 1rem' }}>

                        {/* Row 1: Primary Identity */}
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={labelStyle}>Ticker</label>
                            <input
                                name="symbol"
                                value={formData.symbol}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="AAPL"
                            />
                        </div>
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

                        {/* Row 2: Classification */}
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
                                <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8', fontSize: '0.6rem' }}>▼</div>
                            </div>
                        </div>
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
                                <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8', fontSize: '0.6rem' }}>▼</div>
                            </div>
                        </div>

                        {/* Row 3: Financials */}
                        <div>
                            <label style={labelStyle}>Quantity</label>
                            <input
                                name="quantity"
                                type="number"
                                step="any"
                                value={formData.quantity}
                                onChange={handleChange}
                                style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Avg Cost</label>
                            <input
                                name="buyPrice"
                                type="number"
                                step="any"
                                value={formData.buyPrice}
                                onChange={handleChange}
                                style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                            />
                        </div>
                        <div>
                            {/* Empty or calculated total could go here, or we can use it for Portfolio/Group */}
                            <label style={labelStyle}>Portfolio</label>
                            <input
                                name="customGroup"
                                value={formData.customGroup}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="Main Portfolio"
                            />
                        </div>

                        {/* Row 4: Metadata */}
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
                        <div>
                            <label style={labelStyle}>Platform</label>
                            <input
                                name="platform"
                                value={formData.platform}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="Interactive Brokers"
                            />
                        </div>

                    </div>

                </div>

            </div>
        </div>,
        document.body
    );
}
