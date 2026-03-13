import { auth } from "@/auth";
import { LandingPage } from "@/components/LandingPage";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();

  const buildTag = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_TAG || 'local').slice(0, 7);

  return (
    <LandingPage
      isLoggedIn={!!session?.user}
      username={session?.user?.name || undefined}
      userEmail={session?.user?.email || undefined}
      buildTag={buildTag}
    />
  );
}
