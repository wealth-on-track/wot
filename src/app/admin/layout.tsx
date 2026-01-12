import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // Basic protection
    if (!session?.user) {
        redirect("/?login=true");
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-primary)' }}>
            <AdminSidebar username={session.user.name || ''} />
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
