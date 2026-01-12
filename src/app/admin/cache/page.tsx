
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClientTimestamp from "@/components/ClientTimestamp";

export const dynamic = 'force-dynamic';

export default async function CachePage() {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const priceCache = await prisma.priceCache.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 500
    });

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 900 }}>Price Cache ({priceCache.length})</h1>

            <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                        <tr>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Symbol</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Price</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>Currency</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>Source</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>User</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Trade Time</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {priceCache.map(item => (
                            <tr key={item.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.5rem 0.6rem', fontWeight: 'bold' }}>{item.symbol}</td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                                    {new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(item.previousClose)}
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>{item.currency}</td>
                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>{item.source || '-'}</td>
                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>{item.lastRequestedBy || '-'}</td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                    {item.tradeTime ? new Date(item.tradeTime).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                </td>
                                <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                    <ClientTimestamp date={item.updatedAt} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
