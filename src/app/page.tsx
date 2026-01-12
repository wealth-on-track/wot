import Link from "next/link";

import { auth } from "@/auth";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { LoginForm } from "@/components/LoginForm";
import { handleSignOut } from "@/lib/authActions";

export const dynamic = 'force-dynamic';



import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  // If logged in, go straight to portfolio
  if (session?.user?.name) {
    redirect(`/${session.user.name}`);
  }

  // Common Layout Wrapper
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '2rem', paddingTop: '5.5rem' }}>
      <CurrencyProvider>
        {/* Navbar removed as per request */}

        <div className="container" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '5rem',
          paddingTop: '0.0rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="gradient-text" style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '0.5rem', lineHeight: 1.1 }}>
              Modern Portfolio Tracker
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
              Track your wealth!
            </p>
          </div>

          {/* Demo Button */}
          <Link
            href="/demo"
            className="glass-button"
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              color: 'white',
              border: 'none',
              boxShadow: '0 4px 12px var(--accent-glow)'
            }}
          >
            🎨 View Demo Portfolio
          </Link>

          {/* Login Form Card */}
          <LoginForm />

        </div>
      </CurrencyProvider>
    </div>
  );
}

