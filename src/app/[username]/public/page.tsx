import { redirect } from 'next/navigation';

export default async function LegacyPublicRedirect({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  redirect(`/${username}/portfolio_public`);
}
