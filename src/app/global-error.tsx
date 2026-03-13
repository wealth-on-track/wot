"use client";

/**
 * Global Error Boundary
 * Catches unhandled errors at the root level
 */

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[GlobalError]", error, { digest: error.digest });
    }, [error]);

    return (
        <html lang="en">
            <body className="wot-state-body">
                <div className="wot-state-shell">
                    <div className="wot-state-card premium-panel">
                        <div className="wot-state-icon wot-state-icon-error" aria-hidden="true">
                            <AlertTriangle size={30} />
                        </div>
                        <h1 className="wot-state-title">Something went wrong</h1>
                        <p className="wot-state-copy">
                            We hit an unexpected error. Please try again in a moment.
                        </p>
                        <button onClick={reset} className="btn-primary wot-state-btn" type="button">
                            Try Again
                        </button>
                        {error.digest && <p className="wot-state-digest">Error ID: {error.digest}</p>}
                    </div>
                </div>
            </body>
        </html>
    );
}
