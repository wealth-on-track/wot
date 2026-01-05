import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '5rem',
            paddingTop: '2rem'
        }}>
            <div style={{ textAlign: 'center' }}>
                <h1 className="gradient-text" style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '0.5rem', lineHeight: 1.1 }}>
                    Modern Portfolio Tracker
                </h1>
                <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
                    Track your wealth!
                </p>
            </div>

            <LoginForm />
        </div>
    );
}
