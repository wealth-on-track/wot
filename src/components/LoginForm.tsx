"use client";

import { useActionState, useState } from "react";
import { authenticate, register } from "@/lib/actions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export function LoginForm() {
    const [authResult, authAction, isAuthPending] = useActionState(authenticate, undefined);
    const [registerResult, registerAction, isRegisterPending] = useActionState(register, undefined);
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState<FormData | null>(null);
    const searchParams = useSearchParams();

    // Combined loading state for general UI disabled states
    const isLoading = isAuthPending || isRegisterPending;

    const shouldShowRegisterPrompt = isRegistering || authResult?.status === "user_not_found";
    const loginError = searchParams.get("error") === "UserNotFound"
        ? "The user account you are trying to access does not exist."
        : null;


    return (
        <div className="premium-panel" style={{ padding: '2.5rem', width: '100%', maxWidth: '460px', boxShadow: 'var(--shadow-lg)', borderRadius: '1.6rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div className="section-kicker" style={{ marginBottom: '1rem' }}>
                    <Sparkles size={13} />
                    Premium investor access
                </div>
                <h1 style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.6rem' }}>Welcome back</h1>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Sign in to the same premium portfolio workspace you saw on the landing experience.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    { icon: ShieldCheck, label: 'Private by default' },
                    { icon: ArrowRight, label: 'Fast portfolio access' },
                ].map(({ icon: Icon, label }) => (
                    <div key={label} style={{ border: '1px solid var(--border)', borderRadius: '1rem', padding: '0.85rem 0.9rem', background: 'color-mix(in oklab, var(--surface) 82%, transparent)' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in oklab, var(--accent) 18%, transparent)', color: 'var(--accent)', marginBottom: '0.55rem' }}>
                            <Icon size={15} />
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</div>
                    </div>
                ))}
            </div>

            <form action={(formData) => {
                setFormData(formData);
                if (isRegistering) {
                    registerAction(formData);
                } else {
                    authAction(formData);
                }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                    <input
                        className="premium-input"
                        name="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        defaultValue={formData?.get("email") as string || ""}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Minimum 8 characters</span>
                    </div>
                    <input
                        className="premium-input"
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        defaultValue={formData?.get("password") as string || ""}
                    />
                </div>

                {authResult?.error && !shouldShowRegisterPrompt && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{authResult.error}</div>
                )}

                {loginError && !authResult?.error && !shouldShowRegisterPrompt && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{loginError}</div>
                )}

                {registerResult?.error && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{registerResult.error}</div>
                )}

                {shouldShowRegisterPrompt ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', background: 'var(--accent-glow)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600, lineHeight: '1.4' }}>
                            Account not found. Create a new one?
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => setIsRegistering(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 700,
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    opacity: isLoading ? 0.6 : 1
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                // formAction={registerAction} // Handled by strict logic below
                                style={{
                                    flex: 2,
                                    padding: '0.875rem',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 800,
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 6px rgba(79, 70, 229, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {isRegisterPending ? (
                                    <>
                                        <span style={{
                                            width: '14px',
                                            height: '14px',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            borderTopColor: '#fff',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite'
                                        }} />
                                        Creating...
                                    </>
                                ) : 'Create Account'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            type="submit"
                            disabled={isLoading}
                            // Default submit is authAction
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: isAuthPending ? 'var(--accent-muted, #6366f1cc)' : 'var(--accent)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 800,
                                fontSize: '1rem',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                                opacity: isLoading ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            {isAuthPending ? (
                                <>
                                    <span style={{
                                        width: '16px',
                                        height: '16px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    Signing in...
                                </>
                            ) : 'Sign In'}
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            formAction={(formData) => {
                                setFormData(formData);
                                registerAction(formData);
                            }}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: isRegisterPending ? 'var(--bg-secondary)' : 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                opacity: isLoading ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = 'var(--bg-secondary)')}
                            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.background = 'transparent')}
                        >
                            {isRegisterPending ? (
                                <>
                                    <span style={{
                                        width: '14px',
                                        height: '14px',
                                        border: '2px solid rgba(100,100,100,0.3)',
                                        borderTopColor: 'var(--text-secondary)',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    Creating account...
                                </>
                            ) : 'Create Account'}
                        </button>
                    </div>
                )}

                {!shouldShowRegisterPrompt && (
                    <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Need a quick preview first? <Link href="/demo" className="premium-link">Open the live demo</Link>
                    </div>
                )}
            </form>
        </div>
    );
}
