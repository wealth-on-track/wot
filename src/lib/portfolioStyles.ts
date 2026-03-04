export function getPortfolioStyle(name: string) {
    if (!name || name === '-') {
        return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'transparent' };
    }

    // Deterministic color per portfolio name (very high uniqueness)
    // Avoids small fixed palette collisions like TAK/BES sharing same badge color.
    let hash = 0;
    const cleanName = name.trim().toUpperCase();
    for (let i = 0; i < cleanName.length; i++) {
        hash = (hash * 31 + cleanName.charCodeAt(i)) | 0;
    }

    const n = Math.abs(hash);
    const hue = n % 360;
    const sat = 62 + (n % 16);      // 62-77
    const textLight = 28 + (n % 8); // 28-35 (dark, readable)

    return {
        bg: `hsla(${hue}, ${sat}%, 58%, 0.12)`,
        text: `hsl(${hue}, ${sat}%, ${textLight}%)`,
        border: `hsla(${hue}, ${sat}%, 50%, 0.28)`,
    };
}
