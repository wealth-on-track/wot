"use client";

import { useEffect, useState, useRef } from "react";
import { motion, animate, useMotionValue } from "framer-motion";

interface AnimatedValueProps {
    value: number;
    format?: (v: number) => string;
    duration?: number;
    className?: string;
    style?: React.CSSProperties;
}

export function AnimatedValue({
    value,
    format = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    duration = 4,
    className,
    style
}: AnimatedValueProps) {
    const motionValue = useMotionValue(value);
    const [displayValue, setDisplayValue] = useState(value);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip animation on first render
        if (isFirstRender.current) {
            isFirstRender.current = false;
            setDisplayValue(value);
            motionValue.set(value);
            return;
        }

        const controls = animate(motionValue, value, {
            duration,
            ease: "easeOut"
        });

        const unsubscribe = motionValue.on("change", (latest) => {
            setDisplayValue(latest);
        });

        return () => {
            controls.stop();
            unsubscribe();
        };
    }, [value, motionValue, duration]);

    return (
        <motion.span
            className={className}
            style={{
                fontVariantNumeric: 'tabular-nums',
                ...style
            }}
        >
            {format(displayValue)}
        </motion.span>
    );
}
