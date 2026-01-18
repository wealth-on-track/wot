"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    style?: React.CSSProperties;
    label?: string;
    labelStyle?: React.CSSProperties;
}

/**
 * Premium Autocomplete Dropdown Input
 * 
 * Features:
 * - Shows ALL suggestions on focus (not just filtered)
 * - Filters as you type
 * - Visual feedback with checkmark for selected item
 * - Smooth animations and transitions
 * - Premium styling with hover effects
 * - Keyboard accessible
 */
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
    const [isFocused, setIsFocused] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Filter suggestions based on input value
    const filteredSuggestions = useMemo(() => {
        // If no value, show ALL suggestions (this is the key change!)
        if (!value || value.length === 0) return suggestions;

        // Otherwise filter by what user typed
        return suggestions.filter(s =>
            s.toLowerCase().includes(value.toLowerCase())
        );
    }, [value, suggestions]);

    // Show dropdown if:
    // 1. User focused the input
    // 2. There are suggestions to show
    // 3. Not already showing the exact selected value
    const shouldShowSuggestions = showSuggestions &&
        filteredSuggestions.length > 0;

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
                setIsFocused(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (suggestion: string) => {
        onChange(suggestion);
        setShowSuggestions(false);
        setIsFocused(false);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            {label && (
                <label style={labelStyle}>
                    {label}
                </label>
            )}

            {/* Input with Dropdown Icon */}
            <div style={{ position: 'relative' }}>
                <input
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        if (!showSuggestions) setShowSuggestions(true);
                    }}
                    onFocus={() => {
                        setIsFocused(true);
                        setShowSuggestions(true);
                    }}
                    onClick={() => {
                        // Always show dropdown on click
                        setShowSuggestions(true);
                    }}
                    placeholder={placeholder}
                    style={{
                        ...style,
                        paddingRight: '2.5rem', // Make room for chevron icon
                        transition: 'all 0.2s ease',
                        borderColor: isFocused ? 'var(--accent)' : style?.borderColor || 'var(--border)',
                        boxShadow: isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.1)' : 'none'
                    }}
                    autoComplete="off"
                />

                {/* Dropdown Chevron Icon */}
                <div style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: `translateY(-50%) rotate(${showSuggestions ? '180deg' : '0deg'})`,
                    transition: 'transform 0.2s ease',
                    pointerEvents: 'none',
                    color: isFocused ? 'var(--accent)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* Premium Dropdown Menu - Compact */}
            {shouldShowSuggestions && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.3rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    maxHeight: '192px', // 20% smaller (was 240px)
                    overflowY: 'auto',
                    zIndex: 10000,
                    boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                    animation: 'slideDown 0.15s ease-out',
                    padding: '0.2rem' // 20% smaller (was 0.25rem)
                }}>
                    {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((suggestion, idx) => {
                            const isSelected = value === suggestion;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelect(suggestion)}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem 0.65rem', // 20% smaller (was 0.65rem 0.85rem)
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        textAlign: 'left',
                                        fontSize: '0.75rem', // 20% smaller (was 0.85rem)
                                        fontWeight: isSelected ? 700 : 600,
                                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                                        marginBottom: idx < filteredSuggestions.length - 1 ? '0.1rem' : '0' // Tighter spacing
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'var(--bg-secondary)';
                                            e.currentTarget.style.transform = 'translateX(3px)'; // Slightly less movement
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.transform = 'translateX(0)';
                                        }
                                    }}
                                >
                                    <span>{suggestion}</span>
                                    {isSelected && (
                                        <Check
                                            size={14} // Smaller icon (was 16)
                                            style={{
                                                color: 'var(--accent)',
                                                flexShrink: 0,
                                                marginLeft: '0.4rem'
                                            }}
                                        />
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        <div style={{
                            padding: '0.75rem', // Smaller (was 1rem)
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem' // Smaller (was 0.85rem)
                        }}>
                            No matches found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
