"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { authenticate, register } from "@/lib/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function LoginForm() {
    const [authResult, authAction, isAuthPending] = useActionState(authenticate, undefined);
    const [registerResult, registerAction, isRegisterPending] = useActionState(register, undefined);
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState<FormData | null>(null);
    const router = useRouter();

    // Combined loading state for general UI disabled states
    const isLoading = isAuthPending || isRegisterPending;

    // Effect to handle switching to registration mode if user not found
    useEffect(() => {
        if (authResult?.status === "user_not_found") {
            setIsRegistering(true);
        }
    }, [authResult]);

    // Handle URL error parameters
    const [loginError, setLoginError] = useState<string | null>(null);
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const errorType = searchParams.get('error');
        if (errorType === 'UserNotFound') {
            setLoginError("The user account you are trying to access does not exist.");
        }
    }, []);

    // Reset loading when register result comes back


    // Capture form data on submit to reuse for registration
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // Default behavior for React 19 actions is confusing with manual submits.
        // Let's just use the `action={authAction}` on the form, and a separate button for register confirming.
    };

    return (
        <div className="neo-card" style={{ padding: '2.5rem', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Welcome</h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Access your professional portfolio dashboard</p>
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
                        name="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        style={{
                            padding: '0.875rem 1.25rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        defaultValue={formData?.get("email") as string || ""}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <input
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        style={{
                            padding: '0.875rem 1.25rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        defaultValue={formData?.get("password") as string || ""}
                    />
                </div>

                {authResult?.error && !isRegistering && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{authResult.error}</div>
                )}

                {loginError && !authResult?.error && !isRegistering && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{loginError}</div>
                )}

                {registerResult?.error && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{registerResult.error}</div>
                )}

                {isRegistering ? (
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
            </form>
        </div>
    );
}
