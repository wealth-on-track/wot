"use client";

import { useActionState, useEffect, useState } from "react";
import { authenticate, register } from "@/lib/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function LoginForm() {
    const [authResult, authAction] = useActionState(authenticate, undefined);
    const [registerResult, registerAction] = useActionState(register, undefined);
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState<FormData | null>(null);
    const router = useRouter();

    // Effect to handle switching to registration mode if user not found
    useEffect(() => {
        if (authResult === "user_not_found") {
            setIsRegistering(true);
        }
    }, [authResult]);

    // If we are in "confirmation" mode, this might still be used if we go with the prompt flow.
    // However, the register action now handles auto-login and redirecting itself.

    // Capture form data on submit to reuse for registration
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const newFormData = new FormData(form);
        setFormData(newFormData);

        // If we are in "confirmation" mode, this submit button would likely be the "OK" button
        // But the main form is for login.

        // Let's rely on the action prop for the main form, but intercept to save data.
        // Actually, preventing default stops the action prop.
        // We should construct form data and call the action manually?
        // Or simpler: let the form action handle it, but how do we get data for register step?
        // We can just keep the inputs in the DOM and submit them to register action?

        // Better approach:
        // Main form has inputs. Action is `authAction`.
        // If `authResult` is "user_not_found", we show a modal/overlay.
        // The modal has "OK" button.
        // "OK" button triggers `registerAction` with the SAME inputs.
        // We can achieve this by having hidden inputs in a secondary form, or just using `bind`?
        // Or simpler: Just keep one form, change the `action` based on state?
        // If `isRegistering`, action becomes `registerAction`.

        if (isRegistering) {
            // If we are already in registering state (showing the prompt), 
            // accessing this might be different.
            // Let's build the UI first.
        }

        // Default behavior for React 19 actions is confusing with manual submits.
        // Let's just use the `action={authAction}` on the form, and a separate button for register confirming.
    };

    const handleCreateAccount = () => {
        if (formData) {
            // We have the data from the previous failed login attempt
            // We need to submit this to register
            // We can't pass FormData directly to useActionState's dispatch easily if it expects payload?
            // React signatures are `(payload)` matching the action.
            // `registerAction` expects FormData.
            registerAction(formData);
        }
    };

    return (
        <div className="neo-card" style={{ padding: '2.5rem', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Welcome Back</h1>
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

                {authResult && authResult !== "user_not_found" && !isRegistering && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{authResult}</div>
                )}

                {isRegistering ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', background: 'var(--accent-glow)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600, lineHeight: '1.4' }}>
                            Account not found. Create a new one?
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsRegistering(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{
                                    flex: 2,
                                    padding: '0.875rem',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(79, 70, 229, 0.2)'
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            type="submit"
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'var(--accent)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 800,
                                fontSize: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            Sign In
                        </button>
                        <button
                            type="submit"
                            formAction={(formData) => {
                                setFormData(formData);
                                registerAction(formData);
                            }}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            Create Account
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
