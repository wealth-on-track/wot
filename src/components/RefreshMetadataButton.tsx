"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshMetadataButton() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleRefresh = async () => {
        setLoading(true);
        setMessage("");

        try {
            const response = await fetch("/api/admin/refresh-metadata", {
                method: "POST"
            });

            const data = await response.json();

            if (data.success) {
                setMessage(`✅ ${data.message}`);
            } else {
                setMessage(`❌ ${data.error || "Failed to refresh metadata"}`);
            }
        } catch (error) {
            setMessage("❌ Error refreshing metadata");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
                onClick={handleRefresh}
                disabled={loading}
                style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: loading ? '#888' : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                    if (!loading) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.4)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(236, 72, 153, 0.3)';
                }}
            >
                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                {loading ? "Refreshing..." : "Refresh Metadata"}
            </button>
            {message && (
                <div style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    background: message.startsWith('✅') ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 68, 68, 0.1)',
                    color: message.startsWith('✅') ? '#4caf50' : '#ff4444',
                    maxWidth: '300px',
                    textAlign: 'right'
                }}>
                    {message}
                </div>
            )}
            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
