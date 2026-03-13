import { LoginForm } from "@/components/LoginForm";
import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";

const proofItems = [
    "Clear allocation and performance views",
    "Fast setup with no cluttered onboarding",
    "Desktop and mobile surfaces aligned",
];

export default function LoginPage() {
    return (
        <div className="premium-shell auth-hero-shell">
            <div className="soft-grid" />
            <div className="auth-hero-layout">
                <div className="auth-hero-copy">
                    <div className="section-kicker auth-hero-kicker">
                        <Sparkles size={13} />
                        Member sign in
                    </div>

                    <Link href="/" className="brand-lockup auth-hero-brand">
                        <div className="brand-mark" aria-hidden="true">
                            <span className="brand-glyph">W</span>
                            <span className="brand-glyph brand-glyph-accent">O</span>
                            <span className="brand-glyph">T</span>
                        </div>
                        <div className="brand-copy">
                            <span className="brand-title">Wealth on Track</span>
                            <span className="brand-subtitle">Premium portfolio operating system</span>
                        </div>
                    </Link>

                    <h1 className="auth-hero-title">
                        A calmer way to
                        <span className="auth-hero-title-accent">monitor serious money.</span>
                    </h1>

                    <p className="auth-hero-description">
                        Sign in for your dashboard, or create an account to start tracking performance,
                        allocation, and goals with a more premium UX.
                    </p>

                    <div className="proof-grid auth-hero-proof-grid">
                        {proofItems.map((item) => (
                            <div key={item} className="proof-card premium-panel auth-hero-proof-card">
                                <div className="auth-hero-proof-heading">
                                    <ShieldCheck size={15} color="var(--accent)" />
                                    Trusted workflow
                                </div>
                                <p className="auth-hero-proof-copy">{item}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="auth-hero-form-wrap">
                    <LoginForm />
                </div>
            </div>
        </div>
    );
}
