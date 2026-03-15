import ProfilePage from "../[username]/page";
import { LandingPage } from "@/components/LandingPage";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  const demoUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'demo' },
        { email: 'demo' },
        { email: 'demo@wot.money' },
      ],
    },
    select: { id: true },
  });

  if (demoUser) {
    return await ProfilePage({ params: Promise.resolve({ username: 'demo' }) });
  }

  const buildTag = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_TAG || 'local').slice(0, 7);

  return (
    <LandingPage
      isLoggedIn={false}
      username={undefined}
      userEmail={undefined}
      buildTag={buildTag}
    />
  );
}
