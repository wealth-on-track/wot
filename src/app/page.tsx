import { auth } from "@/auth";
import { LandingPage } from "@/components/LandingPage";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();

  return (
    <LandingPage
      isLoggedIn={!!session?.user}
      username={session?.user?.name || undefined}
      userEmail={session?.user?.email || undefined}
    />
  );
}
