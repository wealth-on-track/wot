"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Target, PieChart, ArrowRight, Check, LogOut } from "lucide-react";
import { handleSignOut } from "@/lib/authActions";

interface LandingPageProps {
    isLoggedIn: boolean;
    username?: string;
    userEmail?: string;
}

export function LandingPage({ isLoggedIn, username, userEmail }: LandingPageProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-main)'
        }}>
            {/* Hero Section */}
            <section style={{
                minHeight: isMobile ? '70vh' : '85vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '2rem 1rem' : '4rem 2rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Gradient */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-25%',
                    width: '150%',
                    height: '150%',
                    background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
                    opacity: 0.15,
                    pointerEvents: 'none'
                }} />

                <div style={{
                    maxWidth: '1200px',
                    width: '100%',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: isMobile ? '2rem' : '4rem',
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 1
                }}>
                    {/* Left: Text Content */}
                    <div style={{
                        textAlign: isMobile ? 'center' : 'left'
                    }}>
                        <h1 style={{
                            fontSize: isMobile ? '3.5rem' : '5rem',
                            fontWeight: 900,
                            lineHeight: 1,
                            letterSpacing: '-0.03em',
                            marginBottom: '0.5rem'
                        }}>
                            <span style={{
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                WOT
                            </span>
                        </h1>

                        <h2 style={{
                            fontSize: isMobile ? '1.75rem' : '2.75rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '1.5rem',
                            lineHeight: 1.2,
                            letterSpacing: '-0.02em'
                        }}>
                            Wealth on Track!
                        </h2>

                        <p style={{
                            fontSize: isMobile ? '1rem' : '1.2rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '2.5rem',
                            lineHeight: 1.6,
                            maxWidth: '500px',
                            margin: isMobile ? '0 auto 2.5rem' : '0 0 2.5rem'
                        }}>
                            Wealth on Track is the platform for long-term investors. Track all your assets in one place, analyze performance, and reach your financial milestones.
                        </p>

                        {/* Social Proof */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            marginBottom: '2rem',
                            justifyContent: isMobile ? 'center' : 'flex-start'
                        }}>
                            {/* User Avatars (placeholder circles) */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, var(--accent), var(--accent-hover))`,
                                        border: '2px solid var(--bg-primary)',
                                        marginLeft: i > 1 ? '-8px' : '0',
                                        opacity: 1 - (i * 0.15)
                                    }} />
                                ))}
                            </div>
                            <span style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-secondary)',
                                fontWeight: 500
                            }}>
                                Join <strong style={{ color: 'var(--text-primary)' }}>10.000+</strong> investors
                            </span>
                        </div>

                        {/* CTA Buttons */}
                        {isLoggedIn ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                alignItems: 'center',
                                gap: '1rem',
                                justifyContent: isMobile ? 'center' : 'flex-start'
                            }}>
                                <Link
                                    href={`/${username}`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: isMobile ? '0.9rem 1.75rem' : '1rem 2rem',
                                        fontSize: isMobile ? '0.95rem' : '1.05rem',
                                        fontWeight: 600,
                                        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        textDecoration: 'none',
                                        boxShadow: '0 4px 20px var(--accent-glow)',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Go to My Portfolio
                                    <ArrowRight size={20} />
                                </Link>

                                {/* Logout Button */}
                                <form action={handleSignOut} style={{ margin: 0 }}>
                                    <button
                                        type="submit"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            padding: '0.8rem 1.5rem',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <LogOut size={18} />
                                        Log Out
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: '1rem',
                                alignItems: isMobile ? 'stretch' : 'center'
                            }}>
                                <Link
                                    href="/login"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.75rem',
                                        padding: isMobile ? '0.9rem 1.75rem' : '1rem 2rem',
                                        fontSize: isMobile ? '0.95rem' : '1.05rem',
                                        fontWeight: 600,
                                        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        textDecoration: 'none',
                                        boxShadow: '0 4px 20px var(--accent-glow)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    Get Started Free
                                    <ArrowRight size={20} />
                                </Link>
                                <Link
                                    href="/demo"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.75rem',
                                        padding: isMobile ? '0.9rem 1.75rem' : '1rem 2rem',
                                        fontSize: isMobile ? '0.95rem' : '1.05rem',
                                        fontWeight: 600,
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        textDecoration: 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    View Demo
                                </Link>
                            </div>
                        )}

                        {!isLoggedIn && (
                            <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)',
                                marginTop: '1rem'
                            }}>
                                Free forever
                            </p>
                        )}
                    </div>

                    {/* Right: Dashboard Preview */}
                    <div style={{
                        position: 'relative',
                        display: isMobile ? 'none' : 'block'
                    }}>
                        <div style={{
                            position: 'relative',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            border: '1px solid var(--border)'
                        }}>
                            <Image
                                src="/landing/Dashboard-overview-1.png"
                                alt="Dashboard Overview"
                                width={800}
                                height={600}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    display: 'block'
                                }}
                            />
                        </div>

                        {/* Floating mobile preview */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-20px',
                            right: '-20px',
                            width: '180px',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                            border: '2px solid var(--bg-primary)'
                        }}>
                            <Image
                                src="/landing/Mobile-view-1.png"
                                alt="Mobile View"
                                width={180}
                                height={360}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    display: 'block'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section >

            {/* Features Section */}
            < section style={{
                padding: isMobile ? '4rem 1rem' : '6rem 2rem',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)'
            }
            }>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    <div style={{
                        textAlign: 'center',
                        marginBottom: isMobile ? '3rem' : '4rem'
                    }}>
                        <h2 style={{
                            fontSize: isMobile ? '1.75rem' : '2.5rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '1rem',
                            letterSpacing: '-0.02em'
                        }}>
                            Everything you need to track your wealth
                        </h2>
                        <p style={{
                            fontSize: isMobile ? '0.95rem' : '1.1rem',
                            color: 'var(--text-secondary)',
                            maxWidth: '600px',
                            margin: '0 auto'
                        }}>
                            Powerful features designed for long-term investors
                        </p>
                    </div>

                    {/* Feature Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                        gap: isMobile ? '1.5rem' : '2rem'
                    }}>
                        {/* Feature 1 - Portfolio Intelligence */}
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: isMobile ? '1.5rem' : '2rem',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <PieChart size={24} color="white" />
                            </div>
                            <h3 style={{
                                fontSize: isMobile ? '1.1rem' : '1.25rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: '0.75rem'
                            }}>
                                Portfolio Intelligence
                            </h3>
                            <p style={{
                                fontSize: '0.95rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6,
                                marginBottom: '1rem'
                            }}>
                                Track all your assets in one place. Stocks, crypto, funds, gold - everything you own.
                            </p>
                            <ul style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                marginBottom: '1rem'
                            }}>
                                {['Multi-asset support', 'Real-time updates', 'Auto-sync portfolios'].map((item) => (
                                    <li key={item} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <Check size={16} style={{ color: 'var(--accent)' }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            {/* Screenshot overlay */}
                            {!isMobile && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-10px',
                                    right: '-10px',
                                    width: '140px',
                                    height: '100px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                    border: '2px solid var(--bg-primary)',
                                    transform: 'rotate(3deg)'
                                }}>
                                    <Image
                                        src="/landing/Dashboard-overview-2.png"
                                        alt="Portfolio Preview"
                                        width={140}
                                        height={100}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Feature 2 - Performance Analytics */}
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: isMobile ? '1.5rem' : '2rem',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <TrendingUp size={24} color="white" />
                            </div>
                            <h3 style={{
                                fontSize: isMobile ? '1.1rem' : '1.25rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: '0.75rem'
                            }}>
                                Performance Analytics
                            </h3>
                            <p style={{
                                fontSize: '0.95rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6,
                                marginBottom: '1rem'
                            }}>
                                Compare your returns against major benchmarks and see where you stand.
                            </p>
                            <ul style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                marginBottom: '1rem'
                            }}>
                                {['Benchmark comparison', 'Historical charts', 'P&L tracking'].map((item) => (
                                    <li key={item} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <Check size={16} style={{ color: 'var(--accent)' }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            {/* Screenshot overlay */}
                            {!isMobile && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-10px',
                                    right: '-10px',
                                    width: '140px',
                                    height: '100px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                    border: '2px solid var(--bg-primary)',
                                    transform: 'rotate(3deg)'
                                }}>
                                    <Image
                                        src="/landing/Chart-Analytics-2.png"
                                        alt="Analytics Preview"
                                        width={140}
                                        height={100}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Feature 3 - Goal Tracking */}
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: isMobile ? '1.5rem' : '2rem',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <Target size={24} color="white" />
                            </div>
                            <h3 style={{
                                fontSize: isMobile ? '1.1rem' : '1.25rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: '0.75rem'
                            }}>
                                Goal Tracking
                            </h3>
                            <p style={{
                                fontSize: '0.95rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6,
                                marginBottom: '1rem'
                            }}>
                                Set financial milestones and watch your progress toward achieving them.
                            </p>
                            <ul style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                marginBottom: '1rem'
                            }}>
                                {['Custom milestones', 'Progress tracking', 'Achievement alerts'].map((item) => (
                                    <li key={item} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <Check size={16} style={{ color: 'var(--accent)' }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            {/* Screenshot overlay */}
                            {!isMobile && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-10px',
                                    right: '-10px',
                                    width: '140px',
                                    height: '100px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                    border: '2px solid var(--bg-primary)',
                                    transform: 'rotate(3deg)'
                                }}>
                                    <Image
                                        src="/landing/Asset-list-2.png"
                                        alt="Goals Preview"
                                        width={140}
                                        height={100}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section >

            {/* Screenshots Showcase */}
            < section style={{
                padding: isMobile ? '4rem 1rem' : '6rem 2rem'
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    <div style={{
                        textAlign: 'center',
                        marginBottom: isMobile ? '3rem' : '4rem'
                    }}>
                        <h2 style={{
                            fontSize: isMobile ? '1.75rem' : '2.5rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '1rem',
                            letterSpacing: '-0.02em'
                        }}>
                            Beautiful interface, powerful insights
                        </h2>
                        <p style={{
                            fontSize: isMobile ? '0.95rem' : '1.1rem',
                            color: 'var(--text-secondary)',
                            maxWidth: '600px',
                            margin: '0 auto'
                        }}>
                            Experience portfolio tracking that's both elegant and functional
                        </p>
                    </div>

                    {/* Screenshot Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                        gap: isMobile ? '2rem' : '3rem',
                        alignItems: 'start'
                    }}>
                        <div style={{
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            border: '1px solid var(--border)',
                            height: '100%'
                        }}>
                            <Image
                                src="/landing/Chart-Analytics-1.png"
                                alt="Analytics Dashboard"
                                width={600}
                                height={400}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block'
                                }}
                            />
                        </div>
                        <div style={{
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            border: '1px solid var(--border)',
                            height: '100%'
                        }}>
                            <Image
                                src="/landing/Asset-list-1.png"
                                alt="Asset List"
                                width={600}
                                height={400}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section >

            {/* Final CTA */}
            < section style={{
                padding: isMobile ? '4rem 1rem' : '6rem 2rem',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Pattern */}
                < div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.1,
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }} />

                < div style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                    textAlign: 'center',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <h2 style={{
                        fontSize: isMobile ? '2rem' : '3rem',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: '1.5rem',
                        letterSpacing: '-0.02em'
                    }}>
                        Ready to take control of your wealth?
                    </h2>
                    <p style={{
                        fontSize: isMobile ? '1rem' : '1.2rem',
                        color: 'rgba(255,255,255,0.9)',
                        marginBottom: '2.5rem',
                        lineHeight: 1.6
                    }}>
                        Join thousands of investors building wealth with smart portfolio tracking
                    </p>

                    {
                        !isLoggedIn && (
                            <Link
                                href="/login"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    padding: isMobile ? '1rem 2rem' : '1.2rem 2.5rem',
                                    fontSize: isMobile ? '1rem' : '1.1rem',
                                    fontWeight: 600,
                                    background: 'white',
                                    color: 'var(--accent)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                Start Free Today
                                <ArrowRight size={20} />
                            </Link>
                        )
                    }
                </div >
            </section >
        </div >
    );
}
