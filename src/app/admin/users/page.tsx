
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { User as UserIcon } from "lucide-react";
import ClientTimestamp from "@/components/ClientTimestamp";

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            Portfolio: {
                include: {
                    _count: {
                        select: { Asset: true }
                    }
                }
            }
        }
    });

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 900 }}>Users ({users.length})</h1>

            <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                        <tr>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>User</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Email</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Assets</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Public?</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>Joined</th>
                            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <UserIcon size={14} />
                                        {u.username}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', opacity: 0.5, fontFamily: 'monospace' }}>{u.id}</div>
                                </td>
                                <td style={{ padding: '0.6rem 0.75rem' }}>{u.email}</td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 'bold' }}>
                                    {u.Portfolio?._count.Asset || 0}
                                </td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                                    {u.Portfolio?.isPublic ?
                                        <span style={{ color: '#4caf50', background: 'rgba(76, 175, 80, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Public</span>
                                        :
                                        <span style={{ color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Private</span>
                                    }
                                </td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    <ClientTimestamp date={u.createdAt} />
                                </td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    <ClientTimestamp date={u.updatedAt} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
