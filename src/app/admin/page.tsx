
import { prisma } from "@/lib/prisma";
import { getDailyStats, getActivityStats } from "@/services/telemetry";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { RefreshMetadataButton } from "@/components/RefreshMetadataButton";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const stats = await getDailyStats();
    const cacheCount = await prisma.priceCache.count();
    const userCount = await prisma.user.count();
    const assetCount = await prisma.asset.count();

    // Activity Stats (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const activityStats = await getActivityStats(yesterday);

    // Aggregation
    const totalRequests = stats.reduce((acc, s) => acc + s.successCount + s.errorCount, 0);
    const totalErrors = stats.reduce((acc, s) => acc + s.errorCount, 0);

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h1 className="gradient-text" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 900 }}>Dashboard</h1>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <RefreshPricesButton />
                    <RefreshMetadataButton />
                </div>
            </div>

            {/* Stats Grid - Compact */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>API Requests</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{totalRequests}</div>
                    <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.15rem' }}>Today</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center', border: totalErrors > 0 ? '1px solid #ff4444' : undefined }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>API Errors</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: totalErrors > 0 ? '#ff4444' : '#4caf50' }}>{totalErrors}</div>
                    <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.15rem' }}>Today</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderLeft: '3px solid #14b8a6' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Activities</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#14b8a6' }}>{activityStats.total}</div>
                    <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.15rem' }}>24h</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Assets</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{assetCount}</div>
                    <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.15rem' }}>Total</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Users</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{userCount}</div>
                    <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.15rem' }}>Total</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Cache</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{cacheCount}</div>
                    <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.15rem' }}>Symbols</div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minHeight: 0 }}>

                {/* API Stats Table */}
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>API Provider Statistics</h2>
                    <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                                <tr>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Provider</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Success</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Errors</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Total</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.map(stat => {
                                    const total = stat.successCount + stat.errorCount;
                                    const successRate = total > 0 ? ((stat.successCount / total) * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={stat.provider} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 'bold' }}>{stat.provider}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#4caf50' }}>{stat.successCount}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: stat.errorCount > 0 ? '#ff4444' : '#888' }}>{stat.errorCount}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold' }}>{total}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 'bold', color: parseFloat(successRate) >= 90 ? '#4caf50' : parseFloat(successRate) >= 70 ? '#eab308' : '#ff4444' }}>
                                                {successRate}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Activity Stats Table */}
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Activity Statistics (24h)</h2>
                    <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                                <tr>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Type</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>Count</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activityStats.byType.map((stat: any) => {
                                    const percentage = activityStats.total > 0 ? ((stat._count / activityStats.total) * 100).toFixed(1) : '0.0';
                                    const colors: Record<string, string> = {
                                        'AUTH': '#3b82f6',
                                        'ASSET': '#10b981',
                                        'SEARCH': '#f59e0b',
                                        'PORTFOLIO': '#8b5cf6',
                                        'GOAL': '#ec4899',
                                        'NAVIGATION': '#6b7280',
                                        'SYSTEM': '#ef4444'
                                    };
                                    return (
                                        <tr key={stat.activityType} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 'bold' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: colors[stat.activityType] || '#6b7280',
                                                    marginRight: '0.5rem'
                                                }}></span>
                                                {stat.activityType}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 'bold' }}>{stat._count}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#888' }}>{percentage}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
