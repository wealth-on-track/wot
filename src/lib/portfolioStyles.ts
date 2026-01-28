export function getPortfolioStyle(name: string) {
    if (!name || name === '-') return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'transparent' };
    let hash = 0;
    const cleanName = name.toUpperCase();
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        { bg: 'rgba(59, 130, 246, 0.08)', text: '#1d4ed8', border: 'rgba(59, 130, 246, 0.12)' }, // Blue
        { bg: 'rgba(16, 185, 129, 0.08)', text: '#047857', border: 'rgba(16, 185, 129, 0.12)' }, // Emerald
        { bg: 'rgba(245, 158, 11, 0.08)', text: '#b45309', border: 'rgba(245, 158, 11, 0.12)' }, // Amber
        { bg: 'rgba(139, 92, 246, 0.08)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.12)' }, // Purple
        { bg: 'rgba(244, 63, 94, 0.08)', text: '#be123c', border: 'rgba(244, 63, 94, 0.12)' },  // Rose
        { bg: 'rgba(6, 182, 212, 0.08)', text: '#0e7490', border: 'rgba(6, 182, 212, 0.12)' }, // Cyan
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}
