"use client";

/**
 * Page-Level Error Boundary
 * Catches errors in page components
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[PageError]", error, { digest: error.digest });
    }, [error]);

    return (
        <div className="wot-state-shell">
            <div className="wot-state-card premium-panel">
                <div className="wot-state-icon wot-state-icon-error" aria-hidden="true">
                    <AlertTriangle size={28} />
                </div>

                <h2 className="wot-state-title">Page Error</h2>
                <p className="wot-state-copy">
                    Something went wrong while loading this page. Please retry or return to the dashboard.
                </p>

                <div className="wot-state-actions">
                    <button onClick={reset} className="btn-primary wot-state-btn" type="button">
                        Try Again
                    </button>
                    <Link href="/" className="btn-secondary wot-state-btn">
                        Go Home
                    </Link>
                </div>

                {error.digest && <p className="wot-state-digest">Error ID: {error.digest}</p>}
            </div>
        </div>
    );
}
