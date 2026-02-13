"use client";

/**
 * Admin User Management Component
 * Full-featured user list with search, filter, and role management
 */

import React, { useState, useCallback } from 'react';
import { Search, ChevronDown, Shield, ShieldCheck, User, ExternalLink, AlertCircle } from 'lucide-react';

interface UserData {
    id: string;
    username: string;
    email: string;
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    createdAt: string;
    updatedAt: string;
    portfolio: {
        id: string;
        isPublic: boolean;
        assetCount: number;
    } | null;
}

interface UserManagementProps {
    initialUsers: UserData[];
    totalCount: number;
}

const ROLE_COLORS: Record<string, string> = {
    'USER': '#6b7280',
    'ADMIN': '#3b82f6',
    'SUPER_ADMIN': '#ef4444'
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
    'USER': <User size={14} />,
    'ADMIN': <Shield size={14} />,
    'SUPER_ADMIN': <ShieldCheck size={14} />
};

export function UserManagement({ initialUsers, totalCount }: UserManagementProps) {
    const [users, setUsers] = useState(initialUsers);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<string | null>(null);

    // Search and filter
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (roleFilter) params.set('role', roleFilter);

            const response = await fetch(`/api/admin/users?${params}`);
            const data = await response.json();

            if (data.success) {
                setUsers(data.data.users);
            } else {
                setError(data.error || 'Failed to fetch users');
            }
        } catch (e) {
            setError('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }, [search, roleFilter]);

    // Handle search on Enter
    const handleSearch = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            fetchUsers();
        }
    };

    // Update user role
    const updateUserRole = async (userId: string, newRole: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            });

            const data = await response.json();

            if (data.success) {
                setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, role: newRole as UserData['role'] } : u
                ));
                setEditingUser(null);
            } else {
                setError(data.error || 'Failed to update user');
            }
        } catch (e) {
            setError('Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Search and Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{
                    flex: 1,
                    position: 'relative'
                }}>
                    <Search
                        size={16}
                        style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#666'
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleSearch}
                        style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem 0.6rem 2.5rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.9rem'
                        }}
                    />
                </div>

                <select
                    value={roleFilter}
                    onChange={(e) => {
                        setRoleFilter(e.target.value);
                        setTimeout(fetchUsers, 100);
                    }}
                    style={{
                        padding: '0.6rem 1rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    <option value="">All Roles</option>
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                </select>

                <button
                    onClick={fetchUsers}
                    disabled={loading}
                    style={{
                        padding: '0.6rem 1.25rem',
                        background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    {loading ? 'Loading...' : 'Search'}
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#ef4444'
                }}>
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Users Table */}
            <div className="card" style={{ flex: 1, padding: 0, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                        <tr>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>User</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>Email</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>Role</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>Assets</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>Joined</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ fontWeight: 600 }}>{user.username}</div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#888' }}>
                                    {user.email}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                    {editingUser === user.id ? (
                                        <select
                                            value={user.role}
                                            onChange={(e) => updateUserRole(user.id, e.target.value)}
                                            onBlur={() => setEditingUser(null)}
                                            autoFocus
                                            style={{
                                                padding: '0.3rem 0.5rem',
                                                background: 'rgba(255,255,255,0.1)',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                borderRadius: '4px',
                                                color: '#fff',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            <option value="USER">User</option>
                                            <option value="ADMIN">Admin</option>
                                            <option value="SUPER_ADMIN">Super Admin</option>
                                        </select>
                                    ) : (
                                        <span
                                            onClick={() => setEditingUser(user.id)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                padding: '0.25rem 0.6rem',
                                                background: `${ROLE_COLORS[user.role]}20`,
                                                color: ROLE_COLORS[user.role],
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {ROLE_ICONS[user.role]}
                                            {user.role.replace('_', ' ')}
                                            <ChevronDown size={12} />
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '0.2rem 0.5rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem'
                                    }}>
                                        {user.portfolio?.assetCount ?? 0}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#888', fontSize: '0.8rem' }}>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                    <a
                                        href={`/${user.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#14b8a6',
                                            textDecoration: 'none',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        View <ExternalLink size={12} />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {users.length === 0 && (
                    <div style={{
                        padding: '3rem',
                        textAlign: 'center',
                        color: '#666'
                    }}>
                        No users found
                    </div>
                )}
            </div>
        </div>
    );
}
