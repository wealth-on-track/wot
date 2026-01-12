import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyPlaceholderProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
    height?: string;
}

export function EmptyPlaceholder({
    icon: Icon = Inbox,
    title,
    description,
    action,
    height = '300px'
}: EmptyPlaceholderProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height,
            width: '100%',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border)',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-muted)'
        }}>
            <div style={{
                background: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '50%',
                marginBottom: '1rem',
                border: '1px solid var(--border-muted)'
            }}>
                <Icon size={32} strokeWidth={1.5} style={{ opacity: 0.7 }} />
            </div>
            <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.4rem'
            }}>
                {title}
            </h3>
            <p style={{
                fontSize: '0.9rem',
                maxWidth: '300px',
                lineHeight: 1.5,
                opacity: 0.8,
                marginBottom: action ? '1.5rem' : 0
            }}>
                {description}
            </p>
            {action && (
                <div style={{ marginTop: '0.5rem' }}>
                    {action}
                </div>
            )}
        </div>
    );
}
