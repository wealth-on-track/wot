"use client";

import { Eye, Zap } from "lucide-react";

interface FloatingActionButtonsProps {
    onVisionClick: () => void;
    onImpactClick: () => void;
}

export function FloatingActionButtons({ onVisionClick, onImpactClick }: FloatingActionButtonsProps) {
    return (
        <>
            {/* Vision Button - Left Bottom */}
            <button
                onClick={onVisionClick}
                style={{
                    position: 'fixed',
                    left: '16px',
                    bottom: 'calc(80px + env(safe-area-inset-bottom))',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
                    zIndex: 999,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <Eye size={24} strokeWidth={2.5} />
            </button>

            {/* Impact Button - Right Bottom */}
            <button
                onClick={onImpactClick}
                style={{
                    position: 'fixed',
                    right: '16px',
                    bottom: 'calc(80px + env(safe-area-inset-bottom))',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
                    zIndex: 999,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <Zap size={24} fill="#fff" />
            </button>
        </>
    );
}
