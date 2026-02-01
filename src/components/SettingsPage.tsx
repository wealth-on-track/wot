"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateUserPreferences } from "@/lib/actions";
import { useTheme } from "@/context/ThemeContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage } from "@/context/LanguageContext";
import { User, Mail, Lock, Globe, DollarSign, Moon, Sun, ArrowLeft, Eye, EyeOff, TrendingUp, BarChart3, Clock, Save, Pencil } from "lucide-react";

interface SettingsPageProps {
    userEmail: string;
    username?: string;
    preferences?: {
        defaultRange?: string;
        benchmarks?: string[];
        timezone?: string;
    };
}

export function SettingsPage({ userEmail, username, preferences, onBack }: SettingsPageProps & { onBack?: () => void }) {
    const router = useRouter();
    const { currency, setCurrency } = useCurrency();
    const { language, setLanguage } = useLanguage();
    const { theme, toggleTheme, setTheme } = useTheme();

    // Settings state
    const [benchmarks, setBenchmarks] = useState<string[]>(preferences?.benchmarks || []);
    const [chartRange, setChartRange] = useState(preferences?.defaultRange || '1Y');
    const [timezone, setTimezone] = useState(preferences?.timezone || 'Europe/Istanbul');
    const [isSavingPreferences, setIsSavingPreferences] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Mobile detection (for responsive styling)
    const isMobile = false; // Desktop-only component, mobile has separate page

    const handleThemeChange = (targetTheme: 'light' | 'dark') => {
        setTheme(targetTheme);
    };

    const handleBenchmarkToggle = (benchmark: string) => {
        setBenchmarks(prev => {
            const newBenchmarks = prev.includes(benchmark)
                ? prev.filter(b => b !== benchmark)
                : [...prev, benchmark];
            localStorage.setItem('benchmarks', JSON.stringify(newBenchmarks));
            return newBenchmarks;
        });
    };

    const handleChartRangeChange = (newRange: string) => {
        setChartRange(newRange);
        localStorage.setItem('chartRange', newRange);
    };

    const handleTimezoneChange = (newTimezone: string) => {
        setTimezone(newTimezone);
        localStorage.setItem('timezone', newTimezone);
    };

    const handleSavePreferences = async () => {
        setIsSavingPreferences(true);
        setSaveSuccess(false);
        try {
            await updateUserPreferences({
                benchmarks,
                defaultRange: chartRange,
                timezone,
                theme,
                currency, // Note: these come from context, assume they are simple strings
                language
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (e) {
            console.error(e);
            alert('Failed to save preferences');
        } finally {
            setIsSavingPreferences(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage(null);

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setIsChangingPassword(true);

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                setPasswordMessage({ type: 'success', text: 'Password changed successfully' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
            }
        } catch (error) {
            setPasswordMessage({ type: 'error', text: 'An error occurred. Please try again.' });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const availableBenchmarks = [
        { value: 'SPX', label: 'S&P 500' },
        { value: 'IXIC', label: 'NASDAQ' },
        { value: 'BIST100', label: 'BIST 100' },
        { value: 'GOLD', label: 'Gold' },
        { value: 'BTC', label: 'Bitcoin' }
    ];

    const inputStyle = {
        width: '100%',
        padding: isMobile ? '0.5rem' : '0.6rem',
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        color: 'var(--text-primary)'
    };

    const labelStyle = {
        display: 'block',
        marginBottom: '0.3rem',
        color: 'var(--text-secondary)',
        fontSize: isMobile ? '0.75rem' : '0.8rem',
        fontWeight: 500
    };

    const sectionTitleStyle = {
        fontSize: isMobile ? '0.85rem' : '0.95rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: isMobile ? '0.5rem' : '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em'
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-main)',
            paddingTop: isMobile ? '0' : '6rem',
            paddingBottom: '3rem'
        }}>
            <div className={isMobile ? "" : "container"} style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: isMobile ? '0' : '0 3rem'
            }}>
                {/* Mobile Header or Desktop Header */}
                <div style={{
                    padding: isMobile ? '0.75rem 1rem' : '0 0 2.5rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '0.5rem' : '1rem',
                    background: isMobile ? 'var(--bg-secondary)' : 'transparent',
                    borderBottom: isMobile ? '1px solid var(--border)' : 'none',
                    position: isMobile ? 'sticky' : 'static',
                    top: 0,
                    zIndex: 10
                }}>
                    <button
                        onClick={() => onBack ? onBack() : router.back()}
                        className="navbar-btn"
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-primary)',
                            background: 'transparent',
                            border: 'none',
                            padding: 0
                        }}
                    >
                        <ArrowLeft size={isMobile ? 18 : 20} />
                    </button>
                    <h1 style={{
                        fontSize: isMobile ? '1rem' : '2.5rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        letterSpacing: isMobile ? '0' : '-0.02em',
                        margin: 0
                    }}>
                        Settings
                    </h1>
                </div>

                {/* Full Width Account Profile Header */}
                <div style={{
                    width: '100%',
                    marginBottom: isMobile ? '1rem' : '1.5rem',
                    background: 'rgba(var(--bg-secondary-rgb), 0.5)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: isMobile ? '1rem' : '1.25rem 2.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.5rem',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '1rem' : '2rem',
                        flex: 1
                    }}>
                        {/* Avatar/Profile Initial */}
                        <div style={{
                            width: isMobile ? '48px' : '64px',
                            height: isMobile ? '48px' : '64px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: isMobile ? '1.2rem' : '1.6rem',
                            boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.25)',
                            textTransform: 'uppercase',
                            flexShrink: 0
                        }}>
                            {(username || userEmail)[0]}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{
                                    color: 'var(--text-primary)',
                                    fontWeight: 800,
                                    fontSize: isMobile ? '1.2rem' : '1.6rem',
                                    letterSpacing: '-0.02em'
                                }}>
                                    {username || userEmail.split('@')[0]}
                                </span>
                                <span style={{
                                    padding: '3px 10px',
                                    borderRadius: '8px',
                                    background: 'rgba(var(--accent-rgb), 0.1)',
                                    color: 'var(--accent)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    border: '1px solid rgba(var(--accent-rgb), 0.2)'
                                }}>
                                    Active Account
                                </span>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                opacity: 0.8
                            }}>
                                <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: isMobile ? '0.85rem' : '1.1rem',
                                    fontWeight: 500
                                }}>
                                    {userEmail}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        className="glass-button"
                        style={{
                            padding: isMobile ? '0.6rem 1rem' : '0.75rem 1.75rem',
                            borderRadius: '12px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                        }}
                    >
                        <Pencil size={16} style={{ color: 'var(--accent)' }} />
                        <span>Edit Details</span>
                    </button>

                    {/* Decorative glow */}
                    <div style={{
                        position: 'absolute',
                        top: '-50%',
                        right: '-5%',
                        width: '250px',
                        height: '250px',
                        background: 'var(--accent)',
                        opacity: 0.03,
                        filter: 'blur(80px)',
                        borderRadius: '50%',
                        pointerEvents: 'none'
                    }} />
                </div>

                {/* Content Layout - Flex Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr',
                    gap: isMobile ? '0.5rem' : '1.5rem',
                    alignItems: 'stretch' // Makes both columns equal height
                }}>

                    {/* Left Column: Password */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isMobile ? '0.5rem' : '1.5rem',
                        height: '100%'
                    }}>

                        {/* Password Change */}
                        <section className="neo-card" style={{
                            padding: isMobile ? '0.75rem' : '1rem',
                            flex: 1, // This allows the password box to expand if needed to match height
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <h2 style={sectionTitleStyle}>
                                <Lock size={isMobile ? 14 : 16} />
                                Password
                            </h2>

                            <form onSubmit={handlePasswordChange} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: isMobile ? '0.5rem' : '0.75rem',
                                flex: 1 // Push content apart if needed
                            }}>
                                <div>
                                    <label style={labelStyle}>Current</label>
                                    <input
                                        type={showPasswords ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        className="glass-button"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>New</label>
                                    <input
                                        type={showPasswords ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="glass-button"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>Confirm</label>
                                    <input
                                        type={showPasswords ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="glass-button"
                                        style={inputStyle}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '0',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        color: 'var(--accent)',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                                    {showPasswords ? 'Hide Secrets' : 'Show Secrets'}
                                </button>

                                {passwordMessage && (
                                    <div style={{
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        background: passwordMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        border: `1px solid ${passwordMessage.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                        color: passwordMessage.type === 'success' ? '#22c55e' : '#ef4444',
                                        fontSize: '0.75rem'
                                    }}>
                                        {passwordMessage.text}
                                    </div>
                                )}

                                <div style={{ marginTop: 'auto' }}>
                                    <button
                                        type="submit"
                                        disabled={isChangingPassword}
                                        className="glass-button"
                                        style={{
                                            padding: isMobile ? '0.5rem' : '0.6rem 1rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                            color: 'white',
                                            width: '100%',
                                            opacity: isChangingPassword ? 0.6 : 1,
                                            cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}
                                    >
                                        {isChangingPassword ? 'Changing...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>

                    {/* Right Column: Preferences */}
                    <section className="neo-card" style={{
                        padding: isMobile ? '0.75rem' : '1rem',
                        width: isMobile ? '100%' : '65%', // Maintained verified width adjustment
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <h2 style={sectionTitleStyle}>
                            <Globe size={isMobile ? 14 : 16} />
                            Preferences
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.5rem' : '0.75rem', flex: 1 }}>
                            {/* 1. Theme */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '0.5rem' : '0',
                                alignItems: isMobile ? 'flex-start' : 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {theme === 'dark' ? (
                                        <Moon size={14} style={{ color: 'var(--text-secondary)' }} />
                                    ) : (
                                        <Sun size={14} style={{ color: 'var(--text-secondary)' }} />
                                    )}
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                        Theme
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--bg-primary)', padding: '2px', borderRadius: '6px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    <button
                                        onClick={() => handleThemeChange('light')}
                                        style={{
                                            padding: '0.3rem 0.6rem',
                                            border: 'none',
                                            borderRadius: '4px',
                                            background: theme === 'light' ? 'var(--accent)' : 'transparent',
                                            color: theme === 'light' ? 'white' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            flex: isMobile ? 1 : 'none'
                                        }}
                                    >
                                        <Sun size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleThemeChange('dark')}
                                        style={{
                                            padding: '0.3rem 0.6rem',
                                            border: 'none',
                                            borderRadius: '4px',
                                            background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                                            color: theme === 'dark' ? 'white' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            flex: isMobile ? 1 : 'none'
                                        }}
                                    >
                                        <Moon size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* 2. Language */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '0.5rem' : '0',
                                alignItems: isMobile ? 'flex-start' : 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Globe size={14} style={{ color: 'var(--text-secondary)' }} />
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                        Language
                                    </span>
                                </div>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as any)}
                                    // Removed glass-button class to fix text color in light mode
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        minWidth: '90px',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)', // Explicitly set text color
                                        border: '1px solid var(--border)', // Added border for better definition
                                        borderRadius: '6px', // Added radius
                                        width: isMobile ? '100%' : 'auto'
                                    }}
                                >
                                    <option value="ENG">English</option>
                                    <option value="TR">Türkçe</option>
                                </select>
                            </div>

                            {/* 3. Currency */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '0.5rem' : '0',
                                alignItems: isMobile ? 'flex-start' : 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <DollarSign size={14} style={{ color: 'var(--text-secondary)' }} />
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                        Currency
                                    </span>
                                </div>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value as any)}
                                    // Removed glass-button class to fix text color in light mode
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        minWidth: '90px',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)', // Explicitly set text color
                                        border: '1px solid var(--border)', // Added border
                                        borderRadius: '6px', // Added radius
                                        width: isMobile ? '100%' : 'auto'
                                    }}
                                >
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="TRY">TRY (₺)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                            </div>

                            {/* 4. Timezone */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '0.5rem' : '0',
                                alignItems: isMobile ? 'flex-start' : 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                        Timezone
                                    </span>
                                </div>
                                <select
                                    value={timezone}
                                    onChange={(e) => handleTimezoneChange(e.target.value)}
                                    // Removed glass-button class to fix text color in light mode
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        minWidth: '120px',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)', // Explicitly set text color
                                        border: '1px solid var(--border)', // Added border
                                        borderRadius: '6px', // Added radius
                                        maxWidth: isMobile ? '100%' : '150px',
                                        width: isMobile ? '100%' : 'auto',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    <option value="Europe/Istanbul">Istanbul (GMT+3)</option>
                                    <option value="Europe/London">London (GMT+0)</option>
                                    <option value="Europe/Paris">Paris (GMT+1)</option>
                                    <option value="America/New_York">New York (GMT-5)</option>
                                    <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
                                    <option value="America/Chicago">Chicago (GMT-6)</option>
                                    <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                                    <option value="Asia/Shanghai">Shanghai (GMT+8)</option>
                                    <option value="Asia/Dubai">Dubai (GMT+4)</option>
                                    <option value="UTC">UTC</option>
                                </select>
                            </div>

                            {/* 5. Default Benchmarks */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <TrendingUp size={14} style={{ color: 'var(--text-secondary)' }} />
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                            Comparison Benchmarks
                                        </span>
                                    </div>
                                    {/* Removed save button strictly for benchmarks */}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                    {availableBenchmarks.map(({ value, label }) => {
                                        const isSelected = benchmarks.includes(value);
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => handleBenchmarkToggle(value)}
                                                style={{
                                                    padding: '0.3rem 0.5rem',
                                                    fontSize: '0.65rem',
                                                    background: isSelected ? 'var(--accent)' : 'var(--bg-primary)',
                                                    color: isSelected ? 'white' : 'var(--text-secondary)',
                                                    border: isSelected ? 'none' : '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    flex: isMobile ? '1 0 40%' : 'none'
                                                }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 6. Chart Default Range */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '0.5rem' : '0',
                                alignItems: isMobile ? 'flex-start' : 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <BarChart3 size={14} style={{ color: 'var(--text-secondary)' }} />
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                        Default Chart Range
                                    </span>
                                </div>
                                <select
                                    value={chartRange}
                                    onChange={(e) => handleChartRangeChange(e.target.value)}
                                    // Removed glass-button class to fix text color in light mode
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        minWidth: '80px',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)', // Explicitly set text color
                                        border: '1px solid var(--border)', // Added border
                                        borderRadius: '6px', // Added radius
                                        width: isMobile ? '100%' : 'auto'
                                    }}
                                >
                                    <option value="1D">1 Day</option>
                                    <option value="1W">1 Week</option>
                                    <option value="1M">1 Month</option>
                                    <option value="YTD">Year to Date (YTD)</option>
                                    <option value="1Y">1 Year</option>
                                    <option value="ALL">All Time</option>
                                </select>
                            </div>

                            {/* Global Save Button for Preferences */}
                            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                                <button
                                    onClick={handleSavePreferences}
                                    disabled={isSavingPreferences}
                                    className="glass-button"
                                    style={{
                                        width: '100%',
                                        padding: isMobile ? '0.5rem' : '0.6rem 1rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        background: saveSuccess ? 'var(--success)' : 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                                        color: 'white',
                                        opacity: isSavingPreferences ? 0.6 : 1,
                                        cursor: isSavingPreferences ? 'not-allowed' : 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <Save size={16} />
                                    {isSavingPreferences ? 'Saving...' : saveSuccess ? 'Saved Successfully!' : 'Save Preferences'}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
