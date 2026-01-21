"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/context/PrivacyContext";

export function PrivacyToggle() {
    const { showAmounts, toggleAmounts } = usePrivacy();

    return (
        <button
            onClick={toggleAmounts}
            title={showAmounts ? "Hide amounts" : "Show amounts"}
            className="navbar-btn"
        >
            {showAmounts ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
    );
}
