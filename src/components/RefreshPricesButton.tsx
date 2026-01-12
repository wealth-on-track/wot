"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshPricesButton() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleRefresh = async () => {
        setLoading(true);
        setMessage("");
        try {
            const res = await fetch('/api/cron/update-prices');
            const data = await res.json();
            if (data.success) {
                setMessage(`Success: Updated ${data.updatedCount} symbols.`);
            } else {
                setMessage("Failed to update.");
            }
        } catch (e) {
            setMessage("Error triggering update.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
                onClick={handleRefresh}
                disabled={loading}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem 1.2rem',
                    background: '#4F46E5', color: '#fff',
                    border: 'none', borderRadius: '8px',
                    fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                }}
            >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                {loading ? "Updating in Background..." : "Trigger Price Update"}
            </button>
            {message && <span style={{ fontSize: '0.9rem', color: message.startsWith('Success') ? '#10b981' : '#ef4444' }}>{message}</span>}
        </div>
    );
}
