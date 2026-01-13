import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SettingsPage } from "@/components/SettingsPage";

export const dynamic = 'force-dynamic';

export default async function Settings() {
    const session = await auth();

    // Require authentication
    if (!session?.user?.email) {
        redirect('/login');
    }

    return <SettingsPage userEmail={session.user.email} />;
}
