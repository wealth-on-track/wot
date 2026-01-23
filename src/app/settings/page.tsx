import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SettingsPage } from "@/components/SettingsPage";

import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function Settings() {
    const session = await auth();

    // Require authentication
    if (!session?.user?.email) {
        redirect('/login');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
            username: true,
            preferences: true
        }
    });

    return (
        <SettingsPage
            username={user?.username || ""}
            userEmail={session.user.email}
            preferences={user?.preferences as any}
        />
    );
}
