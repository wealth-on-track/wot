import ProfilePage from "../[username]/page";

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  // Single source of truth: use real demo user portfolio from DB,
  // same rendering path as /[username].
  return ProfilePage({ params: Promise.resolve({ username: 'demo' }) });
}
