"use client";

import { LogOut } from "lucide-react";

export function SignOutButton() {
    return (
        <button
            type="submit"
            className="navbar-btn"
            title="Sign Out"
            style={{
                opacity: 0.8,
                border: '1px solid transparent',
                background: 'transparent',
                transition: 'all 0.2s',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.opacity = '0.8';
            }}
        >
            <LogOut size={18} strokeWidth={2.5} />
        </button>
    );
}
