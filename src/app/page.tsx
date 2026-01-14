import { auth } from "@/auth";
import { LandingPage } from "@/components/LandingPage";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();

  // Diagnostic Check
  let debugInfo = { userCount: -2, dbHost: 'init', authUrl: 'init' };
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.user.count();
    debugInfo = {
      userCount: count,
      dbHost: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'missing',
      authUrl: process.env.NEXTAUTH_URL || 'missing'
    };
  } catch (e) {
    debugInfo = { userCount: -1, dbHost: 'error', authUrl: 'error' };
    console.error(e);
  }

  return (
    <>
      <LandingPage
        isLoggedIn={!!session?.user}
        username={session?.user?.name || undefined}
        userEmail={session?.user?.email || undefined}
      />
      <div style={{
        position: 'fixed',
        bottom: '0px',
        right: '0px',
        background: 'rgba(0,0,0,0.85)',
        color: '#0f0',
        fontSize: '10px',
        padding: '4px 8px',
        fontFamily: 'monospace',
        zIndex: 9999
      }}>
        Debug: Users={debugInfo.userCount} | DB={debugInfo.dbHost} | Auth={debugInfo.authUrl} | v={Math.random().toString().slice(2, 5)}
      </div>
    </>
  );
}

