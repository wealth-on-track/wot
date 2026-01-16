"use client";

import { useState, useEffect } from "react";
import type { AssetDisplay } from "@/lib/types";
import { addAsset, updateAsset, deleteAsset } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { Save, Trash2, X, Check } from "lucide-react";

interface MobileAssetModalProps {
    asset: AssetDisplay | null;
    onClose: () => void;
    onAssetAdded?: (newAsset: AssetDisplay) => void;
}

export function MobileAssetModal({ asset, onClose, onAssetAdded }: MobileAssetModalProps) {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setTimeout(() => setIsVisible(true), 10);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const isEdit = asset !== null && asset.id !== 'new';

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            if (isEdit && asset) {
                const data = {
                    quantity: parseFloat(formData.get('quantity') as string),
                    buyPrice: parseFloat(formData.get('buyPrice') as string),
                    customGroup: formData.get('customGroup') as string,
                    platform: formData.get('platform') as string,
                };

                const result = await updateAsset(asset.id, data);
                if (result.error) {
                    alert(result.error);
                } else {
                    router.refresh();
                    handleClose();
                }
            } else {
                if (asset) {
                    if (!formData.has('type')) formData.append('type', asset.type);
                    if (!formData.has('currency')) formData.append('currency', asset.currency);
                    if (!formData.has('exchange')) formData.append('exchange', asset.exchange || '');
                    if (!formData.has('sector')) formData.append('sector', asset.sector || '');
                    if (!formData.has('country')) formData.append('country', asset.country || '');
                    if (asset.name && !formData.has('originalName')) formData.append('originalName', asset.name);
                }

                const result = await addAsset(undefined, formData);
                if (result === 'success') {
                    if (onAssetAdded) {
                        const newAssetDisplay: AssetDisplay = {
                            ...asset,
                            id: 'temp-new-' + Date.now(),
                            quantity: parseFloat(formData.get('quantity') as string),
                            buyPrice: parseFloat(formData.get('buyPrice') as string),
                            customGroup: formData.get('customGroup') as string,
                            platform: formData.get('platform') as string,
                            symbol: asset!.symbol,
                            type: asset!.type,
                            currency: asset!.currency,
                            previousClose: 0,
                            totalValueEUR: 0,
                            plPercentage: 0,
                            exchange: asset!.exchange || 'UNKNOWN',
                            sector: asset!.sector || 'UNKNOWN',
                            country: asset!.country || 'UNKNOWN',
                        };
                        onAssetAdded(newAssetDisplay);
                    }
                    router.refresh();
                    handleClose();
                } else {
                    alert("Error adding asset: " + result);
                }
            }
        } catch (error) {
            console.error(error);
            alert("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Minimal delete confirmation inline
    const handleDeleteClick = () => {
        if (confirm("Delete this position?")) {
            handleConfirmDelete();
        }
    };

    const handleConfirmDelete = async () => {
        if (!isEdit || !asset) return;
        setIsSubmitting(true);
        try {
            const result = await deleteAsset(asset.id);
            if (result.success) {
                router.refresh();
                handleClose();
            } else {
                alert(result.error || "Failed to delete.");
                setIsSubmitting(false);
            }
        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div
                onClick={handleClose}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 2000,
                    opacity: isVisible ? 1 : 0,
                    transition: 'opacity 0.2s',
                    backdropFilter: 'blur(2px)'
                }}
            />

            <div style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                background: 'var(--bg-primary)',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                zIndex: 2001,
                padding: '16px',
                transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
            }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="hidden" name="symbol" defaultValue={asset?.symbol || ''} />
                    {!isEdit && asset && (
                        <>
                            <input type="hidden" name="type" defaultValue={asset.type} />
                            <input type="hidden" name="currency" defaultValue={asset.currency} />
                            <input type="hidden" name="exchange" defaultValue={asset.exchange || ''} />
                            <input type="hidden" name="sector" defaultValue={asset.sector || ''} />
                            <input type="hidden" name="country" defaultValue={asset.country || ''} />
                        </>
                    )}

                    {/* Row 1: Header + Actions (Simulated minimal header) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {asset?.symbol}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {(asset?.name || '').substring(0, 20)}{(asset?.name?.length || 0) > 20 ? '...' : ''}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            {isEdit && (
                                <button
                                    type="button"
                                    onClick={handleDeleteClick}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '36px',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ef4444',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleClose}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Inputs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {/* Quantity */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                name="quantity"
                                step="any"
                                required
                                defaultValue={asset?.quantity || ''}
                                placeholder="Qty"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    paddingTop: '20px',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    marginBottom: 0
                                }}
                            />
                            <span style={{
                                position: 'absolute',
                                left: '12px',
                                top: '6px',
                                fontSize: '0.6rem',
                                color: 'var(--text-muted)',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>Quantity</span>
                        </div>

                        {/* Price */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                name="buyPrice"
                                step="any"
                                required
                                defaultValue={asset?.buyPrice || ''}
                                placeholder="Price"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    paddingTop: '20px',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    marginBottom: 0
                                }}
                            />
                            <span style={{
                                position: 'absolute',
                                left: '12px',
                                top: '6px',
                                fontSize: '0.6rem',
                                color: 'var(--text-muted)',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>Buy Price</span>
                        </div>
                    </div>

                    {/* Row 3: Optional Inputs (Compact) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                name="customGroup"
                                defaultValue={asset?.customGroup || ''}
                                placeholder="Default"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    paddingTop: '20px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                            <span style={{
                                position: 'absolute',
                                left: '12px',
                                top: '6px',
                                fontSize: '0.6rem',
                                color: 'var(--text-muted)',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>Group</span>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                name="platform"
                                defaultValue={asset?.platform || ''}
                                placeholder="None"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    paddingTop: '20px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                            <span style={{
                                position: 'absolute',
                                left: '12px',
                                top: '6px',
                                fontSize: '0.6rem',
                                color: 'var(--text-muted)',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>Platform</span>
                        </div>
                    </div>

                    {/* Submit Button (Full Width, Large Icon) */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: '14px',
                            padding: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer',
                            marginTop: '4px',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}
                    >
                        {isSubmitting ? (
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>...</span>
                        ) : (
                            <Check size={28} strokeWidth={3} />
                        )}
                    </button>
                </form>
            </div>
        </>
    );
}
