"use client";

import { useState, useEffect } from "react";
import type { AssetDisplay } from "@/lib/types";
import { addAsset, updateAsset, deleteAsset } from "@/lib/actions";
import { useRouter } from "next/navigation";

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
        // Trigger animation
        setTimeout(() => setIsVisible(true), 10);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    // Check if we are in edit mode or add mode
    // "new" id is set when adding from search in MobileDashboard
    const isEdit = asset !== null && asset.id !== 'new';

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            if (isEdit && asset) {
                // Update Logic
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
                // Add Logic
                if (asset) {
                    // Ensure required hidden fields are present if not in form inputs
                    if (!formData.has('type')) formData.append('type', asset.type);
                    if (!formData.has('currency')) formData.append('currency', asset.currency);
                    if (!formData.has('exchange')) formData.append('exchange', asset.exchange || '');
                    if (!formData.has('sector')) formData.append('sector', asset.sector || '');
                    if (!formData.has('country')) formData.append('country', asset.country || '');
                    if (asset.name && !formData.has('originalName')) formData.append('originalName', asset.name);
                }

                const result = await addAsset(undefined, formData);
                if (result === 'success') {
                    // router.refresh(); // Moved to parent responsibility via onAssetAdded if needed, or keep for data consistency
                    // Construct local asset object to pass back for immediate UI feedback
                    if (onAssetAdded) {
                        const newAssetDisplay: AssetDisplay = {
                            ...asset,
                            id: 'temp-new-' + Date.now(), // Temporary ID until refresh
                            quantity: parseFloat(formData.get('quantity') as string),
                            buyPrice: parseFloat(formData.get('buyPrice') as string),
                            customGroup: formData.get('customGroup') as string,
                            platform: formData.get('platform') as string,
                            // Ensure required fields are present
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

    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleDeleteClick = () => {
        setErrorMessage(null);
        setShowDeleteConfirm(true);
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
                setErrorMessage(result.error || "Failed to delete. Please try again.");
                setIsSubmitting(false); // Only re-enable if failed
            }
        } catch (error) {
            console.error(error);
            setErrorMessage("An unexpected error occurred.");
            setIsSubmitting(false);
        }
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setErrorMessage(null);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    zIndex: 2000,
                    opacity: isVisible ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)'
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'var(--bg-primary)',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                zIndex: 2001,
                maxHeight: '80vh',
                overflow: 'auto',
                transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)'
            }}>
                {/* Handle Bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '0.5rem'
                }}>
                    <div style={{
                        width: '30px',
                        height: '3px',
                        background: 'var(--border)',
                        borderRadius: '2px'
                    }} />
                </div>

                {/* Header */}
                <div style={{
                    padding: '0 0.75rem 0.75rem',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        marginBottom: '0.25rem',
                        textAlign: 'center'
                    }}>
                        {isEdit ? 'Edit Position' : 'Add Position'}
                    </div>
                    {isEdit && (
                        <div style={{
                            fontSize: '0.65rem',
                            color: 'var(--text-muted)',
                            textAlign: 'center'
                        }}>
                            {asset.symbol} • {asset.name}
                        </div>
                    )}
                </div>

                {/* Form */}
                <div style={{ padding: '0.75rem' }}>
                    <form onSubmit={handleSubmit} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.8rem'
                    }}>
                        <input type="hidden" name="symbol" defaultValue={asset?.symbol || ''} />
                        {/* Hidden Inputs for context (important for Add mode) */}
                        {!isEdit && asset && (
                            <>
                                <input type="hidden" name="type" defaultValue={asset.type} />
                                <input type="hidden" name="currency" defaultValue={asset.currency} />
                                <input type="hidden" name="exchange" defaultValue={asset.exchange || ''} />
                                <input type="hidden" name="sector" defaultValue={asset.sector || ''} />
                                <input type="hidden" name="country" defaultValue={asset.country || ''} />
                            </>
                        )}

                        {/* Delete Confirmation Overlay */}
                        {showDeleteConfirm && (
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: 'var(--bg-primary)',
                                zIndex: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '1rem',
                                borderRadius: '16px'
                            }}>
                                <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>⚠️</div>
                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Delete Position?</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem', maxWidth: '80%' }}>
                                    This action cannot be undone.
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                                    <button
                                        type="button"
                                        onClick={handleCancelDelete}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '10px',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            border: 'none',
                                            fontWeight: 700
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmDelete}
                                        disabled={isSubmitting}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '10px',
                                            background: 'var(--danger)',
                                            color: '#fff',
                                            border: 'none',
                                            fontWeight: 700
                                        }}
                                    >
                                        {isSubmitting ? 'Deleting...' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {errorMessage && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid var(--danger)',
                                borderRadius: '8px',
                                padding: '0.75rem',
                                color: 'var(--danger)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                textAlign: 'center',
                                marginBottom: '0.5rem'
                            }}>
                                {errorMessage}
                            </div>
                        )}

                        {/* REQUIRED SECTION - FRAMED */}
                        <div style={{
                            border: '1px solid var(--accent)',
                            borderRadius: '12px',
                            padding: '0.6rem',
                            background: 'rgba(99, 102, 241, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                {/* Quantity */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Quantity <span style={{ color: 'var(--accent)' }}>*</span></label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        step="any"
                                        required
                                        defaultValue={asset?.quantity || ''}
                                        placeholder="0"
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '0.5rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                                    />
                                </div>
                                {/* Cost */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Avg. Cost <span style={{ color: 'var(--accent)' }}>*</span></label>
                                    <input
                                        type="number"
                                        name="buyPrice"
                                        step="any"
                                        required
                                        defaultValue={asset?.buyPrice || ''}
                                        placeholder="0.00"
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '0.5rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* OPTIONAL SECTION - FRAMED */}
                        <div style={{
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '0.6rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                marginBottom: '-0.1rem'
                            }}>
                                Optional
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                {/* Portfolio */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Portfolio</label>
                                    <input
                                        type="text"
                                        name="customGroup"
                                        defaultValue={asset?.customGroup || ''}
                                        placeholder="Default"
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '0.5rem',
                                            fontSize: '0.85rem',
                                            color: 'var(--text-primary)',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                {/* Platform */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Platform</label>
                                    <input
                                        type="text"
                                        name="platform"
                                        defaultValue={asset?.platform || ''}
                                        placeholder="Binance"
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '0.5rem',
                                            fontSize: '0.85rem',
                                            color: 'var(--text-primary)',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            marginTop: '0.2rem'
                        }}>
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                style={{
                                    flex: 1, // Same size as cancel button in Edit mode
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    padding: '0.8rem 0.2rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    opacity: isSubmitting ? 0.7 : 1
                                }}
                            >
                                Cancel
                            </button>

                            {isEdit ? (
                                <>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        style={{
                                            flex: 3,
                                            background: 'var(--accent)',
                                            border: 'none',
                                            borderRadius: '10px',
                                            padding: '0.8rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                            textAlign: 'center',
                                            opacity: isSubmitting ? 0.7 : 1
                                        }}
                                    >
                                        {isSubmitting ? 'Updating...' : 'Update'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleDeleteClick}
                                        disabled={isSubmitting}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid var(--danger)',
                                            borderRadius: '10px',
                                            padding: '0.8rem 0.2rem',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            color: 'var(--danger)',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            opacity: isSubmitting ? 0.7 : 1
                                        }}
                                    >
                                        Delete
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{
                                        flex: 4, // Combined width of Update (3) + Delete (1)
                                        background: 'var(--accent)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.8rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        color: '#fff',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                        textAlign: 'center',
                                        opacity: isSubmitting ? 0.7 : 1
                                    }}
                                >
                                    {isSubmitting ? 'Adding...' : 'Add'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
