"use client";

/**
 * Global Error Boundary
 * Catches unhandled errors at the root level
 */

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console
        console.error('[GlobalError]', error, { digest: error.digest });
    }, [error]);

    return (
        <html lang="en">
            <body style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a0a',
                color: '#fff',
                fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
                <div style={{
                    maxWidth: '500px',
                    textAlign: 'center',
                    padding: '2rem',
                }}>
                    <div style={{
                        fontSize: '4rem',
                        marginBottom: '1rem',
                    }}>
                        :(
                    </div>
                    <h1 style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                    }}>
                        Something went wrong
                    </h1>
                    <p style={{
                        color: '#888',
                        marginBottom: '1.5rem',
                        lineHeight: 1.6,
                    }}>
                        We encountered an unexpected error. Our team has been notified
                        and is working to fix it.
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '1rem',
                        }}
                    >
                        Try Again
                    </button>
                    {error.digest && (
                        <p style={{
                            marginTop: '1.5rem',
                            fontSize: '0.75rem',
                            color: '#555',
                        }}>
                            Error ID: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
