"use client";

/**
 * Page-Level Error Boundary
 * Catches errors in page components
 */

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console
        console.error('[PageError]', error, { digest: error.digest });
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
        }}>
            <div style={{
                maxWidth: '400px',
                textAlign: 'center',
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                }}>
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>

                <h2 style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                }}>
                    Page Error
                </h2>

                <p style={{
                    color: 'var(--text-secondary, #888)',
                    marginBottom: '1.5rem',
                    lineHeight: 1.6,
                }}>
                    Something went wrong while loading this page.
                    Please try again or go back to the dashboard.
                </p>

                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'center',
                }}>
                    <button
                        onClick={reset}
                        className="btn-primary"
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Try Again
                    </button>
                    <Link
                        href="/"
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: 600,
                        }}
                    >
                        Go Home
                    </Link>
                </div>

                {error.digest && (
                    <p style={{
                        marginTop: '1.5rem',
                        fontSize: '0.7rem',
                        color: '#555',
                    }}>
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
