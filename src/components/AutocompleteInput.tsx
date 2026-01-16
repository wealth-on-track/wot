"use client";

import { useState, useEffect, useRef, useMemo } from "react";

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    style?: React.CSSProperties;
    label?: string;
    labelStyle?: React.CSSProperties;
}

export function AutocompleteInput({
    value,
    onChange,
    suggestions,
    placeholder,
    style,
    label,
    labelStyle
}: AutocompleteInputProps) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Use useMemo instead of useEffect + setState to avoid cascading renders
    const filteredSuggestions = useMemo(() => {
        if (!value || value.length === 0) return [];
        return suggestions.filter(s =>
            s.toLowerCase().startsWith(value.toLowerCase())
        );
    }, [value, suggestions]);

    // Control visibility based on filtered results
    const shouldShowSuggestions = showSuggestions &&
        filteredSuggestions.length > 0 &&
        filteredSuggestions[0].toLowerCase() !== value.toLowerCase();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (suggestion: string) => {
        onChange(suggestion);
        setShowSuggestions(false);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            {label && (
                <label style={labelStyle}>
                    {label}
                </label>
            )}
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => {
                    if (filteredSuggestions.length > 0) {
                        setShowSuggestions(true);
                    }
                }}
                placeholder={placeholder}
                style={style}
                autoComplete="off"
            />

            {shouldShowSuggestions && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 10000,
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    {filteredSuggestions.map((suggestion, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelect(suggestion)}
                            style={{
                                width: '100%',
                                padding: '0.65rem 0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: idx < filteredSuggestions.length - 1 ? '1px solid var(--border)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-secondary)';
                                e.currentTarget.style.color = 'var(--accent)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
