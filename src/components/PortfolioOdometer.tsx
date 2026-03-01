"use client";

import { useEffect, useState, useRef } from "react";
import { motion, animate, useMotionValue, AnimatePresence } from "framer-motion";

interface PortfolioOdometerProps {
    value: number;
    currencySymbol?: string;
    showChange?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export function PortfolioOdometer({
    value,
    currencySymbol = '€',
    showChange = true,
    className,
    style
}: PortfolioOdometerProps) {
    const motionValue = useMotionValue(value);
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);
    const [changeInfo, setChangeInfo] = useState<{ amount: number; direction: 'up' | 'down' | null }>({ amount: 0, direction: null });
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip animation on first render
        if (isFirstRender.current) {
            isFirstRender.current = false;
            setDisplay(value);
            motionValue.set(value);
            prevRef.current = value;
            return;
        }

        const prevValue = prevRef.current;
        const change = value - prevValue;

        if (change !== 0) {
            setChangeInfo({
                amount: change,
                direction: change > 0 ? 'up' : 'down'
            });

            // Clear change indicator after animation
            setTimeout(() => {
                setChangeInfo({ amount: 0, direction: null });
            }, 2000);
        }

        const controls = animate(motionValue, value, {
            duration: 1.2,
            ease: [0.32, 0.72, 0, 1]
        });

        const unsubscribe = motionValue.on("change", (latest) => {
            setDisplay(latest);
        });

        prevRef.current = value;

        return () => {
            controls.stop();
            unsubscribe();
        };
    }, [value, motionValue]);

    const formatValue = (v: number) => {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(v);
    };

    const formatChange = (v: number) => {
        const sign = v > 0 ? '+' : '';
        return `${sign}${formatValue(v)}`;
    };

    return (
        <div
            className={className}
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                position: 'relative',
                ...style
            }}
        >
            <motion.span
                style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                }}
                layout
            >
                {currencySymbol}{formatValue(display)}
            </motion.span>

            <AnimatePresence>
                {showChange && changeInfo.direction && (
                    <motion.span
                        initial={{ opacity: 0, y: -5, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            fontSize: '0.7em',
                            fontWeight: 600,
                            color: changeInfo.direction === 'up' ? 'var(--success)' : 'var(--danger)',
                            marginTop: '2px',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {formatChange(changeInfo.amount)} {currencySymbol}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    );
}
