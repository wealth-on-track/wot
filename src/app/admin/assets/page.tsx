
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClientTimestamp from "@/components/ClientTimestamp";

export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const assets = await prisma.asset.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
    });

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 900 }}>Assets DB ({assets.length})</h1>

            <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                        <tr>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Symbol</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Name</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Type</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Exchange</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Currency</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Country</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Sector</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map(asset => (
                            <tr key={asset.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.5rem 0.6rem', fontWeight: 'bold' }}>{asset.symbol}</td>
                                <td style={{ padding: '0.5rem 0.6rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={asset.name || ''}>
                                    {asset.name || '-'}
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '2px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600,
                                        background: 'rgba(255,255,255,0.1)'
                                    }}>
                                        {asset.type}
                                    </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>{asset.exchange || '-'}</td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>{asset.currency}</td>
                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>{asset.country || '-'}</td>
                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>{asset.sector || '-'}</td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                    <ClientTimestamp date={asset.createdAt} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
