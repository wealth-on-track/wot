
"use client";

import React, { useEffect, useState } from 'react';

export function DeploymentFooter() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    const shortSha = commitSha?.substring(0, 7) || 'local';
    const env = process.env.NEXT_PUBLIC_VERCEL_ENV || 'dev';
    const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;

    // Format date if valid
    let dateStr = '';
    if (buildTime) {
        try {
            dateStr = new Date(buildTime).toLocaleString('tr-TR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
        } catch {
            dateStr = buildTime;
        }
    }

    return (
        <div style={{
            textAlign: 'center',
            padding: '2rem 1rem 1rem',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            opacity: 0.6,
            fontFamily: 'monospace',
            marginTop: '2rem',
            borderTop: '1px solid transparent'
        }}>
            <p style={{ margin: 0, display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{env}</span>
                <span>•</span>
                <span>Ver: {shortSha}</span>
                {dateStr && (
                    <>
                        <span>•</span>
                        <span>{dateStr}</span>
                    </>
                )}
            </p>
        </div>
    );
}
