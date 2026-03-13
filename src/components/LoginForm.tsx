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

    const isLoading = isAuthPending || isRegisterPending;

    const shouldShowRegisterPrompt = isRegistering || authResult?.status === "user_not_found";
    const loginError = searchParams.get("error") === "UserNotFound"
        ? "The user account you are trying to access does not exist."
        : null;

    return (
        <div className="premium-panel auth-card">
            <div className="auth-header">
                <div className="section-kicker">
                    <Sparkles size={13} />
                    Premium investor access
                </div>
                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to the same premium portfolio workspace you saw on the landing experience.</p>
            </div>

            <div className="auth-benefit-grid">
                {[
                    { icon: ShieldCheck, label: "Private by default" },
                    { icon: ArrowRight, label: "Fast portfolio access" },
                ].map(({ icon: Icon, label }) => (
                    <div key={label} className="auth-benefit-card">
                        <div className="auth-benefit-icon">
                            <Icon size={15} />
                        </div>
                        <div className="auth-benefit-label">{label}</div>
                    </div>
                ))}
            </div>

            <form
                action={(submittedFormData) => {
                    setFormData(submittedFormData);
                    if (isRegistering) {
                        registerAction(submittedFormData);
                    } else {
                        authAction(submittedFormData);
                    }
                }}
                className="auth-form"
            >
                <div className="auth-field-group">
                    <label className="auth-field-label">Email Address</label>
                    <input
                        className="premium-input"
                        name="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        defaultValue={formData?.get("email") as string || ""}
                    />
                </div>

                <div className="auth-field-group">
                    <div className="auth-field-label-row">
                        <label className="auth-field-label">Password</label>
                        <span className="auth-field-hint">Minimum 8 characters</span>
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
                    <div className="auth-error-text">{authResult.error}</div>
                )}

                {loginError && !authResult?.error && !shouldShowRegisterPrompt && (
                    <div className="auth-error-text">{loginError}</div>
                )}

                {registerResult?.error && (
                    <div className="auth-error-text">{registerResult.error}</div>
                )}

                {shouldShowRegisterPrompt ? (
                    <div className="auth-register-prompt">
                        <p className="auth-register-copy">Account not found. Create a new one?</p>

                        <div className="auth-register-actions">
                            <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => setIsRegistering(false)}
                                className="auth-btn auth-btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="auth-btn auth-btn-primary auth-btn-grow"
                            >
                                {isRegisterPending ? (
                                    <>
                                        <span className="auth-spinner auth-spinner-light" />
                                        Creating...
                                    </>
                                ) : "Create Account"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="auth-main-actions">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="auth-btn auth-btn-primary auth-btn-full"
                        >
                            {isAuthPending ? (
                                <>
                                    <span className="auth-spinner auth-spinner-light" />
                                    Signing in...
                                </>
                            ) : "Sign In"}
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            formAction={(submittedFormData) => {
                                setFormData(submittedFormData);
                                registerAction(submittedFormData);
                            }}
                            className="auth-btn auth-btn-outline auth-btn-full"
                        >
                            {isRegisterPending ? (
                                <>
                                    <span className="auth-spinner auth-spinner-muted" />
                                    Creating account...
                                </>
                            ) : "Create Account"}
                        </button>
                    </div>
                )}

                {!shouldShowRegisterPrompt && (
                    <div className="auth-footer-note">
                        Need a quick preview first? <Link href="/demo" className="premium-link">Open the live demo</Link>
                    </div>
                )}
            </form>
        </div>
    );
}
