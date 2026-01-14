"use client";

import { useState, useEffect } from "react";
import type { AssetDisplay } from "@/lib/types";

interface MobileAssetModalProps {
    asset: AssetDisplay | null;
    onClose: () => void;
}

export function MobileAssetModal({ asset, onClose }: MobileAssetModalProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger animation
        setTimeout(() => setIsVisible(true), 10);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const isEdit = asset !== null;

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
                    <form style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.8rem'
                    }}>
                        <input type="hidden" defaultValue={asset?.symbol || ''} />

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
                                        step="any"
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
                                        step="any"
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
                                style={{
                                    flex: 1,
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
                                    textOverflow: 'ellipsis'
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
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
                                    textAlign: 'center'
                                }}
                            >
                                {isEdit ? 'Update' : 'Add'}
                            </button>

                            {isEdit && (
                                <button
                                    type="button"
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
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
