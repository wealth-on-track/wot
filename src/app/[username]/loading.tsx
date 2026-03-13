"use client";

export default function Loading() {
    return (
        <div className="wot-loader-shell wot-loader-shell-minimal" role="status" aria-live="polite" aria-label="Loading profile">
            <div className="wot-loader-minimal-spinner" aria-hidden="true" />
            <p className="wot-loader-minimal-message">Loading portfolio…</p>
        </div>
    );
}
