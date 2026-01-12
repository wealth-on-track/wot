"use client";

type View = 'overview' | 'positions' | 'add';

interface MobileBottomNavProps {
    activeView: View;
    onViewChange: (view: View) => void;
    onAddClick: () => void;
}

export function MobileBottomNav({ activeView, onViewChange, onAddClick }: MobileBottomNavProps) {
    const navItems = [
        { id: 'overview' as View, label: 'Overview', icon: '📊' },
        { id: 'positions' as View, label: 'Positions', icon: '💼' },
    ];

    return (
        <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: '0.5rem',
            zIndex: 1000,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))'
        }}>
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    style={{
                        flex: 1,
                        background: activeView === item.id ? 'var(--bg-secondary)' : 'transparent',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        color: activeView === item.id ? 'var(--accent)' : 'var(--text-muted)'
                    }}
                >
                    <div style={{ fontSize: '1.25rem' }}>{item.icon}</div>
                    <div style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {item.label}
                    </div>
                </button>
            ))}

            {/* Add Button - Prominent */}
            <button
                onClick={onAddClick}
                style={{
                    width: '56px',
                    height: '56px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px var(--accent-glow)',
                    fontSize: '1.5rem',
                    color: '#fff',
                    transition: 'transform 0.2s'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                +
            </button>
        </nav>
    );
}
