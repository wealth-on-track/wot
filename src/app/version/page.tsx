export const dynamic = 'force-dynamic';

export default function VersionPage() {
    return (
        <main className="version-page-shell">
            <section className="version-page-card premium-panel" aria-label="System status">
                <div className="version-page-kicker">Diagnostics</div>
                <h1 className="version-page-title">System Status</h1>

                <dl className="version-page-grid">
                    <div className="version-page-row">
                        <dt>Version</dt>
                        <dd>0.1.4</dd>
                    </div>
                    <div className="version-page-row">
                        <dt>Build Time</dt>
                        <dd className="version-page-mono">{new Date().toISOString()}</dd>
                    </div>
                    <div className="version-page-row">
                        <dt>Status</dt>
                        <dd>
                            <span className="version-page-status">Active</span>
                        </dd>
                    </div>
                </dl>
            </section>
        </main>
    );
}
