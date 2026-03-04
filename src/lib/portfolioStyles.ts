function computeTagStyle(rawName: string, salt: string) {
    const cleanName = `${salt}:${rawName.trim().toUpperCase()}`;

    let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
    for (let i = 0; i < cleanName.length; i++) {
        hash ^= cleanName.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193); // FNV prime
    }

    // Final avalanche mix
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;

    const n = hash >>> 0;
    const hue = n % 360;
    const sat = 60 + ((n >>> 9) % 24);       // 60-83
    const bgLight = 54 + ((n >>> 17) % 8);   // 54-61
    const textLight = 24 + ((n >>> 25) % 10);// 24-33

    return {
        bg: `hsla(${hue}, ${sat}%, ${bgLight}%, 0.13)`,
        text: `hsl(${hue}, ${sat}%, ${textLight}%)`,
        border: `hsla(${hue}, ${sat}%, 45%, 0.32)`,
    };
}

export function getPortfolioStyle(name: string) {
    if (!name || name === '-') {
        return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'transparent' };
    }
    return computeTagStyle(name, 'PORTFOLIO');
}

export function getPlatformStyle(name: string) {
    if (!name || name === '-') {
        return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'transparent' };
    }
    return computeTagStyle(name, 'PLATFORM');
}
