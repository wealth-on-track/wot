"use client";

import { useRouter } from "next/navigation";

interface MobileDesktopToggleProps {
    username: string;
}

export function MobileDesktopToggle({ username }: MobileDesktopToggleProps) {
    const router = useRouter();

    const switchToDesktop = () => {
        // Set a cookie to force desktop view
        document.cookie = 'forceDesktop=true; path=/; max-age=31536000'; // 1 year
        router.push(`/${username}`);
        router.refresh();
    };

    return (
        <button
            onClick={switchToDesktop}
            style={{
                position: 'fixed',
                bottom: '100px',
                right: '1rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                fontSize: '1.2rem',
                zIndex: 999,
                opacity: 0.7,
                transition: 'opacity 0.2s'
            }}
            title="Switch to Desktop View"
        >
            🖥️
        </button>
    );
}
