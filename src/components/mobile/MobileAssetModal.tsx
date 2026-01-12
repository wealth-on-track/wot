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
                        gap: '0.75rem'
                    }}>
                        {/* Symbol Input */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.5rem'
                            }}>
                                Symbol
                            </label>
                            <input
                                type="text"
                                defaultValue={asset?.symbol || ''}
                                placeholder="e.g. AAPL, BTC"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Quantity Input */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.5rem'
                            }}>
                                Quantity
                            </label>
                            <input
                                type="number"
                                step="0.001"
                                defaultValue={asset?.quantity || ''}
                                placeholder="0.00"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Buy Price Input */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.5rem'
                            }}>
                                Buy Price
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                defaultValue={asset?.buyPrice || ''}
                                placeholder="0.00"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            marginTop: '1rem'
                        }}>
                            <button
                                type="submit"
                                style={{
                                    width: '100%',
                                    background: 'var(--accent)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 800,
                                    color: '#fff',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                            >
                                {isEdit ? 'Update Position' : 'Add Position'}
                            </button>

                            {isEdit && (
                                <button
                                    type="button"
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: '1px solid var(--danger)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        fontSize: '0.9rem',
                                        fontWeight: 800,
                                        color: 'var(--danger)',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}
                                >
                                    Delete Position
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleClose}
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 800,
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
