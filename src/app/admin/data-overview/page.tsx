
import { getDataOverview, getSystemHealthStats } from "@/lib/dataOverview";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TrendingDown, AlertCircle, CheckCircle } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function DataOverviewPage() {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const [healthStats, dataRows] = await Promise.all([
        getSystemHealthStats(),
        getDataOverview()
    ]);

    const freshnessPercentage = healthStats.totalPrices > 0
        ? (healthStats.freshPrices / healthStats.totalPrices) * 100
        : 0;

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 900 }}>Data Overview</h1>

            {/* System Health Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Total Records</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{healthStats.totalAssets}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Assets</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Price Coverage</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{healthStats.totalPrices}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Cached Prices</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center', border: freshnessPercentage < 70 ? '1px solid #ff4444' : undefined }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Data Freshness</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: freshnessPercentage >= 90 ? '#4caf50' : freshnessPercentage >= 70 ? '#eab308' : '#ff4444' }}>
                        {freshnessPercentage.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{healthStats.freshPrices} Fresh</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>Historical Data</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{healthStats.totalHistory}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Data Points</div>
                </div>

                <div className="card" style={{ padding: '0.75rem', textAlign: 'center', border: healthStats.apiSuccessRate24h < 80 ? '1px solid #ff4444' : undefined }}>
                    <h3 style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>API Health (24h)</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: healthStats.apiSuccessRate24h >= 95 ? '#4caf50' : healthStats.apiSuccessRate24h >= 80 ? '#eab308' : '#ff4444' }}>
                        {healthStats.apiSuccessRate24h.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Success Rate</div>
                </div>
            </div>

            {/* Unified Data Table */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Unified Data Table ({dataRows.length} records)</h2>
                <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>User</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Symbol</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Asset Name</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Qty</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Buy Price</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Current Price</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Source</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Status</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Age</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>History</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>API Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dataRows.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.userEmail}</td>
                                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 'bold' }}>{row.symbol}</td>
                                    <td style={{ padding: '0.5rem 0.6rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.assetName || ''}>
                                        {row.assetName || '-'}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>{row.quantity}</td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                                        {row.buyPrice.toFixed(2)} {row.assetCurrency}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                        {row.currentPrice ? `${row.currentPrice.toFixed(2)} ${row.priceCurrency}` : '-'}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontSize: '0.7rem' }}>
                                        {row.priceSource || '-'}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                                        {row.dataStatus === 'fresh' && <span style={{ color: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><CheckCircle size={14} /> Fresh</span>}
                                        {row.dataStatus === 'stale' && <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><TrendingDown size={14} /> Stale</span>}
                                        {row.dataStatus === 'missing' && <span style={{ color: '#ff4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><AlertCircle size={14} /> Missing</span>}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontSize: '0.7rem' }}>
                                        {row.ageMinutes !== null ? `${row.ageMinutes}m` : '-'}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontSize: '0.7rem' }}>
                                        {row.hasHistory ? `✓ (${row.historyCount})` : '✗'}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontSize: '0.7rem' }}>
                                        {row.lastApiCallStatus === 'SUCCESS' ? <span style={{ color: '#4caf50' }}>✓</span> : row.lastApiCallStatus === 'ERROR' ? <span style={{ color: '#ff4444' }}>✗</span> : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
