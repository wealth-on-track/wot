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

          {/* Login Form Card */}
          <LoginForm />

        </div>
      </CurrencyProvider>
    </div>
  );
}

