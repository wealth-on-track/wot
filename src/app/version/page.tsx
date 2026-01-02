export const dynamic = 'force-dynamic';

export default function VersionPage() {
    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
            <h1>System Status</h1>
            <p>Version: 0.1.4</p>
            <p>Build Time: {new Date().toISOString()}</p>
            <p>Status: Active</p>
        </div>
    );
}
