"use client";

import React from "react";
import { LogOut } from "lucide-react";
import { handleSignOut } from "@/lib/authActions";

export function NavbarActions() {
    return (
        <>
            {/* Separator before signout */}
            <div style={{
                height: '1.5rem',
                width: '1px',
                background: 'var(--border)',
            }} />

            {/* Logout */}
            <form action={handleSignOut} style={{ margin: 0 }}>
                <button
                    type="submit"
                    title="Sign Out"
                    className="navbar-btn"
                >
                    <LogOut size={20} />
                </button>
            </form>
        </>
    );
}
