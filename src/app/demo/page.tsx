import ProfilePage from "../[username]/page";
import { LandingPage } from "@/components/LandingPage";

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  try {
    // Prefer the real demo portfolio when production data is healthy.
    return await ProfilePage({ params: Promise.resolve({ username: 'demo' }) });
  } catch (error) {
    console.error("[DemoPage] Falling back to marketing demo page", error);

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
}
