import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdminAccess } from "@/lib/rbac";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // SECURITY: Verify admin role via RBAC
    const adminUser = await requireAdminAccess();

    if (!adminUser) {
        // User is either not logged in or not an admin
        redirect("/?error=unauthorized");
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-primary)' }}>
            <AdminSidebar username={adminUser.username} />
            <main style={{
                flex: 1,
                width: '100%',
                overflowY: 'auto',
                overflowX: 'hidden'
            }}>
                {children}
            </main>
        </div>
    );
}
