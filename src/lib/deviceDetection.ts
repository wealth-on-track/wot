/**
 * Device Detection Utilities
 * Detects if user is on mobile device
 */

export function isMobileDevice(userAgent?: string): boolean {
    const ua = userAgent || (typeof window !== 'undefined' ? window.navigator.userAgent : '');

    // Check for mobile patterns
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return mobileRegex.test(ua);
}

export function isMobileScreen(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
}

export function shouldUseMobileUI(): boolean {
    // Check both user agent and screen size
    return isMobileDevice() || isMobileScreen();
}

export function getDeviceType(userAgent?: string): 'mobile' | 'tablet' | 'desktop' {
    const ua = userAgent || (typeof window !== 'undefined' ? window.navigator.userAgent : '');

    if (/iPhone|iPod|Android.*Mobile/i.test(ua)) {
        return 'mobile';
    }

    if (/iPad|Android(?!.*Mobile)/i.test(ua)) {
        return 'tablet';
    }

    return 'desktop';
}
