"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Wallet,
    Database,
    Activity,
    FileText,
    LogOut
} from "lucide-react";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
}

const navItems: NavItem[] = [
    {
        label: "Dashboard",
        href: "/admin",
        icon: <LayoutDashboard size={18} />,
        color: "#6366f1",
        bgColor: "rgba(99, 102, 241, 0.1)"
    },
    {
        label: "Data Overview",
        href: "/admin/data-overview",
        icon: <Database size={18} />,
        color: "#f59e0b",
        bgColor: "rgba(245, 158, 11, 0.1)"
    },
    {
        label: "DB Explorer",
        href: "/admin/database-explorer",
        icon: <Database size={18} />,
        color: "#ec4899",
        bgColor: "rgba(236, 72, 153, 0.1)"
    },
    {
        label: "Users",
        href: "/admin/users",
        icon: <Users size={18} />,
        color: "#8b5cf6",
        bgColor: "rgba(139, 92, 246, 0.1)"
    },
    {
        label: "Assets",
        href: "/admin/assets",
        icon: <Wallet size={18} />,
        color: "#eab308",
        bgColor: "rgba(234, 179, 8, 0.1)"
    },
    {
        label: "Price Cache",
        href: "/admin/cache",
        icon: <Database size={18} />,
        color: "#06b6d4",
        bgColor: "rgba(6, 182, 212, 0.1)"
    },
    {
        label: "API Health",
        href: "/admin/health",
        icon: <Activity size={18} />,
        color: "#22c55e",
        bgColor: "rgba(34, 197, 94, 0.1)"
    },
    {
        label: "API Logs",
        href: "/admin/requests",
        icon: <FileText size={18} />,
        color: "#ef4444",
        bgColor: "rgba(239, 68, 68, 0.1)"
    },
    {
        label: "Activity Logs",
        href: "/admin/activity",
        icon: <Activity size={18} />,
        color: "#14b8a6",
        bgColor: "rgba(20, 184, 166, 0.1)"
    }
];

export function AdminSidebar({ username }: { username: string }) {
    const pathname = usePathname();

    return (
        <div
            style={{
                width: '220px',
                height: '100vh',
                position: 'sticky',
                top: 0,
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem 0.75rem'
            }}
        >
            {/* Header */}
            <div style={{
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border)',
                marginBottom: '0.75rem'
            }}>
                <h2 style={{
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: 0,
                    letterSpacing: '-0.02em',
                    marginBottom: '0.25rem'
                }}>
                    Admin Panel
                </h2>
                <p style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    margin: 0,
                    fontWeight: 600
                }}>
                    System Monitor
                </p>
            </div>

            {/* Back to User Page - At Top */}
            <Link
                href={`/${username}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: '#fff',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 3px 10px rgba(102, 126, 234, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    marginBottom: '0.75rem'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 5px 14px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 3px 10px rgba(102, 126, 234, 0.3)';
                }}
            >
                <LogOut size={18} />
                <span>Back to User</span>
            </Link>

            {/* Navigation */}
            <nav style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.7rem 0.85rem',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    color: isActive ? '#fff' : 'var(--text-primary)',
                                    background: isActive ? item.color : 'transparent',
                                    fontWeight: isActive ? 700 : 600,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s',
                                    boxShadow: isActive ? `0 3px 10px ${item.color}40` : 'none'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = item.bgColor;
                                        e.currentTarget.style.color = item.color;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '18px'
                                }}>
                                    {item.icon}
                                </div>
                                <span style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
