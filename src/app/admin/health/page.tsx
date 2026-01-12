
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDailyStats } from "@/services/telemetry";

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const stats = await getDailyStats();

    // Custom Priority Logic
    const PRIORITY_MAP: Record<string, number> = {
        'YAHOO_DIRECT': 1,
        'YAHOO': 2,
        'ALPHA_VANTAGE': 3,
        'FINNHUB': 4,
        'MARKETSTACK': 5,
        'MASSIVE': 6,
        'LOGODEV': 7,
        'BIST_CDN': 8,
        'FLAGCDN': 9,
        'COINCAP': 10
    };

    const sortedStats = [...stats].sort((a, b) => {
        // 1. Sort by Priority Config
        const pA = PRIORITY_MAP[a.provider] || 999;
        const pB = PRIORITY_MAP[b.provider] || 999;
        if (pA !== pB) return pA - pB;

        // 2. Secondary: Sort by Total Volume (Desc)
        const totalA = a.successCount + a.errorCount;
        const totalB = b.successCount + b.errorCount;
        return totalB - totalA;
    });

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <h1 className="gradient-text" style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 900 }}>Provider Health</h1>

            <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>#</th>
                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Provider</th>
                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Total Requests</th>
                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Success</th>
                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Errors</th>
                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Success Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStats.map((s, idx) => {
                            const total = s.successCount + s.errorCount;
                            const rate = total > 0 ? ((s.successCount / total) * 100).toFixed(1) : '0.0';
                            const rateVal = parseFloat(rate);

                            return (
                                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-muted)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                    <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{idx + 1}</td>
                                    <td style={{ padding: '0.4rem 0.6rem' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.8rem' }}>{s.provider}</div>
                                        {/* <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{s.dateKey}</div> */}
                                    </td>
                                    <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{total.toLocaleString()}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: '#4caf50', fontWeight: 600, fontFamily: 'monospace' }}>{s.successCount.toLocaleString()}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: s.errorCount > 0 ? '#ff4444' : 'var(--text-muted)', fontWeight: 600, fontFamily: 'monospace' }}>{s.errorCount}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            background: rateVal >= 90 ? 'rgba(76, 175, 80, 0.1)' : rateVal >= 50 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: rateVal >= 90 ? '#4caf50' : rateVal >= 50 ? '#eab308' : '#ff4444',
                                            fontSize: '0.75rem',
                                            minWidth: '50px',
                                            textAlign: 'center'
                                        }}>
                                            {rate}%
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {stats.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                                    No tracked API activity found for today.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
