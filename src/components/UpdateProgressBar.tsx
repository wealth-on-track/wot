"use client";

import { motion, AnimatePresence } from "framer-motion";

interface UpdateProgressBarProps {
    progress: number;
    isActive: boolean;
}

export function UpdateProgressBar({ progress, isActive }: UpdateProgressBarProps) {
    // Color interpolation: red (0%) -> yellow (50%) -> green (100%)
    const getProgressColor = (p: number) => {
        if (p < 50) {
            // Red to Yellow (0-50%)
            const ratio = p / 50;
            const r = 239; // Start red
            const g = Math.round(68 + (180 * ratio)); // 68 -> 248
            const b = 68;
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Yellow to Green (50-100%)
            const ratio = (p - 50) / 50;
            const r = Math.round(239 - (139 * ratio)); // 239 -> 100
            const g = Math.round(248 - (48 * ratio)); // 248 -> 200
            const b = Math.round(68 + (12 * ratio)); // 68 -> 80
            return `rgb(${r}, ${g}, ${b})`;
        }
    };

    return (
        <AnimatePresence>
            {isActive && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        position: 'fixed',
                        top: '80px', // Right below navbar
                        left: 0,
                        right: 0,
                        height: '3px',
                        zIndex: 9999,
                        pointerEvents: 'none',
                        background: 'transparent',
                    }}
                >
                    {/* Track (very subtle) */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'var(--border)',
                        opacity: 0.3,
                    }} />

                    {/* Progress fill with color transition */}
                    <motion.div
                        style={{
                            height: '100%',
                            background: getProgressColor(progress),
                            boxShadow: `0 0 10px ${getProgressColor(progress)}40, 0 0 20px ${getProgressColor(progress)}20`,
                            position: 'relative',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        {/* Glow effect at the leading edge */}
                        <motion.div
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '20px',
                                height: '6px',
                                background: `radial-gradient(ellipse at right, ${getProgressColor(progress)}, transparent)`,
                                filter: 'blur(2px)',
                            }}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
