import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Check } from 'lucide-react';

// Sortable Column Item for Modal
const SortableColumnItem = ({ id, label }: { id: string, label: string }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        background: isDragging ? 'var(--bg-secondary)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'grab',
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20000 : 1,
        boxShadow: isDragging ? 'var(--shadow-md)' : 'none',
        marginBottom: '0.5rem'
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Check size={12} color="#fff" />
            </div>
        </div>
    );
};
