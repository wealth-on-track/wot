"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";

interface UpdateToastProps {
    isVisible: boolean;
    message?: string;
    onClose?: () => void;
    autoHide?: number;
}

export function UpdateToast({
    isVisible,
    message = "Prices updated",
    onClose,
    autoHide = 3000
}: UpdateToastProps) {

    useEffect(() => {
        if (isVisible && autoHide > 0 && onClose) {
            const timer = setTimeout(onClose, autoHide);
            return () => clearTimeout(timer);
        }
    }, [isVisible, autoHide, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30
                    }}
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 20px',
                        background: 'var(--surface)',
                        border: '1px solid var(--success)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                    }}
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
                    >
                        <CheckCircle size={20} color="var(--success)" />
                    </motion.div>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                    }}>
                        {message}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
