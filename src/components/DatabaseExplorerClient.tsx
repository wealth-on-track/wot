"use client";

import { useState } from "react";
import { TableName } from "@/lib/databaseExplorer";

interface DatabaseExplorerClientProps {
    tables: Array<{
        name: TableName;
        displayName: string;
        description: string;
        recordCount: number;
    }>;
    initialTable: TableName;
    initialData: any[];
    initialColumns: string[];
}

export function DatabaseExplorerClient({
    tables,
    initialTable,
    initialData,
    initialColumns
}: DatabaseExplorerClientProps) {
    const [selectedTable, setSelectedTable] = useState<TableName>(initialTable);
    const [loading, setLoading] = useState(false);

    const handleTableChange = async (tableName: TableName) => {
        setLoading(true);
        setSelectedTable(tableName);
        // Reload page with new table
        window.location.href = `/admin/database-explorer?table=${tableName}`;
    };

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return '-';

        // Check if it's a Date object
        if (value instanceof Date) {
            return value.toLocaleString();
        }

        // Check if it's an ISO 8601 date string (e.g., "2026-01-09T10:08:37.000Z")
        // Must match pattern: YYYY-MM-DDTHH:MM:SS or similar
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleString();
                }
            } catch {
                return String(value);
            }
        }

        if (typeof value === 'boolean') return value ? '✓' : '✗';
        if (typeof value === 'number') return value.toLocaleString();
        if (typeof value === 'string' && value.length > 50) {
            return value.substring(0, 50) + '...';
        }
        return String(value);
    };

    const selectedTableInfo = tables.find(t => t.name === selectedTable);

    return (
        <div style={{ padding: '1rem 1.5rem', width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h1 className="gradient-text" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 900 }}>Database Explorer</h1>

                {/* Table Selector */}
                <select
                    value={selectedTable}
                    onChange={(e) => handleTableChange(e.target.value as TableName)}
                    disabled={loading}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    {tables.map(table => (
                        <option key={table.name} value={table.name}>
                            {table.displayName} ({table.recordCount})
                        </option>
                    ))}
                </select>
            </div>

            {/* Table Info */}
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong>{selectedTableInfo?.displayName}</strong> - {selectedTableInfo?.description} - {selectedTableInfo?.recordCount} records
            </div>

            {/* Data Table */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div className="card" style={{ padding: '0', overflow: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                                <tr>
                                    {initialColumns.map(col => (
                                        <th key={col} style={{
                                            padding: '0.5rem 0.6rem',
                                            textAlign: 'left',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {initialData.length === 0 ? (
                                    <tr>
                                        <td colSpan={initialColumns.length} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                            No records found
                                        </td>
                                    </tr>
                                ) : (
                                    initialData.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            {initialColumns.map(col => (
                                                <td key={col} style={{
                                                    padding: '0.5rem 0.6rem',
                                                    maxWidth: '300px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }} title={String(row[col] || '')}>
                                                    {formatValue(row[col])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
