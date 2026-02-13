import { prisma } from "@/lib/prisma";
import { UserManagement } from "@/components/admin/UserManagement";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    // Initial data fetch
    const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                Portfolio: {
                    select: {
                        id: true,
                        isPublic: true,
                        _count: {
                            select: { Asset: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        }),
        prisma.user.count()
    ]);

    const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        portfolio: user.Portfolio ? {
            id: user.Portfolio.id,
            isPublic: user.Portfolio.isPublic,
            assetCount: user.Portfolio._count.Asset
        } : null
    }));

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1 className="gradient-text" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 900 }}>
                    User Management
                </h1>
                <div style={{ fontSize: '0.9rem', color: '#888' }}>
                    {totalCount} total users
                </div>
            </div>

            {/* User Management Client Component */}
            <UserManagement initialUsers={formattedUsers} totalCount={totalCount} />
        </div>
    );
}
