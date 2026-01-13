/**
 * Loading Skeleton Components for Better UX
 */

export function SkeletonCard() {
    return (
        <div className="neo-card" style={{
            padding: '1.5rem',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}>
            <div style={{
                height: '1.5rem',
                background: 'var(--border)',
                borderRadius: '4px',
                marginBottom: '1rem',
                width: '60%'
            }} />
            <div style={{
                height: '1rem',
                background: 'var(--border)',
                borderRadius: '4px',
                marginBottom: '0.5rem'
            }} />
            <div style={{
                height: '1rem',
                background: 'var(--border)',
                borderRadius: '4px',
                width: '80%'
            }} />
        </div>
    );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="neo-card" style={{ padding: '1rem' }}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '0.75rem',
                    borderBottom: i < rows - 1 ? '1px solid var(--border)' : 'none',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    animationDelay: `${i * 0.1}s`
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--border)'
                    }} />
                    <div style={{ flex: 1 }}>
                        <div style={{
                            height: '1rem',
                            background: 'var(--border)',
                            borderRadius: '4px',
                            marginBottom: '0.5rem',
                            width: '70%'
                        }} />
                        <div style={{
                            height: '0.75rem',
                            background: 'var(--border)',
                            borderRadius: '4px',
                            width: '40%'
                        }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function SkeletonChart() {
    return (
        <div className="neo-card" style={{
            padding: '1.5rem',
            height: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite',
                borderRadius: '8px'
            }} />
        </div>
    );
}
