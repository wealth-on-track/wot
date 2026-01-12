import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRecentActivities } from "@/services/telemetry";
import ClientTimestamp from "@/components/ClientTimestamp";

export const dynamic = 'force-dynamic';

export default async function ActivityLogsPage() {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const activities = await getRecentActivities({ limit: 500 });

    // Activity type colors
    const getActivityColor = (type: string) => {
        switch (type) {
            case 'AUTH': return '#3b82f6'; // blue
            case 'ASSET': return '#10b981'; // green
            case 'SEARCH': return '#f59e0b'; // amber
            case 'PORTFOLIO': return '#8b5cf6'; // purple
            case 'GOAL': return '#ec4899'; // pink
            case 'NAVIGATION': return '#6b7280'; // gray
            case 'SYSTEM': return '#ef4444'; // red
            case 'API': return '#06b6d4'; // cyan
            default: return '#6b7280';
        }
    };

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem' }}>
                <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 900 }}>
                    System Activity Logs ({activities.length})
                </h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Comprehensive tracking of all user actions and system events
                </p>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                        <tr>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Time</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Type</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Action</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>User</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Target</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Details</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Status</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activities.map(activity => (
                            <tr key={activity.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                                    <ClientTimestamp date={activity.createdAt} />
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem' }}>
                                    <span style={{
                                        backgroundColor: `${getActivityColor(activity.activityType)}22`,
                                        color: getActivityColor(activity.activityType),
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '0.25rem',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase'
                                    }}>
                                        {activity.activityType}
                                    </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>{activity.action}</td>
                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                    {activity.username || activity.userId || 'System'}
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.7rem' }}>
                                    {activity.targetType ? (
                                        <span>
                                            {activity.targetType}
                                            {activity.targetId && <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>({activity.targetId.slice(0, 8)}...)</span>}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td style={{
                                    padding: '0.5rem 0.6rem',
                                    fontFamily: 'monospace',
                                    fontSize: '0.65rem',
                                    maxWidth: '300px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }} title={activity.details ? JSON.stringify(activity.details) : ''}>
                                    {activity.details ? JSON.stringify(activity.details) : '-'}
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                                    <span style={{
                                        color: activity.status === 'SUCCESS' ? '#4caf50' : activity.status === 'ERROR' ? '#ff4444' : '#f59e0b',
                                        fontWeight: 700,
                                        fontSize: '0.7rem'
                                    }}>
                                        {activity.status === 'SUCCESS' ? '✓' : activity.status === 'ERROR' ? '✗' : '⏳'}
                                    </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {activity.duration ? `${activity.duration}ms` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
