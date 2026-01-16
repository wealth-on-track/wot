"use client";

import { useState } from "react";
import { MobileVision } from "./MobileVision";
import { MobileImpactSheet } from "./MobileImpactSheet";

interface MobileVisionTabProps {
    totalValueEUR: number;
    onOpenImpactSheet: () => void;
}

export function MobileVisionTab({ totalValueEUR, onOpenImpactSheet }: MobileVisionTabProps) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <MobileVision totalValueEUR={totalValueEUR} />

            {/* Floating 'Impact' Button */}
            <button
                onClick={onOpenImpactSheet}
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    padding: '12px 20px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '24px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    zIndex: 50
                }}
            >
                <span>⚡️</span> Impact Simulator
            </button>
        </div>
    );
}
