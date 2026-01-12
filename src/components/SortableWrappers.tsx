import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Wrapper to make AssetTableRow sortable
export function SortableAssetRow({ id, children, disabled }: { id: string, children: React.ReactNode, disabled?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        cursor: disabled ? 'default' : 'grab',
        zIndex: isDragging ? 1000 : 1,
        position: 'relative' as const
    };

    if (disabled) {
        return (
            <div className="sortable-asset-row" style={{ opacity: 1 }}>
                {children}
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="sortable-asset-row" {...attributes} {...listeners}>
            {children}
        </div>
    );
}

// Wrapper to make Groups sortable
export function SortableGroup({ id, children, disabled }: { id: string, children: React.ReactNode, disabled?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    if (disabled) {
        return (
            <div>
                {children}
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style}>
            {React.isValidElement(children)
                ? React.cloneElement(children as React.ReactElement<any>, { dragHandleProps: { ...attributes, ...listeners } })
                : children}
        </div>
    );
}

// Wrapper to make AssetCard sortable (Grid View)
export function SortableAssetCard({ id, children, disabled }: { id: string, children: React.ReactNode, disabled?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: disabled ? 'default' : 'grab',
        position: 'relative' as const,
        zIndex: isDragging ? 10 : 1
    };

    if (disabled) {
        return (
            <div style={{ position: 'relative' }}>
                {children}
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
}
