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
        <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '400px', borderRadius: '1rem' }}>
            <form action={(formData) => {
                setFormData(formData);
                if (isRegistering) {
                    registerAction(formData);
                } else {
                    authAction(formData);
                }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, minWidth: '80px' }}>Email</label>
                    <input
                        name="email"
                        type="email"
                        required
                        className="glass-input"
                        placeholder="you@example.com"
                        style={{ flex: 1 }}
                        defaultValue={formData?.get("email") as string || ""}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, minWidth: '80px' }}>Password</label>
                    <input
                        name="password"
                        type="password"
                        required
                        className="glass-input"
                        placeholder="•••••••"
                        style={{ flex: 1 }}
                        defaultValue={formData?.get("password") as string || ""}
                    />
                </div>

                {authResult && authResult !== "user_not_found" && !isRegistering && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>{authResult}</div>
                )}

                {isRegistering ? (
                    /* Account Creation Confirmation */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
                        <p style={{ opacity: 0.8, fontSize: '0.9rem', lineHeight: '1.4' }}>
                            We couldn't find an account with that email.<br />
                            <strong>Would you like to create one now?</strong>
                        </p>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsRegistering(false)}
                                className="glass-button"
                                style={{ flex: 1, background: 'rgba(128, 128, 128, 0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="glass-button"
                                style={{ flex: 2 }}
                            >
                                Create Account
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Standard Login/Sign Up Buttons */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button type="submit" className="glass-button" style={{ width: '100%', justifyContent: 'center' }}>
                            Login
                        </button>
                        <button
                            type="submit"
                            formAction={(formData) => {
                                setFormData(formData);
                                registerAction(formData);
                            }}
                            className="glass-button"
                            style={{ width: '100%', justifyContent: 'center', background: 'rgba(128, 128, 128, 0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                        >
                            Sign Up
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
