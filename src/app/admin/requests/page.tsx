
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRecentLogs } from "@/services/telemetry";
import ClientTimestamp from "@/components/ClientTimestamp";

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const logs = await getRecentLogs(500);

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem' }}>
                <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 900 }}>
                    API Request Logs ({logs.length})
                </h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    External API calls to Yahoo Finance, TEFAS, and other data providers
                </p>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                        <tr>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Time</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>User</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Provider</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Action</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Params</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Status</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Duration</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                                    <ClientTimestamp date={log.createdAt} />
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>
                                    {log.userId || 'System'}
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>{log.provider}</td>
                                <td style={{ padding: '0.5rem 0.6rem' }}>{log.endpoint}</td>
                                <td style={{ padding: '0.5rem 0.6rem', fontFamily: 'monospace', fontSize: '0.7rem' }}>{log.params}</td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                                    <span style={{
                                        color: log.status === 'SUCCESS' ? '#4caf50' : '#ff4444',
                                        fontWeight: 700,
                                        fontSize: '0.7rem'
                                    }}>
                                        {log.status === 'SUCCESS' ? 'OK' : 'ERR'}
                                    </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontSize: '0.7rem' }}>
                                    {log.duration ? `${log.duration}ms` : '-'}
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', color: '#ff4444', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem' }} title={log.error || ''}>
                                    {log.error || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
