"use client";

import { LogOut } from "lucide-react";

export function SignOutButton() {
    return (
        <button
            type="submit"
            className="navbar-btn navbar-btn-signout"
            title="Sign Out"
            aria-label="Sign out"
        >
            <LogOut size={18} strokeWidth={2.5} />
        </button>
    );
}
